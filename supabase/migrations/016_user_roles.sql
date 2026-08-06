-- 016_user_roles.sql
-- ---------------------------------------------------------------------------
-- Platform roles: single source of truth on public.profiles.role
--
--   donor          → "Investor"  (default) — browses, funds projects
--   creator        → "Creator"   — owns campaigns
--   platform_admin → "Admin"     — platform operations (elevated manually)
--
-- Replaces the old implicit detection (organization_members / creator_verifications)
-- whose tables do not exist in production, so every user was being treated as
-- an investor regardless of activity.
-- ---------------------------------------------------------------------------

-- 1. Role column -----------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'donor'
  CHECK (role IN ('donor', 'creator', 'platform_admin'));

COMMENT ON COLUMN public.profiles.role IS
  'Platform role. donor=Investor, creator=Creator, platform_admin=Admin.';

-- 2. Backfill existing project owners → creator ------------------------------
UPDATE public.profiles p
SET role = 'creator'
WHERE p.role = 'donor'
  AND EXISTS (SELECT 1 FROM public.projects pr WHERE pr.owner_id = p.id);

-- 3. Auto-promote to creator on first project --------------------------------
CREATE OR REPLACE FUNCTION public.promote_user_to_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'creator'
    WHERE id = NEW.owner_id AND role = 'donor';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created_promote_creator ON public.projects;
CREATE TRIGGER on_project_created_promote_creator
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_user_to_creator();

-- 4. Block direct role changes by end users ----------------------------------
-- A user must never be able to flip their own role through the client API.
-- Role changes are only allowed through public.set_user_role() (admin path),
-- which sets the app.allow_role_change flag for the current transaction.
CREATE OR REPLACE FUNCTION public.protect_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(current_setting('app.allow_role_change', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Role changes must go through public.set_user_role()'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_role_changes ON public.profiles;
CREATE TRIGGER protect_user_role_changes
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role();

-- 5. Admin role-elevation helper ---------------------------------------------
-- Usage (client, after login as admin):
--   supabase.rpc('set_user_role', { target_user_id: uuid, new_role: 'creator' })
-- Only a platform_admin can call it; it runs with the function owner's rights.
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, new_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role TEXT;
  _valid       BOOLEAN := new_role IN ('donor', 'creator', 'platform_admin');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO _caller_role FROM public.profiles WHERE id = auth.uid();
  IF _caller_role <> 'platform_admin' THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Allow the protect_user_role trigger to accept this change.
  PERFORM set_config('app.allow_role_change', 'on', true);

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO service_role;

-- 6. RLS notes ---------------------------------------------------------------
-- public.profiles is intentionally publicly readable (the anon key can read all
-- profiles so browsing/followers/creator-pages work). We therefore do NOT flip
-- RLS to strict mode here — that would break public profile browsing.
--
-- Role integrity is enforced by the protect_user_role trigger (fires on any
-- UPDATE that touches `role`, independent of RLS) plus the set_user_role()
-- SECURITY DEFINER helper (admin-only elevation). The policies below are inert
-- while RLS is disabled and become active if RLS is ever enabled, granting the
-- minimum needed for the current flows (read own, update own).
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
CREATE POLICY "users_can_read_own_profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
CREATE POLICY "users_can_update_own_profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

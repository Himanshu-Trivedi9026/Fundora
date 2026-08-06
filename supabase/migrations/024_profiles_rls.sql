-- 024_profiles_rls.sql
-- ---------------------------------------------------------------------------
-- Enable Row Level Security on public.profiles.
--
-- Background (from the production audit):
--   public.profiles is intentionally *publicly readable* (explore, creator/
--   investor profile pages, followers and search all SELECT with the anon key),
--   but RLS was never enabled, so it was also publicly *writable*: any signed-in
--   user could UPDATE or DELETE any other user's profile row, and could DELETE
--   their own row and re-INSERT it with role = 'platform_admin' to self-elevate
--   (the protect_user_role trigger from 016 only guards UPDATE of `role`, and
--   only fires on UPDATE, so the INSERT path was open).
--
-- This migration:
--   1. Enables RLS on profiles.
--   2. Keeps the public read (USING (true)) — the documented intent of 016.
--   3. Allows a user to INSERT only their own row (auth.uid() = id) AND only
--      with a non-admin role ('donor' | 'creator'). The auth callback always
--      inserts with the sanitized role from parseSignupRole(), so the signup
--      flow is preserved while self-elevation to platform_admin is blocked.
--   4. Allows a user to UPDATE only their own row (auth.uid() = id). Role
--      changes are still blocked by the protect_user_role trigger (016), and
--      admin elevation continues via set_user_role() (SECURITY DEFINER).
--   5. Provides NO client DELETE policy — account deletion runs through
--      /api/account/delete with the service-role client (RLS bypassed).
--
-- The previous 016 inert policies (users_can_read_own_profile /
-- users_can_update_own_profile) are dropped so they don't become active and
-- over-restrict reads once RLS is enabled.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop the 016-era policies that were inert while RLS was disabled but would
-- become active (and over-restrictive) now that RLS is on.
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

-- Public read — every visitor can read every profile (explore, creator/
-- investor profiles, followers, search). Matches the 016 design note.
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Self-insert at signup, non-admin roles only. Blocks INSERTing a row with
-- role = 'platform_admin' (the self-elevation vector).
DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
CREATE POLICY "profiles_owner_insert"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND role IN ('donor', 'creator')
  );

-- Self-update — preserves profile editing (edit-profile). `role` remains
-- guarded by the protect_user_role trigger, and admin elevation goes through
-- set_user_role() (SECURITY DEFINER, RLS-bypassing).
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
CREATE POLICY "profiles_owner_update"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

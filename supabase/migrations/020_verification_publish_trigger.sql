-- 020_verification_publish_trigger.sql
-- =============================================================================
-- HARD BACKSTOP: a campaign may only be INSERTed when the owner's creator
-- verification is approved.
--
-- Why:
--   Phase 1 makes creator verification mandatory before a creator can publish
--   or receive funds. The primary enforcement is the POST /api/projects route
--   (withVerified → 403). But publishing was historically a direct client-side
--   insert (lib/projects.js createProject), and RLS only scopes inserts to
--   auth.uid() = owner_id — it has no verification condition. This trigger is
--   the database-level guarantee that an unverified owner can never create a
--   campaign row, regardless of which client/route performs the insert.
--
-- SECURITY DEFINER: the function reads the OWNER's creator_verifications row,
-- which may differ from the inserting caller (e.g. a donor inserting for their
-- own project, or the service-role API). Running as the function owner bypasses
-- RLS so the check always sees the owner's true verification status.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.require_verified_creator_to_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ownerless rows (no owner to verify) are not campaign publishes; let other
  -- constraints handle them.
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.creator_verifications
    WHERE user_id = NEW.owner_id
      AND verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Creator verification required to publish a campaign';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_verified_creator_to_publish ON public.projects;

CREATE TRIGGER trg_require_verified_creator_to_publish
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.require_verified_creator_to_publish();

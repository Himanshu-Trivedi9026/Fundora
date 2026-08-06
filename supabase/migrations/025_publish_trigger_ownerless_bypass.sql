-- 025_publish_trigger_ownerless_bypass.sql
-- =============================================================================
-- Close the owner_id = NULL bypass in the publish backstop (migration 020).
--
-- The migration-020 trigger `require_verified_creator_to_publish` returned
-- early for any row whose owner_id was NULL:
--
--   IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
--
-- Combined with the projects INSERT policy (017) that accepts
-- `auth.uid() = creator_id`, an unverified user could insert a campaign with
-- { owner_id: NULL, creator_id: <self> } and skip the verification check
-- entirely, publishing a publicly-listed campaign without being approved.
--
-- Fix: verify the effective publisher — owner_id when set, otherwise the
-- row's creator_id. A row with neither (system/placeholder rows, not campaign
-- publishes) is still allowed through. Verified creators (owner_id = their id,
-- status approved) are unaffected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.require_verified_creator_to_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _publisher uuid;
BEGIN
  -- The publisher is the owner when set, otherwise the creator. A row with
  -- neither is not a campaign publish and is left to other constraints.
  _publisher := COALESCE(NEW.owner_id, NEW.creator_id);

  IF _publisher IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.creator_verifications
    WHERE user_id = _publisher
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

-- ============================================================
-- Fundora — Verification "suspended" status (Phase C)
-- ============================================================
-- Adds the admin "Suspend Verification" action to the verification
-- lifecycle. Suspension is represented by a 'suspended' value on:
--   * creator_verifications.verification_status  (overall creator state)
--   * verification_requests.status               (per-submission state)
--   * verification_history.old_status / new_status (timeline)
--
-- Every statement is idempotent: drop the old CHECK, re-add it with the
-- extra value. Safe to run on fresh and existing databases.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. creator_verifications.verification_status
-- ────────────────────────────────────────────────────────────
ALTER TABLE creator_verifications
  DROP CONSTRAINT IF EXISTS creator_verifications_verification_status_check;

ALTER TABLE creator_verifications
  ADD CONSTRAINT creator_verifications_verification_status_check
    CHECK (verification_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled',
      'suspended'
    ));

-- ────────────────────────────────────────────────────────────
-- 2. verification_requests.status
-- ────────────────────────────────────────────────────────────
ALTER TABLE verification_requests
  DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE verification_requests
  ADD CONSTRAINT verification_requests_status_check
    CHECK (status IN (
      'draft', 'submitted', 'documents_uploaded',
      'automatic_validation', 'processing',
      'under_review', 'manual_review',
      'approved', 'rejected', 'cancelled', 'expired',
      'suspended'
    ));

-- ────────────────────────────────────────────────────────────
-- 3. verification_history.old_status / new_status
-- ────────────────────────────────────────────────────────────
ALTER TABLE verification_history
  DROP CONSTRAINT IF EXISTS verification_history_old_status_check;

ALTER TABLE verification_history
  ADD CONSTRAINT verification_history_old_status_check
    CHECK (old_status IS NULL OR old_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled',
      'suspended'
    ));

ALTER TABLE verification_history
  DROP CONSTRAINT IF EXISTS verification_history_new_status_check;

ALTER TABLE verification_history
  ADD CONSTRAINT verification_history_new_status_check
    CHECK (new_status IS NULL OR new_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled',
      'suspended'
    ));

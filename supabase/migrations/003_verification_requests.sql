-- ============================================================
-- Fundora — Verification Requests, Sessions & Audit (Phase 3)
-- ============================================================
-- New tables: verification_requests, verification_sessions,
-- verification_otp, verification_audit_log.
-- Extends: creator_verifications (richer statuses),
-- verification_documents (encrypted metadata),
-- verification_history (extended action types).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. EXTEND existing tables
-- ────────────────────────────────────────────────────────────

-- 0a. Extend creator_verifications verification_status CHECK
--     Old: pending, under_review, approved, rejected, expired
--     New: + documents_uploaded, automatic_validation, manual_review, cancelled
--     Strategy: drop old constraint, add new one
ALTER TABLE creator_verifications
  DROP CONSTRAINT IF EXISTS creator_verifications_verification_status_check;

ALTER TABLE creator_verifications
  ADD CONSTRAINT creator_verifications_verification_status_check
    CHECK (verification_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled'
    ));

-- 0b. Extend verification_documents — encrypted metadata columns
ALTER TABLE verification_documents
  ADD COLUMN IF NOT EXISTS metadata_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS metadata_hash TEXT;

-- 0c. Extend verification_history — add new action types
--     Must drop and recreate the CHECK constraint
ALTER TABLE verification_history
  DROP CONSTRAINT IF EXISTS verification_history_action_check;

ALTER TABLE verification_history
  ADD CONSTRAINT verification_history_action_check
    CHECK (action IN (
      'created', 'submitted', 'under_review',
      'approved', 'rejected', 'expired',
      'level_changed', 'document_uploaded',
      'document_verified', 'document_rejected',
      'trust_score_updated', 'risk_score_updated',
      'resubmitted', 'notes_updated',
      'provider_changed',
      -- Phase 3 additions
      'otp_sent', 'otp_verified', 'otp_failed',
      'documents_uploaded', 'automatic_validation_started',
      'automatic_validation_passed', 'automatic_validation_failed',
      'manual_review_assigned', 'manual_review_completed',
      'session_started', 'session_resumed', 'session_completed',
      'device_metadata_captured', 'review_priority_changed',
      'ocr_extraction_started', 'ocr_extraction_completed',
      'selfie_captured', 'selfie_validation_passed', 'selfie_validation_failed'
    ));

-- Extend verification_history old_status / new_status CHECK
ALTER TABLE verification_history
  DROP CONSTRAINT IF EXISTS verification_history_old_status_check;

ALTER TABLE verification_history
  ADD CONSTRAINT verification_history_old_status_check
    CHECK (old_status IS NULL OR old_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled'
    ));

ALTER TABLE verification_history
  DROP CONSTRAINT IF EXISTS verification_history_new_status_check;

ALTER TABLE verification_history
  ADD CONSTRAINT verification_history_new_status_check
    CHECK (new_status IS NULL OR new_status IN (
      'pending', 'documents_uploaded', 'automatic_validation',
      'under_review', 'manual_review',
      'approved', 'rejected', 'expired', 'cancelled'
    ));

-- ────────────────────────────────────────────────────────────
-- 1. VERIFICATION REQUESTS
-- ────────────────────────────────────────────────────────────
-- Tracks individual verification requests (one per type per user lifecycle).
CREATE TABLE IF NOT EXISTS verification_requests (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_id       UUID REFERENCES creator_verifications(id) ON DELETE SET NULL,

  -- Request type
  verification_type     TEXT NOT NULL
                          CHECK (verification_type IN (
                            'identity', 'phone', 'bank',
                            'business', 'address', 'selfie'
                          )),

  -- Wizard progress
  current_step          TEXT NOT NULL DEFAULT 'draft',

  -- Status (rich lifecycle)
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft', 'submitted', 'documents_uploaded',
                            'automatic_validation', 'processing',
                            'under_review', 'manual_review',
                            'approved', 'rejected', 'cancelled', 'expired'
                          )),

  -- Provider integration
  provider              TEXT,
  provider_reference    TEXT,        -- never exposed to frontend

  -- Review
  reviewer_id           UUID,
  review_priority       TEXT NOT NULL DEFAULT 'normal'
                          CHECK (review_priority IN ('low', 'normal', 'high', 'urgent')),

  -- Rejection
  rejection_reason      TEXT,

  -- Timestamps
  submitted_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Structured data (device_metadata lives inside this JSONB)
  metadata              JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id
  ON verification_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
  ON verification_requests(status);

CREATE INDEX IF NOT EXISTS idx_verification_requests_type
  ON verification_requests(verification_type);

CREATE INDEX IF NOT EXISTS idx_verification_requests_priority
  ON verification_requests(review_priority, submitted_at ASC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_verification_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_requests_updated_at ON verification_requests;
CREATE TRIGGER trigger_verification_requests_updated_at
  BEFORE UPDATE ON verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_requests_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. VERIFICATION SESSIONS (Resumable Wizard Workflows)
-- ────────────────────────────────────────────────────────────
-- Tracks wizard state so users can close browser and resume.
CREATE TABLE IF NOT EXISTS verification_sessions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_request_id UUID REFERENCES verification_requests(id) ON DELETE SET NULL,

  -- Wizard state
  current_step          TEXT NOT NULL DEFAULT 'email',
  completed_steps       TEXT[] DEFAULT '{}',
  wizard_state          JSONB DEFAULT '{}',     -- encrypted sensitive fields, plain UI prefs

  -- Device metadata (placeholders — never displayed in UI)
  device_metadata       JSONB DEFAULT '{}',
  ip_address_hash       TEXT,                    -- hashed IP (never store raw)

  -- Session lifecycle
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,             -- TTL, default 7 days from creation
  completed             BOOLEAN DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_id
  ON verification_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_request_id
  ON verification_sessions(verification_request_id);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires_at
  ON verification_sessions(expires_at);

-- ────────────────────────────────────────────────────────────
-- 3. VERIFICATION OTP (Phone Verification)
-- ────────────────────────────────────────────────────────────
-- Stores hashed OTPs for phone verification flow.
CREATE TABLE IF NOT EXISTS verification_otp (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone                 TEXT NOT NULL,
  otp_hash              TEXT NOT NULL,           -- SHA-256 of the OTP

  attempts              INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 3,

  expires_at            TIMESTAMPTZ NOT NULL,
  verified              BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_otp_user_id
  ON verification_otp(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_otp_phone
  ON verification_otp(phone);

-- ────────────────────────────────────────────────────────────
-- 4. VERIFICATION AUDIT LOG (E7 — Comprehensive)
-- ────────────────────────────────────────────────────────────
-- Append-only audit trail for every verification action.
CREATE TABLE IF NOT EXISTS verification_audit_log (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  event_type            TEXT NOT NULL,           -- 'verification.action' pattern
  entity_type           TEXT NOT NULL            -- 'verification_request', 'document', 'session', 'otp'
                          CHECK (entity_type IN (
                            'verification_request', 'document',
                            'session', 'otp', 'creator_verification'
                          )),
  entity_id             UUID NOT NULL,

  user_id               UUID REFERENCES auth.users(id),

  action                TEXT NOT NULL,           -- granular action name
  details               JSONB DEFAULT '{}',      -- sanitized action details

  ip_address_hash       TEXT,
  user_agent            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON verification_audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON verification_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON verification_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON verification_audit_log(action);

-- Immutability: revoke UPDATE/DELETE from authenticated role
REVOKE UPDATE, DELETE ON verification_audit_log FROM authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- verification_requests
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON verification_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
  ON verification_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requests"
  ON verification_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on requests"
  ON verification_requests
  FOR ALL
  USING (auth.role() = 'service_role');

-- verification_sessions
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON verification_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON verification_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON verification_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on sessions"
  ON verification_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- verification_otp
ALTER TABLE verification_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs"
  ON verification_otp
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on OTPs"
  ON verification_otp
  FOR ALL
  USING (auth.role() = 'service_role');

-- verification_audit_log
ALTER TABLE verification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit entries"
  ON verification_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts audit entries"
  ON verification_audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- No UPDATE or DELETE policies for authenticated users (immutable)

-- ────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- 6a. Get active (non-expired) session for a user
CREATE OR REPLACE FUNCTION get_active_session(p_user_id UUID)
RETURNS TABLE (
  id                      UUID,
  current_step            TEXT,
  completed_steps         TEXT[],
  verification_request_id UUID,
  last_active_at          TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.id, vs.current_step, vs.completed_steps,
    vs.verification_request_id, vs.last_active_at
  FROM verification_sessions vs
  WHERE vs.user_id = p_user_id
    AND vs.completed = FALSE
    AND (vs.expires_at IS NULL OR vs.expires_at > NOW())
  ORDER BY vs.last_active_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6b. Cleanup expired sessions (call via cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM verification_sessions
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW()
    AND completed = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6c. Cleanup expired OTPs (call via cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM verification_otp
  WHERE expires_at < NOW()
    AND verified = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

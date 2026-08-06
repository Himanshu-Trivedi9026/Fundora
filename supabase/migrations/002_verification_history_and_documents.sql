-- ============================================================
-- Fundora — Verification History & Documents (Phase 2 Hardening)
-- ============================================================
-- Immutable audit log + document storage tables.
-- Extends creator_verifications with expiry support.
-- ============================================================

-- 0. EXTEND creator_verifications with expiry columns
ALTER TABLE creator_verifications
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_status TEXT DEFAULT 'not_verified'
    CHECK (expiry_status IN ('not_verified', 'valid', 'expiring_soon', 'expired'));

-- 1. VERIFICATION HISTORY (Immutable audit log)
-- Every status/level change creates a history record.
-- History is append-only: no UPDATE, no DELETE by application.
CREATE TABLE IF NOT EXISTS verification_history (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links to the verification record
  verification_id     UUID NOT NULL REFERENCES creator_verifications(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Change tracking
  action              TEXT NOT NULL
                        CHECK (action IN (
                          'created', 'submitted', 'under_review',
                          'approved', 'rejected', 'expired',
                          'level_changed', 'document_uploaded',
                          'document_verified', 'document_rejected',
                          'trust_score_updated', 'risk_score_updated',
                          'resubmitted', 'notes_updated',
                          'provider_changed'
                        )),

  -- State before change
  old_status          TEXT
                        CHECK (old_status IS NULL OR old_status IN (
                          'pending', 'under_review', 'approved', 'rejected', 'expired'
                        )),
  new_status          TEXT
                        CHECK (new_status IS NULL OR new_status IN (
                          'pending', 'under_review', 'approved', 'rejected', 'expired'
                        )),

  old_level           INTEGER CHECK (old_level IS NULL OR (old_level >= 0 AND old_level <= 5)),
  new_level           INTEGER CHECK (new_level IS NULL OR (new_level >= 0 AND new_level <= 5)),

  -- Who performed the action
  performed_by        UUID,           -- user_id of admin/system (NULL for system)
  performed_by_type   TEXT NOT NULL DEFAULT 'system'
                        CHECK (performed_by_type IN ('system', 'user', 'admin', 'provider')),

  -- Context
  reason              TEXT,           -- Why this change happened
  metadata            JSONB DEFAULT '{}',  -- Additional structured data

  -- Timestamp (immutable after creation)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. VERIFICATION DOCUMENTS
-- Stores references to uploaded identity documents.
-- No public URLs — only storage paths.
CREATE TABLE IF NOT EXISTS verification_documents (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links
  verification_id     UUID NOT NULL REFERENCES creator_verifications(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Document classification
  document_type       TEXT NOT NULL
                        CHECK (document_type IN (
                          'pan_card', 'aadhaar_card', 'passport',
                          'driving_license', 'voter_id',
                          'business_registration', 'gst_certificate',
                          'bank_statement', 'bank_passbook',
                          'selfie', 'utility_bill',
                          'other'
                        )),
  document_name       TEXT NOT NULL,          -- Original filename

  -- Storage (never expose raw paths to frontend)
  storage_bucket      TEXT NOT NULL,          -- Supabase Storage bucket
  storage_path        TEXT NOT NULL,          -- Storage path (encrypted at rest)

  -- File metadata
  mime_type           TEXT NOT NULL,
  file_size           INTEGER NOT NULL,       -- Bytes

  -- Status
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending', 'uploaded', 'verified', 'rejected', 'expired'
                        )),
  rejection_reason    TEXT,

  -- Provider integration
  provider_reference  TEXT,                   -- Provider's reference (never exposed)

  -- Timestamps
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,            -- Document expiry (e.g., passport)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_verification_history_verification_id
  ON verification_history(verification_id);

CREATE INDEX IF NOT EXISTS idx_verification_history_user_id
  ON verification_history(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_history_action
  ON verification_history(action);

CREATE INDEX IF NOT EXISTS idx_verification_history_created_at
  ON verification_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id
  ON verification_documents(verification_id);

CREATE INDEX IF NOT EXISTS idx_verification_documents_user_id
  ON verification_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_documents_status
  ON verification_documents(status);

CREATE INDEX IF NOT EXISTS idx_verification_documents_type
  ON verification_documents(document_type);

-- 4. UPDATED_AT TRIGGER for verification_documents
CREATE OR REPLACE FUNCTION update_verification_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_documents_updated_at ON verification_documents;
CREATE TRIGGER trigger_verification_documents_updated_at
  BEFORE UPDATE ON verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_documents_updated_at();

-- 5. IMMUTABILITY ENFORCEMENT
-- Prevent UPDATE and DELETE on verification_history by application users.
-- Only service role can modify history (for emergency corrections).

-- Revoke UPDATE/DELETE from authenticated role
REVOKE UPDATE, DELETE ON verification_history FROM authenticated;

-- 6. ROW LEVEL SECURITY

-- verification_history
ALTER TABLE verification_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own history
CREATE POLICY "Users can view own history"
  ON verification_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert history (system events)
CREATE POLICY "Service role inserts history"
  ON verification_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- No UPDATE or DELETE policies for authenticated users (immutable)

-- verification_documents
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- Users can read their own documents
CREATE POLICY "Users can view own documents"
  ON verification_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents"
  ON verification_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents (for status changes during upload flow)
CREATE POLICY "Users can update own documents"
  ON verification_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access (for admin review, provider callbacks)
CREATE POLICY "Service role full access on documents"
  ON verification_documents
  FOR ALL
  USING (auth.role() = 'service_role');

-- 7. HELPER: Record a history event (called by service role or triggers)
CREATE OR REPLACE FUNCTION record_verification_event(
  p_verification_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_old_level INTEGER DEFAULT NULL,
  p_new_level INTEGER DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_performed_by_type TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO verification_history (
    verification_id, user_id, action,
    old_status, new_status,
    old_level, new_level,
    performed_by, performed_by_type,
    reason, metadata
  ) VALUES (
    p_verification_id, p_user_id, p_action,
    p_old_status, p_new_status,
    p_old_level, p_new_level,
    p_performed_by, p_performed_by_type,
    p_reason, p_metadata
  ) RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. HELPER: Get public verification summary (safe for profiles)
-- Returns ONLY non-sensitive fields. Never returns provider_reference, documents, etc.
CREATE OR REPLACE FUNCTION get_public_verification(target_user_id UUID)
RETURNS TABLE (
  verification_level INTEGER,
  verification_status TEXT,
  trust_score INTEGER,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cv.verification_level,
    cv.verification_status,
    cv.trust_score,
    cv.verified_at,
    cv.created_at
  FROM creator_verifications cv
  WHERE cv.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. HELPER: Get verification expiry status
CREATE OR REPLACE FUNCTION get_verification_expiry_status(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_verified_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  SELECT verified_at INTO v_verified_at
  FROM creator_verifications
  WHERE user_id = target_user_id;

  IF NOT FOUND OR v_verified_at IS NULL THEN
    RETURN 'not_verified';
  END IF;

  -- Check document expiry (earliest expiring document)
  SELECT MIN(expires_at) INTO v_expires_at
  FROM verification_documents
  WHERE user_id = target_user_id
    AND status = 'verified'
    AND expires_at IS NOT NULL;

  IF v_expires_at IS NULL THEN
    RETURN 'valid';
  END IF;

  IF v_expires_at < NOW() THEN
    RETURN 'expired';
  ELSIF v_expires_at < NOW() + INTERVAL '30 days' THEN
    RETURN 'expiring_soon';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

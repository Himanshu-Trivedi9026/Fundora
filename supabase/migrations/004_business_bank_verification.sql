-- ============================================================
-- Fundora — Business & Bank Verification (Phase 4)
-- ============================================================
-- New tables: business_verifications, business_documents,
-- bank_accounts, bank_verifications, verification_providers,
-- verification_events.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BUSINESS VERIFICATIONS
-- ────────────────────────────────────────────────────────────
-- 1:1 with creator_verifications. Stores business details.
CREATE TABLE IF NOT EXISTS business_verifications (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_id       UUID NOT NULL REFERENCES creator_verifications(id) ON DELETE CASCADE,

  -- Business details
  business_name         TEXT NOT NULL,
  business_type         TEXT NOT NULL
                          CHECK (business_type IN (
                            'individual', 'sole_proprietorship', 'partnership', 'llp',
                            'private_limited', 'public_limited', 'ngo', 'trust',
                            'society', 'startup', 'government'
                          )),

  -- Registration numbers (encrypted at application level)
  gst_number            TEXT,
  pan_number            TEXT,
  cin_number            TEXT,

  -- Business address (JSONB for flexibility)
  incorporation_date    DATE,
  business_address      JSONB,

  -- Status workflow
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending', 'documents_uploaded', 'under_review',
                            'approved', 'rejected', 'resubmission_required'
                          )),

  -- Provider integration
  verification_provider TEXT,
  provider_reference    TEXT,

  -- Encrypted metadata
  metadata_encrypted    BYTEA,
  metadata_hash         TEXT,

  -- Timestamps
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One business verification per user
  UNIQUE(user_id),
  UNIQUE(verification_id)
);

-- ────────────────────────────────────────────────────────────
-- 2. BUSINESS DOCUMENTS
-- ────────────────────────────────────────────────────────────
-- 1:many with business_verifications.
CREATE TABLE IF NOT EXISTS business_documents (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_verification_id    UUID NOT NULL REFERENCES business_verifications(id) ON DELETE CASCADE,
  verification_id             UUID NOT NULL REFERENCES creator_verifications(id) ON DELETE CASCADE,

  -- Document details
  document_type               TEXT NOT NULL
                                CHECK (document_type IN (
                                  'gst_certificate', 'pan_card', 'certificate_of_incorporation',
                                  'udyam_registration', 'trade_license', 'msme_certificate',
                                  'partnership_deed', 'trust_registration', 'society_registration',
                                  'moa', 'aoa', 'cancelled_cheque', 'bank_statement',
                                  'address_proof', 'business_address_proof',
                                  'director_identity_proof', 'director_address_proof'
                                )),
  document_name               TEXT NOT NULL,
  storage_bucket              TEXT NOT NULL DEFAULT 'verification-docs',
  storage_path                TEXT NOT NULL,
  mime_type                   TEXT NOT NULL,
  file_size                   INTEGER NOT NULL,

  -- Validation status
  status                      TEXT NOT NULL DEFAULT 'uploaded'
                                CHECK (status IN (
                                  'uploaded', 'validating', 'validated',
                                  'rejected', 'expired'
                                )),

  -- Provider integration
  provider_reference          TEXT,

  -- Encrypted metadata
  metadata_encrypted          BYTEA,
  metadata_hash               TEXT,

  -- Review
  verification_notes          TEXT,

  -- Timestamps
  uploaded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at                 TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. BANK ACCOUNTS
-- ────────────────────────────────────────────────────────────
-- 1:many per user. Full account lifecycle.
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Account details
  account_holder_name       TEXT NOT NULL,
  account_number_encrypted  BYTEA NOT NULL,
  ifsc_code                 TEXT NOT NULL,
  bank_name                 TEXT,
  branch_name               TEXT,
  account_type              TEXT
                              CHECK (account_type IN ('savings', 'current', 'salary')),
  upi_id                    TEXT,

  -- Primary account flag
  is_primary                BOOLEAN NOT NULL DEFAULT TRUE,

  -- Status lifecycle: draft → pending → verified → rejected → disabled → archived
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft', 'pending', 'verified',
                                'rejected', 'disabled', 'archived'
                              )),

  -- Provider integration
  verification_provider     TEXT,
  provider_reference        TEXT,

  -- Penny drop verification
  penny_drop_status         TEXT
                              CHECK (penny_drop_status IN (
                                'pending', 'initiated', 'success', 'failed', 'skipped'
                              )),
  penny_drop_verified_at    TIMESTAMPTZ,

  -- Supporting documents
  cancelled_cheque_path     TEXT,
  passbook_path             TEXT,

  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. BANK VERIFICATIONS
-- ────────────────────────────────────────────────────────────
-- 1:1 with creator_verifications. Summary of bank verification.
CREATE TABLE IF NOT EXISTS bank_verifications (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_id       UUID NOT NULL REFERENCES creator_verifications(id) ON DELETE CASCADE,

  -- Status
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending', 'documents_uploaded', 'under_review',
                            'approved', 'rejected', 'resubmission_required'
                          )),

  -- Account counts
  total_accounts        INTEGER NOT NULL DEFAULT 0,
  verified_accounts     INTEGER NOT NULL DEFAULT 0,
  primary_account_id    UUID REFERENCES bank_accounts(id),

  -- Provider integration
  verification_provider TEXT,
  provider_reference    TEXT,

  -- Encrypted metadata
  metadata_encrypted    BYTEA,
  metadata_hash         TEXT,

  -- Timestamps
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One bank verification per user
  UNIQUE(user_id),
  UNIQUE(verification_id)
);

-- ────────────────────────────────────────────────────────────
-- 5. VERIFICATION PROVIDERS
-- ────────────────────────────────────────────────────────────
-- Registry of provider configs.
CREATE TABLE IF NOT EXISTS verification_providers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL
                    CHECK (type IN (
                      'kyc', 'ocr', 'penny_drop',
                      'business_verification', 'bank_verification',
                      'gst_verification', 'pan_verification',
                      'face_verification'
                    )),
  config          JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 6. VERIFICATION EVENTS
-- ────────────────────────────────────────────────────────────
-- Unified event log for all verification types.
CREATE TABLE IF NOT EXISTS verification_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL
                    CHECK (entity_type IN (
                      'creator_verification', 'business_verification',
                      'bank_verification', 'business_document',
                      'bank_account', 'verification_request'
                    )),
  entity_id       UUID NOT NULL,

  -- Status changes
  old_status      TEXT,
  new_status      TEXT,
  old_level       INTEGER,
  new_level       INTEGER,

  -- Actor
  performed_by    UUID,
  performed_by_type TEXT
                      CHECK (performed_by_type IN ('system', 'user', 'admin', 'provider')),

  -- Details
  details         JSONB,

  -- Timestamp
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. INDEXES
-- ────────────────────────────────────────────────────────────

-- business_verifications
CREATE INDEX IF NOT EXISTS idx_business_verifications_user_id
  ON business_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_business_verifications_status
  ON business_verifications(status);

-- business_documents
CREATE INDEX IF NOT EXISTS idx_business_documents_user_id
  ON business_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_verification_id
  ON business_documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_business_verification_id
  ON business_documents(business_verification_id);

-- bank_accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id
  ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_status
  ON bank_accounts(status);

-- bank_verifications
CREATE INDEX IF NOT EXISTS idx_bank_verifications_user_id
  ON bank_verifications(user_id);

-- verification_providers
CREATE INDEX IF NOT EXISTS idx_verification_providers_type
  ON verification_providers(type);

-- verification_events
CREATE INDEX IF NOT EXISTS idx_verification_events_user_id
  ON verification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_entity
  ON verification_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_created_at
  ON verification_events(created_at);

-- ────────────────────────────────────────────────────────────
-- 8. UPDATED_AT TRIGGERS
-- ────────────────────────────────────────────────────────────

-- Generic updated_at function (reuse if already exists from 001/002/003)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- business_verifications
DROP TRIGGER IF EXISTS trigger_business_verifications_updated_at ON business_verifications;
CREATE TRIGGER trigger_business_verifications_updated_at
  BEFORE UPDATE ON business_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- business_documents
DROP TRIGGER IF EXISTS trigger_business_documents_updated_at ON business_documents;
CREATE TRIGGER trigger_business_documents_updated_at
  BEFORE UPDATE ON business_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- bank_accounts
DROP TRIGGER IF EXISTS trigger_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- bank_verifications
DROP TRIGGER IF EXISTS trigger_bank_verifications_updated_at ON bank_verifications;
CREATE TRIGGER trigger_bank_verifications_updated_at
  BEFORE UPDATE ON bank_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- verification_providers
DROP TRIGGER IF EXISTS trigger_verification_providers_updated_at ON verification_providers;
CREATE TRIGGER trigger_verification_providers_updated_at
  BEFORE UPDATE ON verification_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- 9a. business_verifications
ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business verification"
  ON business_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business verification"
  ON business_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business verification"
  ON business_verifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on business_verifications"
  ON business_verifications FOR ALL
  USING (auth.role() = 'service_role');

-- 9b. business_documents
ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business documents"
  ON business_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business documents"
  ON business_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business documents"
  ON business_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on business_documents"
  ON business_documents FOR ALL
  USING (auth.role() = 'service_role');

-- 9c. bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on bank_accounts"
  ON bank_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- 9d. bank_verifications
ALTER TABLE bank_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank verification"
  ON bank_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank verification"
  ON bank_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank verification"
  ON bank_verifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on bank_verifications"
  ON bank_verifications FOR ALL
  USING (auth.role() = 'service_role');

-- 9e. verification_providers
ALTER TABLE verification_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active providers"
  ON verification_providers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Service role full access on verification_providers"
  ON verification_providers FOR ALL
  USING (auth.role() = 'service_role');

-- 9f. verification_events
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification events"
  ON verification_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on verification_events"
  ON verification_events FOR ALL
  USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 10. HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Get business verification summary (safe for public profiles)
CREATE OR REPLACE FUNCTION get_business_verification_summary(target_user_id UUID)
RETURNS TABLE (
  business_name TEXT,
  business_type TEXT,
  status TEXT,
  verified_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bv.business_name,
    bv.business_type,
    bv.status,
    bv.verified_at
  FROM business_verifications bv
  WHERE bv.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get bank verification summary (safe for public profiles)
CREATE OR REPLACE FUNCTION get_bank_verification_summary(target_user_id UUID)
RETURNS TABLE (
  status TEXT,
  total_accounts INTEGER,
  verified_accounts INTEGER,
  verified_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bkv.status,
    bkv.total_accounts,
    bkv.verified_accounts,
    bkv.verified_at
  FROM bank_verifications bkv
  WHERE bkv.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate bank verification counts
CREATE OR REPLACE FUNCTION recalculate_bank_verification(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE bank_verifications
  SET
    total_accounts = (
      SELECT COUNT(*) FROM bank_accounts
      WHERE user_id = target_user_id AND status != 'archived'
    ),
    verified_accounts = (
      SELECT COUNT(*) FROM bank_accounts
      WHERE user_id = target_user_id AND status = 'verified'
    ),
    updated_at = NOW()
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

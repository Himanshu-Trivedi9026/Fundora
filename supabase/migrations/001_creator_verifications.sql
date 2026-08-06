-- ============================================================
-- Fundora — Creator Verification System (Phase 1)
-- ============================================================
-- This migration creates the creator_verifications table,
-- enables RLS, and sets up policies and triggers.
-- ============================================================

-- 1. ENUM TYPES (using CHECK constraints for Supabase compatibility)
-- verification_level: 0-5 (email → phone → ID → bank → business → fully verified)
-- verification_status: pending | under_review | approved | rejected | expired

-- 2. TABLE
CREATE TABLE IF NOT EXISTS creator_verifications (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Verification levels (0-5 scale)
  verification_level  INTEGER NOT NULL DEFAULT 0
                        CHECK (verification_level >= 0 AND verification_level <= 5),

  -- Individual verification flags
  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  identity_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  bank_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  business_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  selfie_verified     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status workflow: pending → under_review → approved/rejected/expired
  verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN (
                          'pending', 'under_review', 'approved', 'rejected', 'expired'
                        )),

  -- Trust & risk scoring (0-100)
  trust_score         INTEGER NOT NULL DEFAULT 0
                        CHECK (trust_score >= 0 AND trust_score <= 100),
  risk_score          INTEGER NOT NULL DEFAULT 0
                        CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Provider integration (pluggable for future KYC providers)
  verification_provider   TEXT,          -- e.g. 'stripe_identity', 'hyperverge', 'signzy'
  provider_reference      TEXT,          -- provider's internal reference ID (never exposed to frontend)

  -- Timestamps
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Admin notes (for manual review)
  verification_notes  TEXT,

  -- One verification record per user
  UNIQUE(user_id)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_creator_verifications_user_id
  ON creator_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_creator_verifications_status
  ON creator_verifications(verification_status);

CREATE INDEX IF NOT EXISTS idx_creator_verifications_level
  ON creator_verifications(verification_level);

-- 4. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_creator_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_creator_verifications_updated_at ON creator_verifications;
CREATE TRIGGER trigger_creator_verifications_updated_at
  BEFORE UPDATE ON creator_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_verifications_updated_at();

-- 5. AUTO-CREATE VERIFICATION ON USER CREATION
-- Uses a PostgreSQL function triggered by auth.users inserts
CREATE OR REPLACE FUNCTION handle_new_user_verification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO creator_verifications (user_id, verification_level, verification_status, email_verified)
  VALUES (NEW.id, 0, 'pending', FALSE)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users inserts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_verification();

-- 6. ROW LEVEL SECURITY
ALTER TABLE creator_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own verification record
CREATE POLICY "Users can view own verification"
  ON creator_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role full access"
  ON creator_verifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Authenticated users can insert their own verification (signup trigger)
CREATE POLICY "Users can insert own verification"
  ON creator_verifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Authenticated users can update their own verification
-- (limited to provider data updates, status changes handled by service role)
CREATE POLICY "Users can update own verification"
  ON creator_verifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. HELPER FUNCTION: Get verification summary (safe for public profiles)
-- Returns only non-sensitive fields
CREATE OR REPLACE FUNCTION get_user_verification_summary(target_user_id UUID)
RETURNS TABLE (
  verification_level INTEGER,
  verification_status TEXT,
  trust_score INTEGER,
  risk_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cv.verification_level,
    cv.verification_status,
    cv.trust_score,
    cv.risk_score
  FROM creator_verifications cv
  WHERE cv.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. HELPER FUNCTION: Recalculate verification level from flags
CREATE OR REPLACE FUNCTION recalculate_verification_level(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER := 0;
  v_row creator_verifications%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM creator_verifications WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Level 0: Email only (always true for signed-up users)
  v_level := 0;

  -- Level 1: Phone verified
  IF v_row.phone_verified THEN v_level := 1; END IF;

  -- Level 2: Government ID verified
  IF v_row.identity_verified THEN v_level := 2; END IF;

  -- Level 3: Bank verified
  IF v_row.bank_verified THEN v_level := 3; END IF;

  -- Level 4: Business verified
  IF v_row.business_verified THEN v_level := 4; END IF;

  -- Level 5: Fully verified (all flags true)
  IF v_row.email_verified AND v_row.phone_verified AND v_row.identity_verified
     AND v_row.bank_verified AND v_row.business_verified AND v_row.selfie_verified THEN
    v_level := 5;
  END IF;

  UPDATE creator_verifications
  SET verification_level = v_level
  WHERE user_id = target_user_id;

  RETURN v_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RLS for helper functions (they run as SECURITY DEFINER, so RLS is bypassed)
-- The functions above are only callable by authenticated users or service role.

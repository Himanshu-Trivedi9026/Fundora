-- Migration: 005_fraud_detection.sql
-- Phase 5: AI Fraud Detection & Risk Engine
-- Creates fraud_profiles, fraud_events, risk_signals, risk_scores,
-- device_fingerprints, behavior_events, fraud_rules, fraud_rule_hits,
-- manual_overrides tables with RLS, indexes, constraints, triggers.

-- ─── Fraud Profiles ───
-- One per user. Stores aggregate fraud risk data.
CREATE TABLE IF NOT EXISTS fraud_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  verification_level INTEGER NOT NULL DEFAULT 0 CHECK (verification_level >= 0 AND verification_level <= 5),
  decision TEXT NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow', 'monitor', 'manual_review', 'limit', 'block', 'escalate')),
  total_events INTEGER NOT NULL DEFAULT 0,
  total_rule_hits INTEGER NOT NULL DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  manual_override_reason TEXT,
  manual_override_by UUID,
  manual_override_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── Fraud Events ───
-- Individual fraud-related events (one per action/occurrence).
CREATE TABLE IF NOT EXISTS fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('verification', 'donation', 'payout', 'account', 'campaign', 'device', 'behavior', 'system')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  signal_name TEXT,
  signal_value JSONB,
  risk_contribution INTEGER DEFAULT 0 CHECK (risk_contribution >= 0 AND risk_contribution <= 100),
  rule_ids TEXT[] DEFAULT '{}',
  device_fingerprint_id UUID,
  ip_address_hash TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Risk Signals ───
-- Configurable risk signal definitions and their current values per user.
CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_name TEXT NOT NULL,
  signal_category TEXT NOT NULL CHECK (signal_category IN ('identity', 'verification', 'behavior', 'device', 'velocity', 'duplicate', 'reputation', 'external')),
  signal_value JSONB NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, signal_name)
);

-- ─── Risk Scores ───
-- Historical risk score snapshots for trend analysis.
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  trust_score INTEGER NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
  verification_level INTEGER NOT NULL CHECK (verification_level >= 0 AND verification_level <= 5),
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'monitor', 'manual_review', 'limit', 'block', 'escalate')),
  signals_summary JSONB DEFAULT '{}',
  rules_triggered TEXT[] DEFAULT '{}',
  ai_analysis JSONB,
  calculation_method TEXT NOT NULL DEFAULT 'rule_engine' CHECK (calculation_method IN ('rule_engine', 'ai_analysis', 'manual_override')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Device Fingerprints ───
-- Hashed device/browser fingerprints for cross-session tracking.
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint_hash TEXT NOT NULL,
  browser TEXT,
  platform TEXT,
  timezone TEXT,
  language TEXT,
  screen_resolution TEXT,
  user_agent TEXT,
  canvas_hash TEXT,
  webgl_hash TEXT,
  fonts_hash TEXT,
  is_known BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_count INTEGER NOT NULL DEFAULT 1,
  risk_flags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Behavior Events ───
-- Tracks user behavior patterns for anomaly detection.
CREATE TABLE IF NOT EXISTS behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('login', 'verification', 'campaign', 'donation', 'document', 'account', 'profile', 'session')),
  event_data JSONB DEFAULT '{}',
  ip_address_hash TEXT,
  user_agent TEXT,
  device_fingerprint_id UUID REFERENCES device_fingerprints(id) ON DELETE SET NULL,
  session_id TEXT,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Fraud Rules ───
-- Configurable fraud detection rules.
CREATE TABLE IF NOT EXISTS fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  rule_description TEXT,
  rule_category TEXT NOT NULL CHECK (rule_category IN ('velocity', 'threshold', 'pattern', 'compound', 'external', 'custom')),
  rule_config JSONB NOT NULL DEFAULT '{}',
  risk_weight INTEGER NOT NULL DEFAULT 10 CHECK (risk_weight >= 0 AND risk_weight <= 100),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  cooldown_minutes INTEGER DEFAULT 60,
  max_triggers_per_user INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Fraud Rule Hits ───
-- Records when a rule fires for a user.
CREATE TABLE IF NOT EXISTS fraud_rule_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES fraud_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_contribution INTEGER NOT NULL DEFAULT 0 CHECK (risk_contribution >= 0 AND risk_contribution <= 100),
  match_data JSONB DEFAULT '{}',
  action_taken TEXT CHECK (action_taken IN ('allow', 'monitor', 'manual_review', 'limit', 'block', 'escalate')),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Manual Overrides ───
-- Admin manual overrides for fraud decisions.
CREATE TABLE IF NOT EXISTS manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('decision', 'risk_score', 'block', 'unblock', 'whitelist', 'blacklist')),
  previous_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_reason TEXT
);

-- ─── Indexes ───

-- fraud_profiles
CREATE INDEX IF NOT EXISTS idx_fraud_profiles_user_id ON fraud_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_profiles_risk_level ON fraud_profiles(risk_level);
CREATE INDEX IF NOT EXISTS idx_fraud_profiles_decision ON fraud_profiles(decision);
CREATE INDEX IF NOT EXISTS idx_fraud_profiles_risk_score ON fraud_profiles(risk_score);

-- fraud_events
CREATE INDEX IF NOT EXISTS idx_fraud_events_user_id ON fraud_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_event_type ON fraud_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fraud_events_event_category ON fraud_events(event_category);
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity ON fraud_events(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_events_created_at ON fraud_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_events_user_created ON fraud_events(user_id, created_at);

-- risk_signals
CREATE INDEX IF NOT EXISTS idx_risk_signals_user_id ON risk_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_signals_signal_name ON risk_signals(signal_name);
CREATE INDEX IF NOT EXISTS idx_risk_signals_category ON risk_signals(signal_category);
CREATE INDEX IF NOT EXISTS idx_risk_signals_user_signal ON risk_signals(user_id, signal_name);

-- risk_scores
CREATE INDEX IF NOT EXISTS idx_risk_scores_user_id ON risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_risk_level ON risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculated_at ON risk_scores(calculated_at);
CREATE INDEX IF NOT EXISTS idx_risk_scores_user_calculated ON risk_scores(user_id, calculated_at);

-- device_fingerprints
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_hash ON device_fingerprints(user_id, fingerprint_hash);

-- behavior_events
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_event_type ON behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_category ON behavior_events(event_category);
CREATE INDEX IF NOT EXISTS idx_behavior_events_created_at ON behavior_events(created_at);
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_created ON behavior_events(user_id, created_at);

-- fraud_rules
CREATE INDEX IF NOT EXISTS idx_fraud_rules_category ON fraud_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_active ON fraud_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_priority ON fraud_rules(priority);

-- fraud_rule_hits
CREATE INDEX IF NOT EXISTS idx_fraud_rule_hits_rule_id ON fraud_rule_hits(rule_id);
CREATE INDEX IF NOT EXISTS idx_fraud_rule_hits_user_id ON fraud_rule_hits(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_rule_hits_resolved ON fraud_rule_hits(resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_rule_hits_user_resolved ON fraud_rule_hits(user_id, resolved);

-- manual_overrides
CREATE INDEX IF NOT EXISTS idx_manual_overrides_user_id ON manual_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_overrides_type ON manual_overrides(override_type);
CREATE INDEX IF NOT EXISTS idx_manual_overrides_active ON manual_overrides(user_id, revoked_at);

-- ─── RLS Policies ───

-- fraud_profiles: Users can only see their own profile. Admins can see all.
ALTER TABLE fraud_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud profile"
  ON fraud_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all fraud profiles"
  ON fraud_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- fraud_events: Users can see their own events. Admins can see all.
ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fraud events"
  ON fraud_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all fraud events"
  ON fraud_events FOR ALL
  USING (auth.role() = 'service_role');

-- risk_signals: Users can see their own signals. Admins can see all.
ALTER TABLE risk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk signals"
  ON risk_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all risk signals"
  ON risk_signals FOR ALL
  USING (auth.role() = 'service_role');

-- risk_scores: Users can see their own scores. Admins can see all.
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk scores"
  ON risk_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all risk scores"
  ON risk_scores FOR ALL
  USING (auth.role() = 'service_role');

-- device_fingerprints: Users can see their own devices. Admins can see all.
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device fingerprints"
  ON device_fingerprints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all device fingerprints"
  ON device_fingerprints FOR ALL
  USING (auth.role() = 'service_role');

-- behavior_events: Users can see their own behavior. Admins can see all.
ALTER TABLE behavior_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own behavior events"
  ON behavior_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all behavior events"
  ON behavior_events FOR ALL
  USING (auth.role() = 'service_role');

-- fraud_rules: Read-only for authenticated users. Admins can manage.
ALTER TABLE fraud_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active fraud rules"
  ON fraud_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage all fraud rules"
  ON fraud_rules FOR ALL
  USING (auth.role() = 'service_role');

-- fraud_rule_hits: Users can see their own hits. Admins can see all.
ALTER TABLE fraud_rule_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rule hits"
  ON fraud_rule_hits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all rule hits"
  ON fraud_rule_hits FOR ALL
  USING (auth.role() = 'service_role');

-- manual_overrides: Users can see overrides on their account. Admins can manage.
ALTER TABLE manual_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view overrides on their account"
  ON manual_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all manual overrides"
  ON manual_overrides FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Triggers ───

-- Auto-update updated_at on fraud_profiles
CREATE OR REPLACE FUNCTION update_fraud_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fraud_profiles_updated_at
  BEFORE UPDATE ON fraud_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_fraud_profiles_updated_at();

-- Auto-update updated_at on risk_signals
CREATE OR REPLACE FUNCTION update_risk_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_risk_signals_updated_at
  BEFORE UPDATE ON risk_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_risk_signals_updated_at();

-- Auto-update updated_at on device_fingerprints
CREATE OR REPLACE FUNCTION update_device_fingerprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_device_fingerprints_updated_at
  BEFORE UPDATE ON device_fingerprints
  FOR EACH ROW
  EXECUTE FUNCTION update_device_fingerprints_updated_at();

-- Auto-update updated_at on fraud_rules
CREATE OR REPLACE FUNCTION update_fraud_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fraud_rules_updated_at
  BEFORE UPDATE ON fraud_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_fraud_rules_updated_at();

-- ─── Default Fraud Rules ───

INSERT INTO fraud_rules (rule_name, rule_description, rule_category, rule_config, risk_weight, risk_level, priority) VALUES
  ('rapid_donations', '5+ donations within 1 hour', 'velocity', '{"event_type": "donation", "count": 5, "window_minutes": 60}', 15, 'high', 10),
  ('failed_verification_spam', '3+ failed verification attempts within 24 hours', 'velocity', '{"event_type": "verification_failed", "count": 3, "window_minutes": 1440}', 20, 'high', 20),
  ('multiple_devices', '3+ unique device fingerprints within 24 hours', 'velocity', '{"event_type": "new_device", "count": 3, "window_minutes": 1440}', 10, 'medium', 5),
  ('rapid_profile_edits', '5+ profile edits within 1 hour', 'velocity', '{"event_type": "profile_edit", "count": 5, "window_minutes": 60}', 8, 'medium', 5),
  ('password_reset_frequency', '3+ password resets within 24 hours', 'velocity', '{"event_type": "password_reset", "count": 3, "window_minutes": 1440}', 12, 'high', 15),
  ('rejected_documents', '2+ rejected documents within 7 days', 'threshold', '{"event_type": "document_rejected", "count": 2, "window_minutes": 10080}', 15, 'high', 10),
  ('multiple_payout_accounts', '3+ bank accounts added within 7 days', 'threshold', '{"event_type": "bank_account_added", "count": 3, "window_minutes": 10080}', 20, 'critical', 25),
  ('duplicate_pan', 'PAN used by multiple users', 'duplicate', '{"field": "pan_number", "max_users": 1}', 25, 'critical', 30),
  ('duplicate_gst', 'GST used by multiple users', 'duplicate', '{"field": "gst_number", "max_users": 1}', 25, 'critical', 30),
  ('duplicate_bank_account', 'Bank account used by multiple users', 'duplicate', '{"field": "account_number", "max_users": 1}', 20, 'high', 25),
  ('duplicate_phone', 'Phone number used by multiple users', 'duplicate', '{"field": "phone", "max_users": 1}', 15, 'high', 20),
  ('duplicate_upi', 'UPI ID used by multiple users', 'duplicate', '{"field": "upi_id", "max_users": 1}', 15, 'high', 20),
  ('ip_country_mismatch', 'IP country differs from verification country', 'pattern', '{"check": "country_mismatch", "weight": 15}', 15, 'medium', 10),
  ('suspicious_email_domain', 'Email from known disposable domain', 'pattern', '{"check": "email_domain", "weight": 10}', 10, 'medium', 5),
  ('low_trust_high_donation', 'Low trust score with large donation', 'compound', '{"trust_threshold": 30, "donation_min": 10000}', 20, 'high', 15),
  ('new_account_high_activity', 'Account < 7 days old with high activity', 'compound', '{"account_age_days": 7, "activity_threshold": 10}', 12, 'medium', 10),
  ('rapid_bank_changes', '3+ bank account changes within 30 days', 'velocity', '{"event_type": "bank_account_changed", "count": 3, "window_minutes": 43200}', 18, 'high', 20),
  ('document_resubmission_loop', 'Same document rejected 3+ times', 'pattern', '{"event_type": "document_resubmitted", "max_rejections": 3}', 15, 'high', 15)
ON CONFLICT (rule_name) DO NOTHING;

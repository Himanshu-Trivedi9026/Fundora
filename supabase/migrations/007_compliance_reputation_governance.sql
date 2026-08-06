-- Migration: 007_compliance_reputation_governance.sql
-- Phase 7: Compliance, Reputation, Governance & Platform Intelligence
-- Creates compliance_cases, compliance_events, policies, policy_versions,
-- creator_reputation, donor_reputation, campaign_reputation, moderation_cases,
-- appeals, notifications, notification_preferences, platform_metrics
-- with RLS, indexes, constraints, triggers.

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: COMPLIANCE TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Compliance Cases ───
-- Investigation cases for KYC, sanctions, fraud, policy violations, etc.
CREATE TABLE IF NOT EXISTS compliance_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  case_type TEXT NOT NULL CHECK (case_type IN (
    'kyc_review',
    'sanctions_hit',
    'fraud_investigation',
    'policy_violation',
    'regulatory_inquiry',
    'suspicious_activity',
    'identity_mismatch',
    'financial_irregularity'
  )),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'investigating',
    'pending_review',
    'resolved',
    'escalated',
    'closed',
    'reopened'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_campaign_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  resolution TEXT,
  resolution_type TEXT CHECK (resolution_type IN (
    'no_action',
    'warning',
    'account_suspension',
    'campaign_removal',
    'account_ban',
    'fine',
    'referral_to_authorities'
  )),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  evidence_urls TEXT[] DEFAULT '{}',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ─── Compliance Events ───
-- Audit trail for all compliance-related actions and status changes.
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_case_id UUID REFERENCES compliance_cases(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details JSONB DEFAULT '{}',
  performed_by UUID,
  performed_by_type TEXT CHECK (performed_by_type IN ('system', 'admin', 'automated')),
  ip_address_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: GOVERNANCE / POLICY TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Policies ───
-- Configurable platform policies (KYC thresholds, fraud rules, etc.).
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'kyc',
    'fraud',
    'escrow',
    'payout',
    'content',
    'reputation',
    'compliance',
    'moderation'
  )),
  policy_type TEXT NOT NULL CHECK (policy_type IN ('boolean', 'threshold', 'enum', 'json', 'array')),
  value JSONB NOT NULL,
  default_value JSONB NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  allowed_values TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_restart BOOLEAN DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ─── Policy Versions ───
-- Version history tracking for all policy changes.
CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  change_reason TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: REPUTATION TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Creator Reputation ───
-- Aggregated reputation scores for platform creators.
CREATE TABLE IF NOT EXISTS creator_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (overall_score >= 0 AND overall_score <= 100),
  quality_score NUMERIC(5,2) DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  reliability_score NUMERIC(5,2) DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  communication_score NUMERIC(5,2) DEFAULT 50 CHECK (communication_score >= 0 AND communication_score <= 100),
  transparency_score NUMERIC(5,2) DEFAULT 50 CHECK (transparency_score >= 0 AND transparency_score <= 100),
  community_score NUMERIC(5,2) DEFAULT 50 CHECK (community_score >= 0 AND community_score <= 100),
  verification_score NUMERIC(5,2) DEFAULT 50 CHECK (verification_score >= 0 AND verification_score <= 100),
  total_campaigns INTEGER DEFAULT 0,
  completed_campaigns INTEGER DEFAULT 0,
  total_raised NUMERIC(12,2) DEFAULT 0,
  total_donors_served INTEGER DEFAULT 0,
  average_milestone_approval NUMERIC(5,2) DEFAULT 0,
  response_time_hours NUMERIC(8,2) DEFAULT 0,
  dispute_rate NUMERIC(5,2) DEFAULT 0,
  penalty_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ,
  calculation_version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Donor Reputation ───
-- Aggregated reputation scores for platform donors.
CREATE TABLE IF NOT EXISTS donor_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (overall_score >= 0 AND overall_score <= 100),
  engagement_score NUMERIC(5,2) DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  generosity_score NUMERIC(5,2) DEFAULT 50 CHECK (generosity_score >= 0 AND generosity_score <= 100),
  feedback_quality_score NUMERIC(5,2) DEFAULT 50 CHECK (feedback_quality_score >= 0 AND feedback_quality_score <= 100),
  campaign_adherence_score NUMERIC(5,2) DEFAULT 50 CHECK (campaign_adherence_score >= 0 AND campaign_adherence_score <= 100),
  total_donations INTEGER DEFAULT 0,
  total_donated NUMERIC(12,2) DEFAULT 0,
  active_campaigns_backed INTEGER DEFAULT 0,
  milestone_reviews_submitted INTEGER DEFAULT 0,
  disputes_initiated INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Campaign Reputation ───
-- Aggregated reputation scores for campaigns.
CREATE TABLE IF NOT EXISTS campaign_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (overall_score >= 0 AND overall_score <= 100),
  funding_progress_score NUMERIC(5,2) DEFAULT 50 CHECK (funding_progress_score >= 0 AND funding_progress_score <= 100),
  milestone_adherence_score NUMERIC(5,2) DEFAULT 50 CHECK (milestone_adherence_score >= 0 AND milestone_adherence_score <= 100),
  transparency_score NUMERIC(5,2) DEFAULT 50 CHECK (transparency_score >= 0 AND transparency_score <= 100),
  creator_reputation_score NUMERIC(5,2) DEFAULT 50 CHECK (creator_reputation_score >= 0 AND creator_reputation_score <= 100),
  donor_sentiment_score NUMERIC(5,2) DEFAULT 50 CHECK (donor_sentiment_score >= 0 AND donor_sentiment_score <= 100),
  update_frequency_score NUMERIC(5,2) DEFAULT 50 CHECK (update_frequency_score >= 0 AND update_frequency_score <= 100),
  red_flag_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: MODERATION & APPEALS TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Moderation Cases ───
-- Content and user moderation investigation cases.
CREATE TABLE IF NOT EXISTS moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  case_type TEXT NOT NULL CHECK (case_type IN (
    'campaign_report',
    'user_report',
    'content_review',
    'spam_detection',
    'inappropriate_content',
    'misleading_information',
    'harassment',
    'intellectual_property',
    'terms_violation'
  )),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'under_review',
    'pending_evidence',
    'resolved',
    'escalated',
    'closed',
    'reopened',
    'appealed'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_campaign_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  reported_content_type TEXT,
  reported_content_id UUID,
  evidence_urls TEXT[] DEFAULT '{}',
  description TEXT NOT NULL,
  moderator_id UUID,
  moderator_notes TEXT,
  action_taken TEXT CHECK (action_taken IN (
    'none',
    'dismissed',
    'warning',
    'content_removal',
    'content_edit',
    'temporary_suspension',
    'permanent_ban',
    'account_restriction',
    'campaign_restriction',
    'escalated_to_admin'
  )),
  appeal_id UUID,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Appeals ───
-- Appeal submissions and reviews for moderation/compliance decisions.
CREATE TABLE IF NOT EXISTS appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_number TEXT UNIQUE NOT NULL,
  appeal_type TEXT NOT NULL CHECK (appeal_type IN (
    'moderation_decision',
    'compliance_action',
    'account_suspension',
    'campaign_removal',
    'payout_rejection',
    'reputation_penalty',
    'verification_rejection',
    'content_removal'
  )),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'under_review',
    'evidence_requested',
    'pending_review',
    'approved',
    'rejected',
    'escalated',
    'withdrawn',
    'expired'
  )),
  appellant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_action TEXT NOT NULL,
  original_action_id UUID,
  original_action_type TEXT,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewer_decision TEXT CHECK (reviewer_decision IN ('uphold', 'overturn', 'modify', 'escalate')),
  decision_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  resolution_details TEXT,
  deadline_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: NOTIFICATION TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Notifications ───
-- In-app and cross-channel notification records.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'system',
    'campaign_update',
    'milestone_update',
    'donation_received',
    'payout_update',
    'compliance_notice',
    'moderation_notice',
    'appeal_update',
    'reputation_change',
    'verification_update',
    'security_alert',
    'reminder',
    'announcement',
    'dispute_update'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  sent_via TEXT[] DEFAULT '{}',
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notification Preferences ───
-- Per-user notification delivery preferences and settings.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  email_addresses TEXT[] DEFAULT '{}',
  phone_numbers TEXT[] DEFAULT '{}',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN (
    'realtime',
    'hourly',
    'daily',
    'weekly',
    'never'
  )),
  category_preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: PLATFORM INTELLIGENCE TABLE
-- ═══════════════════════════════════════════════════════════════════

-- ─── Platform Metrics ───
-- Append-only platform intelligence and health metrics.
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'platform_health',
    'trust_distribution',
    'fraud_trends',
    'escrow_stats',
    'milestone_completion',
    'payout_success',
    'user_growth',
    'campaign_performance',
    'verification_stats',
    'engagement_metrics',
    'revenue_metrics',
    'moderation_stats'
  )),
  metric_date DATE NOT NULL,
  metric_data JSONB NOT NULL,
  aggregation_period TEXT NOT NULL CHECK (aggregation_period IN ('hourly', 'daily', 'weekly', 'monthly')),
  source TEXT DEFAULT 'system',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_type, metric_date, aggregation_period)
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- compliance_cases
CREATE INDEX IF NOT EXISTS idx_compliance_cases_case_number ON compliance_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_case_type ON compliance_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_status ON compliance_cases(status);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_priority ON compliance_cases(priority);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_subject_user_id ON compliance_cases(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_subject_campaign_id ON compliance_cases(subject_campaign_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_assigned_to ON compliance_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_risk_level ON compliance_cases(risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_created_at ON compliance_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_deleted_at ON compliance_cases(deleted_at);

-- compliance_events
CREATE INDEX IF NOT EXISTS idx_compliance_events_compliance_case_id ON compliance_events(compliance_case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_event_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_entity_type ON compliance_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_entity_id ON compliance_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_user_id ON compliance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_performed_by ON compliance_events(performed_by);
CREATE INDEX IF NOT EXISTS idx_compliance_events_created_at ON compliance_events(created_at);

-- policies
CREATE INDEX IF NOT EXISTS idx_policies_policy_key ON policies(policy_key);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_policy_type ON policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_policies_is_active ON policies(is_active);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON policies(created_by);

-- policy_versions
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy_id ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_version ON policy_versions(version);
CREATE INDEX IF NOT EXISTS idx_policy_versions_changed_by ON policy_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_policy_versions_effective_at ON policy_versions(effective_at);
CREATE INDEX IF NOT EXISTS idx_policy_versions_created_at ON policy_versions(created_at);

-- creator_reputation
CREATE INDEX IF NOT EXISTS idx_creator_reputation_creator_id ON creator_reputation(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_reputation_overall_score ON creator_reputation(overall_score);
CREATE INDEX IF NOT EXISTS idx_creator_reputation_last_calculated ON creator_reputation(last_calculated);

-- donor_reputation
CREATE INDEX IF NOT EXISTS idx_donor_reputation_donor_id ON donor_reputation(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_reputation_overall_score ON donor_reputation(overall_score);
CREATE INDEX IF NOT EXISTS idx_donor_reputation_last_calculated ON donor_reputation(last_calculated);

-- campaign_reputation
CREATE INDEX IF NOT EXISTS idx_campaign_reputation_campaign_id ON campaign_reputation(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reputation_overall_score ON campaign_reputation(overall_score);
CREATE INDEX IF NOT EXISTS idx_campaign_reputation_last_calculated ON campaign_reputation(last_calculated);

-- moderation_cases
CREATE INDEX IF NOT EXISTS idx_moderation_cases_case_number ON moderation_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_case_type ON moderation_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_priority ON moderation_cases(priority);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_reporter_id ON moderation_cases(reporter_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_reported_user_id ON moderation_cases(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_reported_campaign_id ON moderation_cases(reported_campaign_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_moderator_id ON moderation_cases(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_action_taken ON moderation_cases(action_taken);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_appeal_id ON moderation_cases(appeal_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_created_at ON moderation_cases(created_at);

-- appeals
CREATE INDEX IF NOT EXISTS idx_appeals_appeal_number ON appeals(appeal_number);
CREATE INDEX IF NOT EXISTS idx_appeals_appeal_type ON appeals(appeal_type);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant_id ON appeals(appellant_id);
CREATE INDEX IF NOT EXISTS idx_appeals_reviewer_id ON appeals(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_appeals_deadline_at ON appeals(deadline_at);
CREATE INDEX IF NOT EXISTS idx_appeals_created_at ON appeals(created_at);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_delivered ON notifications(delivered);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- platform_metrics
CREATE INDEX IF NOT EXISTS idx_platform_metrics_metric_type ON platform_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_metric_date ON platform_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_aggregation_period ON platform_metrics(aggregation_period);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_source ON platform_metrics(source);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_created_at ON platform_metrics(created_at);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════

-- ─── compliance_cases: Admin-only ───
ALTER TABLE compliance_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all compliance cases"
  ON compliance_cases FOR ALL
  USING (auth.role() = 'service_role');

-- ─── compliance_events: Admin-only ───
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all compliance events"
  ON compliance_events FOR ALL
  USING (auth.role() = 'service_role');

-- ─── policies: Admin-only ───
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all policies"
  ON policies FOR ALL
  USING (auth.role() = 'service_role');

-- ─── policy_versions: Admin-only ───
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all policy versions"
  ON policy_versions FOR ALL
  USING (auth.role() = 'service_role');

-- ─── creator_reputation: Public read, admin full ───
ALTER TABLE creator_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creator reputation"
  ON creator_reputation FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage all creator reputation"
  ON creator_reputation FOR ALL
  USING (auth.role() = 'service_role');

-- ─── donor_reputation: Public read, admin full ───
ALTER TABLE donor_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view donor reputation"
  ON donor_reputation FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage all donor reputation"
  ON donor_reputation FOR ALL
  USING (auth.role() = 'service_role');

-- ─── campaign_reputation: Public read, admin full ───
ALTER TABLE campaign_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign reputation"
  ON campaign_reputation FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage all campaign reputation"
  ON campaign_reputation FOR ALL
  USING (auth.role() = 'service_role');

-- ─── moderation_cases: Admin-only ───
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all moderation cases"
  ON moderation_cases FOR ALL
  USING (auth.role() = 'service_role');

-- ─── appeals: Admin-only ───
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all appeals"
  ON appeals FOR ALL
  USING (auth.role() = 'service_role');

-- ─── notifications: Owner read/update, admin full ───
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role');

-- ─── notification_preferences: Owner read/update, admin full ───
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- ─── platform_metrics: Admin-only ───
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all platform metrics"
  ON platform_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 9: AUTO-UPDATE TRIGGERS (updated_at)
-- ═══════════════════════════════════════════════════════════════════

-- Auto-update updated_at on compliance_cases
CREATE OR REPLACE FUNCTION update_compliance_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_compliance_cases_updated_at
  BEFORE UPDATE ON compliance_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_cases_updated_at();

-- Auto-update updated_at on policies
CREATE OR REPLACE FUNCTION update_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_policies_updated_at();

-- Auto-update updated_at on creator_reputation
CREATE OR REPLACE FUNCTION update_creator_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_creator_reputation_updated_at
  BEFORE UPDATE ON creator_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_reputation_updated_at();

-- Auto-update updated_at on donor_reputation
CREATE OR REPLACE FUNCTION update_donor_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_donor_reputation_updated_at
  BEFORE UPDATE ON donor_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_donor_reputation_updated_at();

-- Auto-update updated_at on campaign_reputation
CREATE OR REPLACE FUNCTION update_campaign_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaign_reputation_updated_at
  BEFORE UPDATE ON campaign_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_reputation_updated_at();

-- Auto-update updated_at on moderation_cases
CREATE OR REPLACE FUNCTION update_moderation_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_moderation_cases_updated_at
  BEFORE UPDATE ON moderation_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_cases_updated_at();

-- Auto-update updated_at on appeals
CREATE OR REPLACE FUNCTION update_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appeals_updated_at
  BEFORE UPDATE ON appeals
  FOR EACH ROW
  EXECUTE FUNCTION update_appeals_updated_at();

-- Auto-update updated_at on notifications
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- Auto-update updated_at on notification_preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 10: UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-generate compliance case number (COMP-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION generate_compliance_case_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_next_num INTEGER;
  v_case_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN case_number ~ ('^COMP-' || v_year || '-[0-9]+$')
        THEN (REGEXP_REPLACE(case_number, '^COMP-' || v_year || '-', ''))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM compliance_cases;

  v_case_number := 'COMP-' || v_year || '-' || LPAD(v_next_num::TEXT, 5, '0');
  NEW.case_number := v_case_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_compliance_case_number
  BEFORE INSERT ON compliance_cases
  FOR EACH ROW
  WHEN (NEW.case_number IS NULL OR NEW.case_number = '')
  EXECUTE FUNCTION generate_compliance_case_number();

-- Auto-generate moderation case number (MOD-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION generate_moderation_case_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_next_num INTEGER;
  v_case_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN case_number ~ ('^MOD-' || v_year || '-[0-9]+$')
        THEN (REGEXP_REPLACE(case_number, '^MOD-' || v_year || '-', ''))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM moderation_cases;

  v_case_number := 'MOD-' || v_year || '-' || LPAD(v_next_num::TEXT, 5, '0');
  NEW.case_number := v_case_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_moderation_case_number
  BEFORE INSERT ON moderation_cases
  FOR EACH ROW
  WHEN (NEW.case_number IS NULL OR NEW.case_number = '')
  EXECUTE FUNCTION generate_moderation_case_number();

-- Auto-generate appeal number (APL-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION generate_appeal_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_next_num INTEGER;
  v_appeal_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE
      WHEN appeal_number ~ ('^APL-' || v_year || '-[0-9]+$')
        THEN (REGEXP_REPLACE(appeal_number, '^APL-' || v_year || '-', ''))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM appeals;

  v_appeal_number := 'APL-' || v_year || '-' || LPAD(v_next_num::TEXT, 5, '0');
  NEW.appeal_number := v_appeal_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_appeal_number
  BEFORE INSERT ON appeals
  FOR EACH ROW
  WHEN (NEW.appeal_number IS NULL OR NEW.appeal_number = '')
  EXECUTE FUNCTION generate_appeal_number();

-- ═══════════════════════════════════════════════════════════════════
-- END OF MIGRATION 007
-- ═══════════════════════════════════════════════════════════════════

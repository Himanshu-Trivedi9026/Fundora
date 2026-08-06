-- Migration: 006_escrow_milestones_payouts.sql
-- Phase 6: Escrow, Milestones & Secure Payouts
-- Creates escrow_accounts, escrow_ledger, campaign_milestones,
-- milestone_submissions, milestone_reviews, payout_requests,
-- payout_transactions, escrow_events, settlement_batches tables
-- with RLS, indexes, constraints, triggers.

-- ─── Escrow Accounts ───
-- One per campaign. Holds all escrow balances.
CREATE TABLE IF NOT EXISTS escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'partially_released', 'fully_released', 'refunded', 'cancelled', 'closed')),
  locked_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  released_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (released_balance >= 0),
  refunded_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_balance >= 0),
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  total_donated NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_donated >= 0),
  platform_fees NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_fees >= 0),
  creator_earnings NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (creator_earnings >= 0),
  fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_reason TEXT,
  frozen_at TIMESTAMPTZ,
  frozen_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id)
);

-- ─── Escrow Ledger ───
-- Immutable append-only accounting ledger.
CREATE TABLE IF NOT EXISTS escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('donation', 'refund', 'release', 'fee', 'adjustment', 'chargeback', 'payout', 'milestone_release')),
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Campaign Milestones ───
-- Milestones for a campaign's funding goals.
CREATE TABLE IF NOT EXISTS campaign_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  target_date DATE,
  release_amount NUMERIC(12,2) NOT NULL CHECK (release_amount > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'submitted', 'under_review', 'approved', 'rejected', 'released', 'cancelled')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  approval_percentage NUMERIC(5,2) DEFAULT 0 CHECK (approval_percentage >= 0 AND approval_percentage <= 100),
  auto_approve_threshold NUMERIC(5,2) DEFAULT 60.00 CHECK (auto_approve_threshold >= 0 AND auto_approve_threshold <= 100),
  total_reviews INTEGER NOT NULL DEFAULT 0,
  approval_count INTEGER NOT NULL DEFAULT 0,
  rejection_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Milestone Submissions ───
-- Evidence submitted by creator for milestone completion.
CREATE TABLE IF NOT EXISTS milestone_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('images', 'videos', 'documents', 'links', 'progress_report', 'mixed')),
  files JSONB DEFAULT '[]',
  links TEXT[] DEFAULT '{}',
  progress_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
  reviewer_id UUID,
  review_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Milestone Reviews ───
-- Donor/community reviews of milestones.
CREATE TABLE IF NOT EXISTS milestone_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES campaign_milestones(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES milestone_submissions(id) ON DELETE SET NULL,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  comment TEXT,
  vote_weight NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (vote_weight > 0),
  donation_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(milestone_id, reviewer_id)
);

-- ─── Payout Requests ───
-- Creator payout requests.
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escrow_account_id UUID REFERENCES escrow_accounts(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  fraud_decision TEXT CHECK (fraud_decision IN ('allow', 'monitor', 'manual_review', 'limit', 'block', 'escalate')),
  fraud_risk_score INTEGER CHECK (fraud_risk_score >= 0 AND fraud_risk_score <= 100),
  rejection_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Payout Transactions ───
-- Individual payout transaction records.
CREATE TABLE IF NOT EXISTS payout_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id UUID NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_reference TEXT,
  provider_response JSONB,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'processing', 'completed', 'failed', 'reversed')),
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Escrow Events ───
-- Audit trail for all escrow-related events.
CREATE TABLE IF NOT EXISTS escrow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id UUID REFERENCES escrow_accounts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('escrow_account', 'ledger_entry', 'milestone', 'submission', 'review', 'payout_request', 'payout_transaction', 'settlement_batch')),
  entity_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details JSONB DEFAULT '{}',
  performed_by UUID,
  performed_by_type TEXT CHECK (performed_by_type IN ('system', 'user', 'admin', 'provider')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Settlement Batches ───
-- Batch settlement records for periodic payouts.
CREATE TABLE IF NOT EXISTS settlement_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  total_fees NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_fees >= 0),
  total_payouts INTEGER NOT NULL DEFAULT 0,
  processed_payouts INTEGER NOT NULL DEFAULT 0,
  failed_payouts INTEGER NOT NULL DEFAULT 0,
  initiated_by UUID,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ───

-- escrow_accounts
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_campaign_id ON escrow_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_creator_id ON escrow_accounts(creator_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_status ON escrow_accounts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_frozen ON escrow_accounts(frozen);

-- escrow_ledger
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_escrow_account_id ON escrow_ledger(escrow_account_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_campaign_id ON escrow_ledger(campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_entry_type ON escrow_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_created_at ON escrow_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_idempotency_key ON escrow_ledger(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_reference ON escrow_ledger(reference_type, reference_id);

-- campaign_milestones
CREATE INDEX IF NOT EXISTS idx_campaign_milestones_campaign_id ON campaign_milestones(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_milestones_creator_id ON campaign_milestones(creator_id);
CREATE INDEX IF NOT EXISTS idx_campaign_milestones_status ON campaign_milestones(status);

-- milestone_submissions
CREATE INDEX IF NOT EXISTS idx_milestone_submissions_milestone_id ON milestone_submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_submissions_creator_id ON milestone_submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_milestone_submissions_status ON milestone_submissions(status);

-- milestone_reviews
CREATE INDEX IF NOT EXISTS idx_milestone_reviews_milestone_id ON milestone_reviews(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_reviews_reviewer_id ON milestone_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_milestone_reviews_submission_id ON milestone_reviews(submission_id);

-- payout_requests
CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_id ON payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_escrow_account_id ON payout_requests(escrow_account_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_priority ON payout_requests(priority);
CREATE INDEX IF NOT EXISTS idx_payout_requests_scheduled_at ON payout_requests(scheduled_at);

-- payout_transactions
CREATE INDEX IF NOT EXISTS idx_payout_transactions_payout_request_id ON payout_transactions(payout_request_id);
CREATE INDEX IF NOT EXISTS idx_payout_transactions_creator_id ON payout_transactions(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_transactions_status ON payout_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payout_transactions_idempotency_key ON payout_transactions(idempotency_key);

-- escrow_events
CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow_account_id ON escrow_events(escrow_account_id);
CREATE INDEX IF NOT EXISTS idx_escrow_events_campaign_id ON escrow_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_escrow_events_user_id ON escrow_events(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_events_entity_type ON escrow_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_escrow_events_event_type ON escrow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_escrow_events_created_at ON escrow_events(created_at);

-- settlement_batches
CREATE INDEX IF NOT EXISTS idx_settlement_batches_status ON settlement_batches(status);
CREATE INDEX IF NOT EXISTS idx_settlement_batches_created_at ON settlement_batches(created_at);

-- ─── RLS Policies ───

-- escrow_accounts: Creators see own, admins see all
ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own escrow accounts"
  ON escrow_accounts FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Service role can manage all escrow accounts"
  ON escrow_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- escrow_ledger: Creators see own campaign ledger, admins see all
ALTER TABLE escrow_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own campaign ledger"
  ON escrow_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM escrow_accounts ea
      WHERE ea.id = escrow_ledger.escrow_account_id
      AND ea.creator_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all ledger entries"
  ON escrow_ledger FOR ALL
  USING (auth.role() = 'service_role');

-- campaign_milestones: Creators manage own, public can view active
ALTER TABLE campaign_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active milestones"
  ON campaign_milestones FOR SELECT
  USING (status IN ('active', 'submitted', 'under_review', 'approved', 'released'));

CREATE POLICY "Creators can manage own milestones"
  ON campaign_milestones FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Service role can manage all milestones"
  ON campaign_milestones FOR ALL
  USING (auth.role() = 'service_role');

-- milestone_submissions: Creator manages own, reviewers can view
ALTER TABLE milestone_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own submissions"
  ON milestone_submissions FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can manage own submissions"
  ON milestone_submissions FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Service role can manage all submissions"
  ON milestone_submissions FOR ALL
  USING (auth.role() = 'service_role');

-- milestone_reviews: Donors can view reviews, reviewers manage own
ALTER TABLE milestone_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view milestone reviews"
  ON milestone_reviews FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can manage own reviews"
  ON milestone_reviews FOR ALL
  USING (auth.uid() = reviewer_id);

CREATE POLICY "Service role can manage all reviews"
  ON milestone_reviews FOR ALL
  USING (auth.role() = 'service_role');

-- payout_requests: Creators see own, admins see all
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can create own payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Service role can manage all payout requests"
  ON payout_requests FOR ALL
  USING (auth.role() = 'service_role');

-- payout_transactions: Creators see own, admins see all
ALTER TABLE payout_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payout transactions"
  ON payout_transactions FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Service role can manage all payout transactions"
  ON payout_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- escrow_events: Creators see own campaign events, admins see all
ALTER TABLE escrow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own escrow events"
  ON escrow_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all escrow events"
  ON escrow_events FOR ALL
  USING (auth.role() = 'service_role');

-- settlement_batches: Admin only
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all settlement batches"
  ON settlement_batches FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Triggers ───

-- Auto-update updated_at on escrow_accounts
CREATE OR REPLACE FUNCTION update_escrow_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_escrow_accounts_updated_at
  BEFORE UPDATE ON escrow_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_escrow_accounts_updated_at();

-- Auto-update updated_at on campaign_milestones
CREATE OR REPLACE FUNCTION update_campaign_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaign_milestones_updated_at
  BEFORE UPDATE ON campaign_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_milestones_updated_at();

-- Auto-update updated_at on milestone_submissions
CREATE OR REPLACE FUNCTION update_milestone_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_milestone_submissions_updated_at
  BEFORE UPDATE ON milestone_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_submissions_updated_at();

-- Auto-update updated_at on milestone_reviews
CREATE OR REPLACE FUNCTION update_milestone_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_milestone_reviews_updated_at
  BEFORE UPDATE ON milestone_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_reviews_updated_at();

-- Auto-update updated_at on payout_requests
CREATE OR REPLACE FUNCTION update_payout_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payout_requests_updated_at
  BEFORE UPDATE ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_requests_updated_at();

-- Auto-update updated_at on payout_transactions
CREATE OR REPLACE FUNCTION update_payout_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payout_transactions_updated_at
  BEFORE UPDATE ON payout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_transactions_updated_at();

-- Auto-update updated_at on settlement_batches
CREATE OR REPLACE FUNCTION update_settlement_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_settlement_batches_updated_at
  BEFORE UPDATE ON settlement_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_batches_updated_at();

-- ─── Utility Functions ───

-- Recalculate escrow account balances from ledger
CREATE OR REPLACE FUNCTION recalculate_escrow_balance(p_escrow_account_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_donated NUMERIC(12,2) := 0;
  v_total_refunded NUMERIC(12,2) := 0;
  v_total_released NUMERIC(12,2) := 0;
  v_total_fees NUMERIC(12,2) := 0;
  v_total_payouts NUMERIC(12,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'donation' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type IN ('release', 'milestone_release') THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'fee' THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'payout' THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_donated, v_total_refunded, v_total_released, v_total_fees, v_total_payouts
  FROM escrow_ledger
  WHERE escrow_account_id = p_escrow_account_id;

  UPDATE escrow_accounts SET
    total_donated = v_total_donated,
    refunded_balance = v_total_refunded,
    released_balance = v_total_released,
    platform_fees = v_total_fees,
    locked_balance = v_total_donated - v_total_refunded - v_total_released - v_total_fees - v_total_payouts,
    creator_earnings = v_total_released - v_total_payouts,
    updated_at = NOW()
  WHERE id = p_escrow_account_id;
END;
$$ LANGUAGE plpgsql;

-- Recalculate milestone approval percentage
CREATE OR REPLACE FUNCTION recalculate_milestone_approval(p_milestone_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_weight NUMERIC(5,2) := 0;
  v_approve_weight NUMERIC(5,2) := 0;
  v_total_reviews INTEGER := 0;
  v_approval_count INTEGER := 0;
  v_rejection_count INTEGER := 0;
  v_approval_pct NUMERIC(5,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(vote_weight), 0),
    COALESCE(SUM(CASE WHEN decision = 'approve' THEN vote_weight ELSE 0 END), 0),
    COUNT(*),
    COALESCE(SUM(CASE WHEN decision = 'approve' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN decision = 'reject' THEN 1 ELSE 0 END), 0)
  INTO v_total_weight, v_approve_weight, v_total_reviews, v_approval_count, v_rejection_count
  FROM milestone_reviews
  WHERE milestone_id = p_milestone_id;

  IF v_total_weight > 0 THEN
    v_approval_pct := ROUND((v_approve_weight / v_total_weight) * 100, 2);
  END IF;

  UPDATE campaign_milestones SET
    total_reviews = v_total_reviews,
    approval_count = v_approval_count,
    rejection_count = v_rejection_count,
    approval_percentage = v_approval_pct,
    updated_at = NOW()
  WHERE id = p_milestone_id;
END;
$$ LANGUAGE plpgsql;

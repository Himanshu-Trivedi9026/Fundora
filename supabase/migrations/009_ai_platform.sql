-- Migration: 009_ai_platform.sql
-- Phase 9: AI Platform — Conversations, Embeddings, Recommendations,
-- Predictions, Workflows, Usage Tracking, and Provider Metrics
-- Creates ai_conversations, ai_messages, ai_embeddings, ai_recommendations,
-- prediction_results, workflow_templates, workflow_runs, workflow_logs,
-- ai_usage, ai_provider_metrics
-- with RLS, indexes, constraints, triggers, and vector support.

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: AI CONVERSATIONS & MESSAGES
-- ═══════════════════════════════════════════════════════════════════

-- ─── AI Conversations ───
-- Chat sessions for AI copilot features (creator, donor, admin, moderator, organization).
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  copilot_type TEXT NOT NULL CHECK (copilot_type IN ('creator', 'donor', 'admin', 'moderator', 'organization')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Messages ───
-- Individual messages within a conversation, including token/cost tracking.
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  provider TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: AI EMBEDDINGS (VECTOR SEARCH)
-- ═══════════════════════════════════════════════════════════════════

-- ─── AI Embeddings ───
-- Vector storage for semantic search over campaigns, donors, creators, and knowledge articles.
CREATE TABLE IF NOT EXISTS ai_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'donor', 'creator', 'knowledge_article')),
  entity_id UUID NOT NULL,
  embedding VECTOR(1536),
  content_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: AI RECOMMENDATIONS & PREDICTIONS
-- ═══════════════════════════════════════════════════════════════════

-- ─── AI Recommendations ───
-- Cached recommendation results for campaigns, trending items, and creator suggestions.
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
    'campaign_for_donor', 'similar_campaigns', 'trending', 'creator_recommendations'
  )),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  reason TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ─── Prediction Results ───
-- Cached prediction outputs for campaigns, donors, and creators.
CREATE TABLE IF NOT EXISTS prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'donor', 'creator')),
  entity_id UUID NOT NULL,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN (
    'success_prob', 'funding_timeline', 'donation_velocity', 'failure_risk',
    'refund_prob', 'milestone_completion', 'creator_growth'
  )),
  result JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: WORKFLOW AUTOMATION
-- ═══════════════════════════════════════════════════════════════════

-- ─── Workflow Templates ───
-- Reusable automation templates with trigger configuration, conditions, and actions.
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'manual', 'webhook')),
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  retry_config JSONB DEFAULT '{}',
  schedule_config JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflow Runs ───
-- Execution log for workflow runs, tracking status, input/output, and timing.
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  trigger_event TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying')),
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflow Logs ───
-- Step-level execution logs for each workflow run.
CREATE TABLE IF NOT EXISTS workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: AI USAGE & PROVIDER METRICS
-- ═══════════════════════════════════════════════════════════════════

-- ─── AI Usage ───
-- Token and cost tracking per user per day, per provider/model.
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date, provider, model)
);

-- ─── AI Provider Metrics ───
-- Health tracking for AI providers, including latency, error rate, and status.
CREATE TABLE IF NOT EXISTS ai_provider_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'down')),
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  error_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- ai_conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_copilot_type ON ai_conversations(copilot_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);

-- ai_messages
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_role ON ai_messages(role);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- ai_embeddings
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_entity_type_id ON ai_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_content_hash ON ai_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_model ON ai_embeddings(model);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_expires_at ON ai_embeddings(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_created_at ON ai_embeddings(created_at);

-- ai_recommendations
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type ON ai_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity_id ON ai_recommendations(entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity_type ON ai_recommendations(entity_type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_score ON ai_recommendations(score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires_at ON ai_recommendations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_recommendations(created_at);

-- prediction_results
CREATE INDEX IF NOT EXISTS idx_prediction_results_entity_type_id ON prediction_results(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_prediction_results_prediction_type ON prediction_results(prediction_type);
CREATE INDEX IF NOT EXISTS idx_prediction_results_confidence ON prediction_results(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_results_model ON prediction_results(model);
CREATE INDEX IF NOT EXISTS idx_prediction_results_expires_at ON prediction_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_prediction_results_created_at ON prediction_results(created_at);

-- workflow_templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org_id ON workflow_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_trigger_type ON workflow_templates(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_enabled ON workflow_templates(enabled);

-- workflow_runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_trigger_event ON workflow_runs(trigger_event);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at);

-- workflow_logs
CREATE INDEX IF NOT EXISTS idx_workflow_logs_run_id ON workflow_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_step_name ON workflow_logs(step_name);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_status ON workflow_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created_at ON workflow_logs(created_at);

-- ai_usage
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

-- ai_provider_metrics
CREATE INDEX IF NOT EXISTS idx_ai_provider_metrics_provider ON ai_provider_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_metrics_model ON ai_provider_metrics(model);
CREATE INDEX IF NOT EXISTS idx_ai_provider_metrics_status ON ai_provider_metrics(status);
CREATE INDEX IF NOT EXISTS idx_ai_provider_metrics_last_checked_at ON ai_provider_metrics(last_checked_at);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: AUTO-UPDATE TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_ai_conversations_updated_at();

CREATE OR REPLACE FUNCTION update_workflow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_workflow_templates_updated_at();

CREATE OR REPLACE FUNCTION update_ai_provider_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_provider_metrics_updated_at
  BEFORE UPDATE ON ai_provider_metrics
  FOR EACH ROW EXECUTE FUNCTION update_ai_provider_metrics_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- ai_conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all conversations"
  ON ai_conversations FOR ALL
  USING (auth.role() = 'service_role');

-- ai_messages
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations
      WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all messages"
  ON ai_messages FOR ALL
  USING (auth.role() = 'service_role');

-- ai_embeddings
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all embeddings"
  ON ai_embeddings FOR ALL
  USING (auth.role() = 'service_role');

-- ai_recommendations
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON ai_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all recommendations"
  ON ai_recommendations FOR ALL
  USING (auth.role() = 'service_role');

-- prediction_results
ALTER TABLE prediction_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all prediction results"
  ON prediction_results FOR ALL
  USING (auth.role() = 'service_role');

-- workflow_templates
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workflow templates"
  ON workflow_templates FOR SELECT
  USING (
    auth.uid() = created_by
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = workflow_templates.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
      )
    )
  );

CREATE POLICY "Service role can manage all workflow templates"
  ON workflow_templates FOR ALL
  USING (auth.role() = 'service_role');

-- workflow_runs
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs of own workflows"
  ON workflow_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_templates
      WHERE workflow_templates.id = workflow_runs.workflow_id
      AND (
        workflow_templates.created_by = auth.uid()
        OR (
          workflow_templates.organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = workflow_templates.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.status = 'active'
          )
        )
      )
    )
  );

CREATE POLICY "Service role can manage all workflow runs"
  ON workflow_runs FOR ALL
  USING (auth.role() = 'service_role');

-- workflow_logs
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of own workflow runs"
  ON workflow_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_runs
      JOIN workflow_templates ON workflow_templates.id = workflow_runs.workflow_id
      WHERE workflow_runs.id = workflow_logs.run_id
      AND (
        workflow_templates.created_by = auth.uid()
        OR (
          workflow_templates.organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = workflow_templates.organization_id
            AND organization_members.user_id = auth.uid()
            AND organization_members.status = 'active'
          )
        )
      )
    )
  );

CREATE POLICY "Service role can manage all workflow logs"
  ON workflow_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ai_usage
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all usage"
  ON ai_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ai_provider_metrics
ALTER TABLE ai_provider_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all provider metrics"
  ON ai_provider_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Phase 11: Ecosystem, Agent Platform & Enterprise Integrations
-- ============================================================
-- This migration adds tables for:
--   Agent platform, MCP server, event bus, enterprise connectors,
--   data export, analytics studio, tenant management, feature flags
-- ============================================================

-- -----------------------------------------------------------
-- 1. AGENT PLATFORM
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  agent_type TEXT NOT NULL
    CHECK (agent_type IN ('creator','donor','moderator','compliance','finance','organization','plugin','custom')),
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive','active','paused','error','archived')),
  model TEXT NOT NULL DEFAULT 'gpt-4',
  system_prompt TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  permissions JSONB NOT NULL DEFAULT '[]',
  memory_config JSONB NOT NULL DEFAULT '{}',
  max_execution_time_ms INTEGER NOT NULL DEFAULT 30000,
  max_concurrent_runs INTEGER NOT NULL DEFAULT 1,
  requires_human_approval BOOLEAN NOT NULL DEFAULT false,
  human_approval_actions JSONB NOT NULL DEFAULT '[]',
  organization_id UUID REFERENCES organizations(id),
  owner_id UUID REFERENCES auth.users(id),
  version TEXT NOT NULL DEFAULT '1.0.0',
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL
    CHECK (run_type IN ('manual','scheduled','event','webhook','workflow')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled','pending_approval')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  context JSONB DEFAULT '{}',
  error JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  token_usage JSONB DEFAULT '{}',
  cost NUMERIC(12,6) DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  correlation_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL
    CHECK (memory_type IN ('conversation','fact','preference','context','knowledge','state')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  ttl_seconds INTEGER,
  expires_at TIMESTAMPTZ,
  is_persistent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, memory_type, key)
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, resource, action)
);

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL
    CHECK (schedule_type IN ('cron','interval','time','event')),
  cron_expression TEXT,
  interval_seconds INTEGER,
  run_at TIMESTAMPTZ,
  input_template JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  max_runs INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 2. EVENT BUS
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_bus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 5
    CHECK (priority >= 1 AND priority <= 10),
  correlation_id TEXT,
  causation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','dead_letter','cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  organization_id UUID REFERENCES organizations(id),
  metadata JSONB DEFAULT '{}',
  produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_types TEXT[] NOT NULL DEFAULT '{}',
  target_url TEXT,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('webhook','internal','queue','log')),
  filter_expression JSONB DEFAULT '{}',
  retry_policy JSONB DEFAULT '{"maxRetries":3,"backoffMs":1000}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3. ENTERPRISE CONNECTORS
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL
    CHECK (provider IN ('slack','teams','discord','google_workspace','github','jira','notion','custom')),
  label TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected','disconnected','error','expired')),
  is_active BOOLEAN DEFAULT false,
  webhook_url TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 4. TENANT MANAGEMENT
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  brand_color TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  custom_domain TEXT,
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  locale TEXT DEFAULT 'en',
  currency TEXT DEFAULT 'USD',
  settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 5. FEATURE FLAGS
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  flag_type TEXT NOT NULL
    CHECK (flag_type IN ('boolean','percentage','organization','environment')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '[]',
  targeting JSONB DEFAULT '{}',
  rollout_percentage INTEGER DEFAULT 100
    CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  environments TEXT[] NOT NULL DEFAULT '{}',
  organization_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES feature_flags(flag_key),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('enabled','disabled','rule_added','rule_removed','percentage_changed')),
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 6. DATA EXPORT
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  export_type TEXT NOT NULL
    CHECK (export_type IN ('csv','xlsx','json','pdf')),
  entity_type TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  schedule_config JSONB DEFAULT '{}',
  is_scheduled BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES export_templates(id),
  export_type TEXT NOT NULL
    CHECK (export_type IN ('csv','xlsx','json','pdf')),
  entity_type TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  file_url TEXT,
  file_size BIGINT,
  error_message TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES export_templates(id),
  schedule_type TEXT NOT NULL
    CHECK (schedule_type IN ('daily','weekly','monthly','custom')),
  cron_expression TEXT,
  recipients TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 7. ANALYTICS STUDIO
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL
    CHECK (report_type IN ('dashboard','saved_report','scheduled','kpi')),
  config JSONB NOT NULL DEFAULT '{}',
  widgets JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL
    CHECK (snapshot_type IN ('daily','weekly','monthly','custom')),
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_type, snapshot_date, organization_id)
);

-- -----------------------------------------------------------
-- 8. USAGE QUOTAS
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  quota_limit BIGINT NOT NULL,
  quota_used BIGINT NOT NULL DEFAULT 0,
  period TEXT NOT NULL
    CHECK (period IN ('daily','weekly','monthly','yearly','total')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, resource, period, period_start)
);

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------

CREATE INDEX idx_agents_owner ON agents(owner_id);
CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_type_status ON agents(agent_type, status);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_correlation ON agent_runs(correlation_id);
CREATE INDEX idx_agent_memory_expires ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_agent_schedules_next ON agent_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_event_bus_status ON event_bus(status, priority);
CREATE INDEX idx_event_bus_type ON event_bus(event_type);
CREATE INDEX idx_event_bus_correlation ON event_bus(correlation_id);
CREATE INDEX idx_event_bus_scheduled ON event_bus(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_event_subscriptions_types ON event_subscriptions USING GIN(event_types);
CREATE INDEX idx_connector_configs_provider ON connector_configs(provider, organization_id);
CREATE INDEX idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_scheduled_exports_next ON scheduled_exports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX idx_analytics_snapshots_date ON analytics_snapshots(snapshot_type, snapshot_date);

-- -----------------------------------------------------------
-- UPDATED AT TRIGGERS
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_ecosystem_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON agent_memory FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_agent_schedules_updated_at
  BEFORE UPDATE ON agent_schedules FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_event_subscriptions_updated_at
  BEFORE UPDATE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_connector_configs_updated_at
  BEFORE UPDATE ON connector_configs FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_export_templates_updated_at
  BEFORE UPDATE ON export_templates FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_scheduled_exports_updated_at
  BEFORE UPDATE ON scheduled_exports FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();
CREATE TRIGGER update_usage_quotas_updated_at
  BEFORE UPDATE ON usage_quotas FOR EACH ROW EXECUTE FUNCTION update_ecosystem_updated_at();

-- -----------------------------------------------------------
-- RLS
-- -----------------------------------------------------------

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bus ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Organization-based RLS policies
CREATE POLICY org_isolation_agents ON agents
  USING (organization_id = auth.jwt() ->> 'organization_id'::text OR owner_id = auth.uid());
CREATE POLICY org_isolation_agent_runs ON agent_runs
  USING (agent_id IN (SELECT id FROM agents WHERE organization_id = auth.jwt() ->> 'organization_id'::text OR owner_id = auth.uid()));
CREATE POLICY org_isolation_event_subscriptions ON event_subscriptions
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_connectors ON connector_configs
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_tenant ON tenant_settings
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_exports ON export_templates
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_export_jobs ON export_jobs
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_scheduled_exports ON scheduled_exports
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_analytics_snapshots ON analytics_snapshots
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);
CREATE POLICY org_isolation_usage_quotas ON usage_quotas
  USING (organization_id = auth.jwt() ->> 'organization_id'::text);

-- -----------------------------------------------------------
-- SEED DATA: Default system report templates
-- -----------------------------------------------------------

INSERT INTO report_templates (name, description, report_type, config, widgets, is_system) VALUES
  ('Platform Overview', 'Key platform metrics at a glance', 'dashboard',
    '{"refreshInterval": 300}',
    '[{"type":"kpi","metric":"total_projects","label":"Total Projects"},{"type":"kpi","metric":"total_donations","label":"Total Donations"},{"type":"chart","metric":"donations_over_time","label":"Donations Over Time","chartType":"line"}]',
    true),
  ('Campaign Performance', 'Campaign success metrics and trends', 'dashboard',
    '{"refreshInterval": 600}',
    '[{"type":"kpi","metric":"active_campaigns","label":"Active Campaigns"},{"type":"kpi","metric":"avg_funding","label":"Avg Funding Goal"},{"type":"chart","metric":"success_rate","label":"Success Rate","chartType":"bar"}]',
    true),
  ('Security Overview', 'Security events and compliance', 'kpi',
    '{}',
    '[{"type":"kpi","metric":"flagged_activities","label":"Flagged Activities"},{"type":"kpi","metric":"verification_rate","label":"Verification Rate"}]',
    true),
  ('Monthly Report', 'Monthly platform performance summary', 'scheduled',
    '{"period":"monthly"}',
    '[{"type":"kpi","metric":"new_users","label":"New Users"},{"type":"kpi","metric":"total_volume","label":"Total Volume"},{"type":"chart","metric":"growth","label":"Growth Trend","chartType":"area"}]',
    true);

-- Seed: default feature flags
INSERT INTO feature_flags (flag_key, name, description, flag_type, is_enabled, rollout_percentage) VALUES
  ('agent-platform', 'Agent Platform', 'Enable AI agent platform', 'boolean', false, 0),
  ('mcp-server', 'MCP Server', 'Enable Model Context Protocol server', 'boolean', false, 0),
  ('enterprise-connectors', 'Enterprise Connectors', 'Enable Slack, Teams, Discord, etc.', 'boolean', false, 0),
  ('event-bus', 'Event Bus', 'Enable central event bus', 'boolean', true, 100),
  ('analytics-studio', 'Analytics Studio', 'Enable analytics dashboards and reports', 'boolean', true, 100),
  ('data-export', 'Data Export', 'Enable CSV/Excel/JSON/PDF exports', 'boolean', true, 100),
  ('new-dashboard', 'New Dashboard Layout', 'Gradual rollout of new dashboard', 'percentage', false, 0),
  ('dark-mode', 'Dark Mode', 'Enable dark mode for all users', 'boolean', true, 100);

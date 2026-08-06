-- ============================================================
-- Phase 10: Global Platform, Marketplace & Production Scale
-- ============================================================
-- This migration adds tables for:
--   Plugin platform, marketplace, internationalization,
--   multi-currency, observability, backup/recovery,
--   search platform, CDN/storage abstraction, mobile API support
-- ============================================================

-- -----------------------------------------------------------
-- 1. PLUGIN PLATFORM
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  plugin_type TEXT NOT NULL DEFAULT 'internal'
    CHECK (plugin_type IN ('internal', 'external', 'marketplace')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected',
                      'published', 'disabled', 'archived')),
  manifest JSONB NOT NULL DEFAULT '{}',
  permissions JSONB NOT NULL DEFAULT '[]',
  dependencies JSONB NOT NULL DEFAULT '[]',
  entry_point TEXT NOT NULL DEFAULT 'index.js',
  documentation_url TEXT,
  support_url TEXT,
  license TEXT NOT NULL DEFAULT 'MIT',
  checksum TEXT,
  signature TEXT,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  download_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  config_schema JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  manifest_snapshot JSONB NOT NULL DEFAULT '{}',
  permissions_snapshot JSONB NOT NULL DEFAULT '[]',
  dependencies_snapshot JSONB NOT NULL DEFAULT '[]',
  checksum TEXT,
  signature TEXT,
  file_url TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

CREATE TABLE IF NOT EXISTS plugin_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  plugin_version_id UUID REFERENCES plugin_versions(id),
  user_id UUID REFERENCES auth.users(id),
  ip_address_hash TEXT,
  installation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES marketplace_categories(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 2. INTERNATIONALIZATION
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS language_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_rtl BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  translator_id UUID REFERENCES auth.users(id),
  version TEXT NOT NULL DEFAULT '1.0.0',
  coverage_percent NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS translation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL REFERENCES language_packs(locale),
  namespace TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  plural_value TEXT,
  context TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(locale, namespace, key)
);

-- -----------------------------------------------------------
-- 3. MULTI-CURRENCY
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  native_symbol TEXT,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_display_currency BOOLEAN NOT NULL DEFAULT false,
  is_settlement_currency BOOLEAN NOT NULL DEFAULT false,
  min_amount NUMERIC(20,2),
  max_amount NUMERIC(20,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL REFERENCES currencies(code),
  to_currency TEXT NOT NULL REFERENCES currencies(code),
  rate NUMERIC(20,8) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  source TEXT NOT NULL DEFAULT 'manual',
  is_historical BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, recorded_at)
);

-- -----------------------------------------------------------
-- 4. OBSERVABILITY
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL
    CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'timing')),
  value NUMERIC(20,4) NOT NULL,
  tags JSONB DEFAULT '{}',
  unit TEXT,
  source TEXT,
  organization_id UUID REFERENCES organizations(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name TEXT NOT NULL,
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('threshold', 'anomaly', 'heartbeat', 'custom')),
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('critical', 'warning', 'info', 'debug')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'acknowledged', 'resolved', 'silenced')),
  metric_name TEXT,
  condition JSONB NOT NULL DEFAULT '{}',
  value NUMERIC(20,4),
  threshold NUMERIC(20,4),
  message TEXT,
  source TEXT,
  organization_id UUID REFERENCES organizations(id),
  assigned_to UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('fired', 'acknowledged', 'resolved', 'silenced', 'escalated')),
  value NUMERIC(20,4),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  latency_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL UNIQUE,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  service TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ok', 'error', 'warning')),
  tags JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_operation ON traces(operation_name);
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_component ON health_checks(component, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON alert_events(alert_id, created_at DESC);

-- -----------------------------------------------------------
-- 5. BACKUP & RECOVERY
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS backup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schedule_cron TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 30,
  backup_type TEXT NOT NULL
    CHECK (backup_type IN ('full', 'incremental', 'snapshot')),
  target TEXT NOT NULL,
  include_tables TEXT[] DEFAULT '{}',
  exclude_tables TEXT[] DEFAULT '{}',
  encryption_enabled BOOLEAN NOT NULL DEFAULT true,
  compression_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES organizations(id),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES backup_policies(id),
  backup_type TEXT NOT NULL
    CHECK (backup_type IN ('full', 'incremental', 'snapshot')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'verifying', 'verified')),
  file_url TEXT,
  file_size BIGINT,
  checksum TEXT,
  encryption_iv TEXT,
  includes JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retention_until TIMESTAMPTZ,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  backup_id UUID REFERENCES backups(id),
  point_in_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'restoring', 'restored', 'failed', 'expired')),
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restore_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_point_id UUID REFERENCES recovery_points(id),
  backup_id UUID REFERENCES backups(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validating', 'restoring', 'completed',
                      'failed', 'rolled_back')),
  target_environment TEXT NOT NULL DEFAULT 'production',
  includes JSONB DEFAULT '{}',
  excludes JSONB DEFAULT '{}',
  verification_status TEXT
    CHECK (verification_status IN ('pending', 'passed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 6. SEARCH PLATFORM
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS search_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  category TEXT,
  locale TEXT DEFAULT 'en',
  is_published BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 1,
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_indexes_entity ON search_indexes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_search_indexes_gin ON search_indexes USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_indexes_tags ON search_indexes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_search_indexes_published ON search_indexes(is_published);

CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  normalized_query TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  click_entity_type TEXT,
  click_entity_id UUID,
  dwell_time_ms INTEGER,
  filters JSONB DEFAULT '{}',
  locale TEXT DEFAULT 'en',
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_session ON search_analytics(session_id);

-- -----------------------------------------------------------
-- 7. CDN & STORAGE PROVIDERS
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS storage_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL
    CHECK (provider_type IN ('s3', 'gcs', 'azure', 'cloudflare', 'supabase', 'local')),
  bucket TEXT NOT NULL,
  region TEXT,
  endpoint_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  credentials_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES storage_providers(id),
  path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  object_type TEXT NOT NULL DEFAULT 'document'
    CHECK (object_type IN ('image', 'video', 'document', 'audio', 'static', 'backup')),
  checksum TEXT,
  metadata JSONB DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  signed_url_expires_in INTEGER DEFAULT 3600,
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_provider ON storage_objects(provider_id, path);
CREATE INDEX IF NOT EXISTS idx_storage_objects_type ON storage_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_storage_objects_tags ON storage_objects USING GIN(tags);

-- -----------------------------------------------------------
-- 8. DEVELOPER PORTAL (Mobile API support)
-- -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'sunset')),
  deprecation_date TIMESTAMPTZ,
  sunset_date TIMESTAMPTZ,
  changelog TEXT,
  min_app_version TEXT,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL DEFAULT 'default'
    CHECK (tier IN ('free', 'basic', 'pro', 'enterprise', 'custom')),
  requests_per_second INTEGER NOT NULL DEFAULT 10,
  requests_per_minute INTEGER NOT NULL DEFAULT 100,
  requests_per_hour INTEGER NOT NULL DEFAULT 1000,
  requests_per_day INTEGER NOT NULL DEFAULT 10000,
  concurrent_limit INTEGER NOT NULL DEFAULT 5,
  burst_limit INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- TRIGGERS: updated_at
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plugins_updated_at
  BEFORE UPDATE ON plugins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_plugin_reviews_updated_at
  BEFORE UPDATE ON plugin_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_language_packs_updated_at
  BEFORE UPDATE ON language_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_translation_entries_updated_at
  BEFORE UPDATE ON translation_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_backup_policies_updated_at
  BEFORE UPDATE ON backup_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_storage_providers_updated_at
  BEFORE UPDATE ON storage_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_storage_objects_updated_at
  BEFORE UPDATE ON storage_objects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_search_indexes_updated_at
  BEFORE UPDATE ON search_indexes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_api_rate_limits_updated_at
  BEFORE UPDATE ON api_rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------
-- TRIGGER: search_index auto-tsvector update
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_search_indexes_tsvector
  BEFORE INSERT OR UPDATE ON search_indexes
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- -----------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------

ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE restore_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Plugin access: owner, org members, or public (published)
CREATE POLICY plugins_owner ON plugins
  FOR ALL USING (author_id = auth.uid());
CREATE POLICY plugins_org ON plugins
  FOR SELECT USING (
    organization_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM organization_members
            WHERE organization_id = plugins.organization_id
            AND user_id = auth.uid())
  );
CREATE POLICY plugins_public ON plugins
  FOR SELECT USING (status = 'published');

-- Most tables: service role only for write, select based on ownership/org
CREATE POLICY service_role_all ON plugin_versions
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON plugin_reviews
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON plugin_downloads
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON marketplace_categories
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON language_packs
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON translation_entries
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON currencies
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON exchange_rates
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON metrics
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON alerts
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON alert_events
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON health_checks
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON traces
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON backup_policies
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON backups
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON recovery_points
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON restore_operations
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON search_indexes
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON search_analytics
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON storage_providers
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON storage_objects
  USING (auth.role() = 'service_role');
CREATE POLICY service_role_all ON api_versions
  USING (auth.role() = 'service_role');

-- Public reads for published/enabled data
CREATE POLICY public_read_marketplace_categories ON marketplace_categories
  FOR SELECT USING (is_active = true);
CREATE POLICY public_read_language_packs ON language_packs
  FOR SELECT USING (is_active = true);
CREATE POLICY public_read_currencies ON currencies
  FOR SELECT USING (is_active = true);
CREATE POLICY public_read_search_indexes ON search_indexes
  FOR SELECT USING (is_published = true);

-- Seed data
INSERT INTO api_rate_limits (tier, requests_per_second, requests_per_minute,
  requests_per_hour, requests_per_day, concurrent_limit, burst_limit)
VALUES
  ('free', 5, 60, 500, 5000, 3, 10),
  ('basic', 10, 100, 1000, 10000, 5, 20),
  ('pro', 25, 300, 5000, 50000, 10, 50),
  ('enterprise', 100, 1000, 20000, 200000, 50, 200),
  ('custom', 10, 100, 1000, 10000, 5, 20)
ON CONFLICT (tier) DO NOTHING;

INSERT INTO api_versions (version, status, changelog, min_app_version)
VALUES ('v1', 'active', 'Initial API version', '1.0.0')
ON CONFLICT (version) DO NOTHING;

-- Seed currencies
INSERT INTO currencies (code, name, symbol, native_symbol, decimal_places,
  is_active, is_display_currency, is_settlement_currency)
VALUES
  ('INR', 'Indian Rupee', '₹', '₹', 2, true, true, true),
  ('USD', 'US Dollar', '$', '$', 2, true, true, true),
  ('EUR', 'Euro', '€', '€', 2, true, false, false),
  ('GBP', 'British Pound', '£', '£', 2, true, false, false),
  ('CAD', 'Canadian Dollar', 'C$', 'C$', 2, true, false, false),
  ('AUD', 'Australian Dollar', 'A$', 'A$', 2, true, false, false),
  ('JPY', 'Japanese Yen', '¥', '¥', 0, false, false, false),
  ('SGD', 'Singapore Dollar', 'S$', 'S$', 2, true, false, false),
  ('AED', 'UAE Dirham', 'د.إ', 'د.إ', 2, true, false, false),
  ('CHF', 'Swiss Franc', 'Fr', 'Fr', 2, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Seed marketplace categories
INSERT INTO marketplace_categories (name, slug, description, display_order)
VALUES
  ('Analytics', 'analytics', 'Analytics and reporting plugins', 1),
  ('Payments', 'payments', 'Payment gateway and processing plugins', 2),
  ('Communication', 'communication', 'Email, SMS, and notification plugins', 3),
  ('Social', 'social', 'Social media integration plugins', 4),
  ('Automation', 'automation', 'Workflow and automation plugins', 5),
  ('Security', 'security', 'Security and compliance plugins', 6),
  ('AI & ML', 'ai-ml', 'AI and machine learning plugins', 7),
  ('Developer Tools', 'developer-tools', 'SDK, API, and developer utilities', 8),
  ('Design', 'design', 'Theme and design plugins', 9),
  ('Marketing', 'marketing', 'Marketing and SEO plugins', 10)
ON CONFLICT (slug) DO NOTHING;

-- Seed language packs
INSERT INTO language_packs (locale, name, native_name, is_rtl, is_active, is_default)
VALUES
  ('en', 'English', 'English', false, true, true),
  ('hi', 'Hindi', 'हिन्दी', false, true, false),
  ('bn', 'Bengali', 'বাংলা', false, true, false),
  ('te', 'Telugu', 'తెలుగు', false, true, false),
  ('mr', 'Marathi', 'मराठी', false, true, false),
  ('ta', 'Tamil', 'தமிழ்', false, true, false),
  ('ur', 'Urdu', 'اردو', true, false, false),
  ('gu', 'Gujarati', 'ગુજરાતી', false, true, false),
  ('kn', 'Kannada', 'ಕನ್ನಡ', false, true, false),
  ('ml', 'Malayalam', 'മലയാളം', false, true, false),
  ('pa', 'Punjabi', 'ਪੰਜਾਬੀ', false, true, false),
  ('or', 'Odia', 'ଓଡ଼ିଆ', false, false, false),
  ('as', 'Assamese', 'অসমীয়া', false, false, false),
  ('ar', 'Arabic', 'العربية', true, false, false),
  ('es', 'Spanish', 'Español', false, false, false),
  ('fr', 'French', 'Français', false, false, false),
  ('de', 'German', 'Deutsch', false, false, false),
  ('ja', 'Japanese', '日本語', false, false, false),
  ('zh', 'Chinese', '中文', false, false, false),
  ('pt', 'Portuguese', 'Português', false, false, false)
ON CONFLICT (locale) DO NOTHING;

-- Default backup policy
INSERT INTO backup_policies (name, description, schedule_cron, retention_days,
  backup_type, target, include_tables, is_active)
VALUES (
  'Daily Full Backup',
  'Automatic daily full database backup',
  '0 2 * * *',
  30,
  'full',
  'supabase',
  ARRAY['profiles', 'projects', 'public_donations', 'escrow_accounts',
    'escrow_ledger', 'payout_requests', 'fraud_profiles', 'compliance_cases'],
  true
)
ON CONFLICT DO NOTHING;

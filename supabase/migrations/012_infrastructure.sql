-- Phase 12: Infrastructure Platform
-- Cloud-native infrastructure for production operations
-- Adds: job_queue, scheduled_jobs, cache_metadata, deployment_history, audit_archives, system_health

-- =========================================================
-- JOB QUEUE
-- =========================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled','retrying','dead_letter')),
  priority INTEGER NOT NULL DEFAULT 5
    CHECK (priority BETWEEN 1 AND 10),
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX idx_job_queue_status ON job_queue(status);
CREATE INDEX idx_job_queue_queue_name ON job_queue(queue_name);
CREATE INDEX idx_job_queue_priority ON job_queue(priority DESC);
CREATE INDEX idx_job_queue_scheduled ON job_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_job_queue_created ON job_queue(created_at DESC);

-- =========================================================
-- SCHEDULED JOBS
-- =========================================================

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT NOT NULL,
  queue_name TEXT NOT NULL DEFAULT 'default',
  payload JSONB DEFAULT '{}',
  schedule_cron TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  max_retries INTEGER NOT NULL DEFAULT 3,
  max_runs INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NOTE: auth.users is the real identity table (there is no public.users);
  -- referencing users(id) caused this migration to fail with
  -- 'relation "users" does not exist'.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_jobs_active ON scheduled_jobs(is_active);
CREATE INDEX idx_scheduled_jobs_type ON scheduled_jobs(job_type);
CREATE INDEX idx_scheduled_jobs_org ON scheduled_jobs(organization_id);

-- =========================================================
-- CACHE METADATA
-- =========================================================

CREATE TABLE IF NOT EXISTS cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  cache_group TEXT DEFAULT 'default',
  value_size INTEGER,
  ttl_seconds INTEGER NOT NULL DEFAULT 300,
  expires_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  misses INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_cache_metadata_key ON cache_metadata(cache_key);
CREATE INDEX idx_cache_metadata_group ON cache_metadata(cache_group);
CREATE INDEX idx_cache_metadata_expires ON cache_metadata(expires_at);
CREATE INDEX idx_cache_metadata_accessed ON cache_metadata(last_accessed_at);

-- =========================================================
-- DEPLOYMENT HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS deployment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  environment TEXT NOT NULL
    CHECK (environment IN ('development','staging','production','preview')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','building','testing','deploying','live','failed','rolled_back')),
  artifacts JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  health_check_passed BOOLEAN,
  rollback_version TEXT,
  duration_ms INTEGER,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX idx_deployment_history_env ON deployment_history(environment);
CREATE INDEX idx_deployment_history_status ON deployment_history(status);
CREATE INDEX idx_deployment_history_created ON deployment_history(created_at DESC);
CREATE INDEX idx_deployment_history_version ON deployment_history(version);
CREATE INDEX idx_deployment_history_branch ON deployment_history(branch);

-- =========================================================
-- AUDIT ARCHIVES
-- =========================================================

CREATE TABLE IF NOT EXISTS audit_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_date DATE NOT NULL,
  archive_type TEXT NOT NULL
    CHECK (archive_type IN ('audit_log','event_bus','agent_runs','metrics','exports')),
  record_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  compressed BOOLEAN NOT NULL DEFAULT true,
  retention_days INTEGER NOT NULL DEFAULT 365,
  expires_at DATE NOT NULL,
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_archives_date ON audit_archives(archive_date DESC);
CREATE INDEX idx_audit_archives_type ON audit_archives(archive_type);
CREATE INDEX idx_audit_archives_status ON audit_archives(status);
CREATE INDEX idx_audit_archives_expires ON audit_archives(expires_at);

-- =========================================================
-- SYSTEM HEALTH
-- =========================================================

CREATE TABLE IF NOT EXISTS system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('healthy','degraded','down','unknown')),
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION,
  threshold DOUBLE PRECISION,
  message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_component ON system_health(component);
CREATE INDEX idx_system_health_status ON system_health(status);
CREATE INDEX idx_system_health_checked ON system_health(checked_at DESC);
CREATE INDEX idx_system_health_component_status ON system_health(component, status);

-- =========================================================
-- CONNECTION POOL METRICS (lightweight)
-- =========================================================

CREATE TABLE IF NOT EXISTS connection_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_name TEXT NOT NULL,
  active_connections INTEGER NOT NULL DEFAULT 0,
  idle_connections INTEGER NOT NULL DEFAULT 0,
  waiting_connections INTEGER NOT NULL DEFAULT 0,
  max_connections INTEGER NOT NULL DEFAULT 100,
  acquired_count BIGINT NOT NULL DEFAULT 0,
  released_count BIGINT NOT NULL DEFAULT 0,
  timed_out_count BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_metrics_name ON connection_pool_metrics(pool_name);
CREATE INDEX idx_pool_metrics_recorded ON connection_pool_metrics(recorded_at DESC);

-- =========================================================
-- RLS POLICIES
-- =========================================================

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_pool_metrics ENABLE ROW LEVEL SECURITY;

-- Service role: full access
-- Organization users: read own org, write own org

CREATE POLICY "org_users_read_job_queue" ON job_queue
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "org_users_read_scheduled_jobs" ON scheduled_jobs
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "service_role_cache" ON cache_metadata
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_deployments" ON deployment_history
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_audit_archives" ON audit_archives
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_system_health" ON system_health
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_pool_metrics" ON connection_pool_metrics
  USING (auth.role() = 'service_role');

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

CREATE OR REPLACE FUNCTION update_infra_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_infra_updated_at();

CREATE TRIGGER update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION update_infra_updated_at();

CREATE TRIGGER update_cache_metadata_updated_at
  BEFORE UPDATE ON cache_metadata
  FOR EACH ROW EXECUTE FUNCTION update_infra_updated_at();

CREATE TRIGGER update_deployment_history_updated_at
  BEFORE UPDATE ON deployment_history
  FOR EACH ROW EXECUTE FUNCTION update_infra_updated_at();

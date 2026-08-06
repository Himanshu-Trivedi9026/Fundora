-- Migration: 008_enterprise_organizations_api.sql
-- Phase 8: Enterprise Platform, Organizations & Public API Platform
-- Creates organizations, organization_members, departments, teams,
-- team_members, invitations, organization_roles, organization_settings,
-- api_keys, api_logs, webhooks, webhook_deliveries, developer_apps
-- with RLS, indexes, constraints, triggers, and helper functions.

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: ORGANIZATION TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Organizations ───
-- Multi-tenant organizations (companies, incubators, universities, NGOs, etc.)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  type TEXT NOT NULL DEFAULT 'company' CHECK (type IN (
    'company', 'incubator', 'university', 'ngo', 'government', 'accelerator', 'other'
  )),
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  tax_id TEXT,
  registration_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'archived')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ─── Organization Members ───
-- Maps users to organizations with roles.
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
    'owner', 'admin', 'finance_manager', 'campaign_manager', 'reviewer',
    'auditor', 'moderator', 'member', 'guest'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'suspended', 'pending_invitation'
  )),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  permissions JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ─── Departments ───
-- Hierarchical departments within an organization.
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  budget NUMERIC(12,2) DEFAULT 0 CHECK (budget >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ─── Teams ───
-- Teams within departments or directly under organizations.
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  team_lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ─── Team Members ───
-- Maps users to teams.
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ─── Invitations ───
-- Pending invitations to join an organization.
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
    'owner', 'admin', 'finance_manager', 'campaign_manager', 'reviewer',
    'auditor', 'moderator', 'member', 'guest'
  )),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organization Roles ───
-- Custom roles per organization (in addition to built-in roles).
CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ─── Organization Settings ───
-- Key-value settings per organization.
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, setting_key)
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: API PLATFORM TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── API Keys ───
-- API keys for programmatic access.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER NOT NULL DEFAULT 100,
  rate_window_ms INTEGER NOT NULL DEFAULT 60000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Logs ───
-- Append-only log of all API requests made with API keys.
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  query_params JSONB DEFAULT '{}',
  request_body_hash TEXT,
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address_hash TEXT,
  user_agent TEXT,
  scope_used TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Developer Apps ───
-- OAuth-ready application registrations.
CREATE TABLE IF NOT EXISTS developer_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  app_type TEXT NOT NULL DEFAULT 'web' CHECK (app_type IN ('web', 'mobile', 'server', 'cli', 'other')),
  redirect_uris TEXT[] DEFAULT '{}',
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: WEBHOOK TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── Webhooks ───
-- Registered webhook endpoints for event delivery.
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Webhook Deliveries ───
-- Individual delivery attempts for webhook events.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: INDEXES
-- ═══════════════════════════════════════════════════════════════════

-- organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- organization_members
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);

-- departments
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_department_id);

-- teams
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_department_id ON teams(department_id);

-- team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- invitations
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- organization_roles
CREATE INDEX IF NOT EXISTS idx_organization_roles_org_id ON organization_roles(organization_id);

-- organization_settings
CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id ON organization_settings(organization_id);

-- api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- api_logs
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key_id ON api_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_response_status ON api_logs(response_status);

-- developer_apps
CREATE INDEX IF NOT EXISTS idx_developer_apps_user_id ON developer_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_apps_org_id ON developer_apps(organization_id);
CREATE INDEX IF NOT EXISTS idx_developer_apps_client_id ON developer_apps(client_id);

-- webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_org_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);

-- webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Check if a user is a member of an organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = uid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if a user is an admin or owner of an organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = uid
    AND role IN ('owner', 'admin') AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get a user's role in an organization
CREATE OR REPLACE FUNCTION get_user_org_role(org_id UUID, uid UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM organization_members
  WHERE organization_id = org_id AND user_id = uid AND status = 'active';
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: AUTO-UPDATE TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

CREATE OR REPLACE FUNCTION update_organization_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_organization_members_updated_at();

CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_departments_updated_at();

CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_teams_updated_at();

CREATE OR REPLACE FUNCTION update_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_invitations_updated_at();

CREATE OR REPLACE FUNCTION update_organization_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_roles_updated_at
  BEFORE UPDATE ON organization_roles
  FOR EACH ROW EXECUTE FUNCTION update_organization_roles_updated_at();

CREATE OR REPLACE FUNCTION update_organization_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW EXECUTE FUNCTION update_organization_settings_updated_at();

CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_updated_at();

CREATE OR REPLACE FUNCTION update_developer_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_developer_apps_updated_at
  BEFORE UPDATE ON developer_apps
  FOR EACH ROW EXECUTE FUNCTION update_developer_apps_updated_at();

CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_webhooks_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view organizations"
  ON organizations FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all organizations"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

-- organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view members of same org"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all organization members"
  ON organization_members FOR ALL
  USING (auth.role() = 'service_role');

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view departments"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = departments.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all departments"
  ON departments FOR ALL
  USING (auth.role() = 'service_role');

-- teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view teams"
  ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = teams.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all teams"
  ON teams FOR ALL
  USING (auth.role() = 'service_role');

-- team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view team members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN organization_members ON organization_members.organization_id = teams.organization_id
      WHERE teams.id = team_members.team_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all team members"
  ON team_members FOR ALL
  USING (auth.role() = 'service_role');

-- invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view invitations"
  ON invitations FOR SELECT
  USING (
    is_org_admin(organization_id, auth.uid())
  );

CREATE POLICY "Service role can manage all invitations"
  ON invitations FOR ALL
  USING (auth.role() = 'service_role');

-- organization_roles
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view roles"
  ON organization_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_roles.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all organization roles"
  ON organization_roles FOR ALL
  USING (auth.role() = 'service_role');

-- organization_settings
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view settings"
  ON organization_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_settings.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Service role can manage all organization settings"
  ON organization_settings FOR ALL
  USING (auth.role() = 'service_role');

-- api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all API keys"
  ON api_keys FOR ALL
  USING (auth.role() = 'service_role');

-- api_logs
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API logs"
  ON api_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all API logs"
  ON api_logs FOR ALL
  USING (auth.role() = 'service_role');

-- developer_apps
ALTER TABLE developer_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own developer apps"
  ON developer_apps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all developer apps"
  ON developer_apps FOR ALL
  USING (auth.role() = 'service_role');

-- webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own webhooks"
  ON webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all webhooks"
  ON webhooks FOR ALL
  USING (auth.role() = 'service_role');

-- webhook_deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deliveries for own webhooks"
  ON webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM webhooks
      WHERE webhooks.id = webhook_deliveries.webhook_id
      AND webhooks.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all webhook deliveries"
  ON webhook_deliveries FOR ALL
  USING (auth.role() = 'service_role');

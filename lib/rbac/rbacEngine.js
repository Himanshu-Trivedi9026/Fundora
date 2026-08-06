/**
 * RBAC Engine — Role-Based Access Control for Fundora.
 *
 * Provides permission checking, role assignment, and custom role management
 * for organizations. Platform admins bypass all permission checks.
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Constants ──────────────────────────────────────────────────────

export const PLATFORM_ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  ORG_OWNER: "org_owner",
  ORG_ADMIN: "org_admin",
  FINANCE_MANAGER: "finance_manager",
  CAMPAIGN_MANAGER: "campaign_manager",
  REVIEWER: "reviewer",
  AUDITOR: "auditor",
  MODERATOR: "moderator",
  CREATOR: "creator",
  DONOR: "donor",
  GUEST: "guest",
};

export const PERMISSIONS = {
  // Organization
  ORG_CREATE: "org:create",
  ORG_READ: "org:read",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",
  ORG_MANAGE_MEMBERS: "org:manage_members",
  ORG_MANAGE_SETTINGS: "org:manage_settings",

  // Campaigns
  CAMPAIGN_CREATE: "campaign:create",
  CAMPAIGN_READ: "campaign:read",
  CAMPAIGN_UPDATE: "campaign:update",
  CAMPAIGN_DELETE: "campaign:delete",
  CAMPAIGN_APPROVE: "campaign:approve",

  // Finance
  FINANCE_VIEW: "finance:view",
  FINANCE_MANAGE: "finance:manage",
  FINANCE_APPROVE_PAYOUT: "finance:approve_payout",

  // Compliance
  COMPLIANCE_VIEW: "compliance:view",
  COMPLIANCE_MANAGE: "compliance:manage",

  // Moderation
  MODERATION_VIEW: "moderation:view",
  MODERATION_MANAGE: "moderation:manage",

  // Analytics
  ANALYTICS_VIEW: "analytics:view",
  ANALYTICS_EXPORT: "analytics:export",

  // API
  API_MANAGE: "api:manage",
  API_USE: "api:use",

  // Webhooks
  WEBHOOK_MANAGE: "webhook:manage",

  // Platform Admin
  PLATFORM_ADMIN: "platform:admin",

  // AI
  AI_USE: "ai:use",
  AI_MANAGE: "ai:manage",
  AI_PREDICT: "ai:predict",
  AI_KNOWLEDGE: "ai:knowledge",

  // Automation
  AUTOMATION_USE: "automation:use",
  AUTOMATION_MANAGE: "automation:manage",
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const DEFAULT_ROLE_PERMISSIONS = {
  [PLATFORM_ROLES.PLATFORM_ADMIN]: ALL_PERMISSIONS,
  [PLATFORM_ROLES.ORG_OWNER]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.ORG_DELETE,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
    PERMISSIONS.ORG_MANAGE_SETTINGS,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.CAMPAIGN_DELETE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_APPROVE_PAYOUT,
    PERMISSIONS.COMPLIANCE_VIEW,
    PERMISSIONS.COMPLIANCE_MANAGE,
    PERMISSIONS.MODERATION_VIEW,
    PERMISSIONS.MODERATION_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.API_USE,
    PERMISSIONS.WEBHOOK_MANAGE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_MANAGE,
    PERMISSIONS.AI_PREDICT,
    PERMISSIONS.AI_KNOWLEDGE,
    PERMISSIONS.AUTOMATION_USE,
    PERMISSIONS.AUTOMATION_MANAGE,
  ],
  [PLATFORM_ROLES.ORG_ADMIN]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_MANAGE_MEMBERS,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.COMPLIANCE_VIEW,
    PERMISSIONS.MODERATION_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_MANAGE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_MANAGE,
    PERMISSIONS.AI_PREDICT,
    PERMISSIONS.AI_KNOWLEDGE,
    PERMISSIONS.AUTOMATION_USE,
    PERMISSIONS.AUTOMATION_MANAGE,
  ],
  [PLATFORM_ROLES.FINANCE_MANAGER]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.FINANCE_APPROVE_PAYOUT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [PLATFORM_ROLES.CAMPAIGN_MANAGER]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_PREDICT,
    PERMISSIONS.AUTOMATION_USE,
  ],
  [PLATFORM_ROLES.REVIEWER]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_APPROVE,
    PERMISSIONS.COMPLIANCE_VIEW,
    PERMISSIONS.MODERATION_VIEW,
  ],
  [PLATFORM_ROLES.AUDITOR]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.COMPLIANCE_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
  ],
  [PLATFORM_ROLES.MODERATOR]: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.MODERATION_VIEW,
    PERMISSIONS.MODERATION_MANAGE,
    PERMISSIONS.AI_USE,
  ],
  [PLATFORM_ROLES.CREATOR]: [
    PERMISSIONS.CAMPAIGN_CREATE,
    PERMISSIONS.CAMPAIGN_READ,
    PERMISSIONS.CAMPAIGN_UPDATE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_KNOWLEDGE,
    PERMISSIONS.AUTOMATION_USE,
  ],
  [PLATFORM_ROLES.DONOR]: [PERMISSIONS.CAMPAIGN_READ, PERMISSIONS.AI_USE],
  [PLATFORM_ROLES.GUEST]: [PERMISSIONS.CAMPAIGN_READ],
};

// ─── Platform Admin Check ───────────────────────────────────────────

/**
 * Check if a user is a platform admin.
 * Platform admins have unrestricted access to all features.
 */
export async function checkPlatformAdmin(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    // Check for platform_admin membership (organization_id IS NULL)
    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("role", PLATFORM_ROLES.PLATFORM_ADMIN)
      .is("organization_id", null)
      .maybeSingle();

    if (error) {
      logError("RBAC", "checkPlatformAdmin query error", { error: error.message });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: { isPlatformAdmin: !!data },
    };
  } catch (err) {
    logError("RBAC", "checkPlatformAdmin unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

// ─── Permission Checking ────────────────────────────────────────────

/**
 * Get the permissions for a role.
 */
export function getPermissionsForRole(role) {
  // Check default role permissions
  if (DEFAULT_ROLE_PERMISSIONS[role]) {
    return DEFAULT_ROLE_PERMISSIONS[role];
  }
  return [];
}

/**
 * Check if a user has a specific permission in an organization context.
 * Platform admins always pass.
 * If no organizationId, checks only personal-level permissions.
 */
export async function hasPermission(userId, organizationId, permission) {
  try {
    if (!userId || !permission) {
      return { success: false, error: "userId and permission are required" };
    }

    // Check if platform admin first
    const adminCheck = await checkPlatformAdmin(userId);
    if (adminCheck.success && adminCheck.data.isPlatformAdmin) {
      return {
        success: true,
        data: {
          allowed: true,
          role: PLATFORM_ROLES.PLATFORM_ADMIN,
          permissions: ALL_PERMISSIONS,
          reason: "Platform admin",
        },
      };
    }

    // If no org context, check personal permissions only
    if (!organizationId) {
      return {
        success: true,
        data: {
          allowed: false,
          role: null,
          permissions: [],
          reason: "No organization context",
        },
      };
    }

    // Get user's role in the organization
    const roleResult = await getUserRole(userId, organizationId);
    if (!roleResult.success) {
      return { success: false, error: roleResult.error };
    }

    if (!roleResult.data) {
      return {
        success: true,
        data: {
          allowed: false,
          role: null,
          permissions: [],
          reason: "Not a member of this organization",
        },
      };
    }

    // Get all permissions for the user in this org
    const permsResult = await getUserPermissions(userId, organizationId);
    if (!permsResult.success) {
      return { success: false, error: permsResult.error };
    }

    const allowed = permsResult.data.permissions.includes(permission);

    return {
      success: true,
      data: {
        allowed,
        role: roleResult.data.role,
        permissions: permsResult.data.permissions,
        reason: allowed ? "Permission granted" : "Permission denied",
      },
    };
  } catch (err) {
    logError("RBAC", "hasPermission unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get a user's role in an organization.
 */
export async function getUserRole(userId, organizationId) {
  try {
    if (!userId || !organizationId) {
      return { success: false, error: "userId and organizationId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logError("RBAC", "getUserRole query error", { error: error.message });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data ? { role: data.role } : null,
    };
  } catch (err) {
    logError("RBAC", "getUserRole unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get all permissions for a user in an organization.
 * Combines default role permissions with any custom role overrides.
 */
export async function getUserPermissions(userId, organizationId) {
  try {
    if (!userId || !organizationId) {
      return { success: false, error: "userId and organizationId are required" };
    }

    // Get user's role
    const roleResult = await getUserRole(userId, organizationId);
    if (!roleResult.success) {
      return { success: false, error: roleResult.error };
    }

    if (!roleResult.data) {
      return {
        success: true,
        data: { permissions: [], role: null },
      };
    }

    const role = roleResult.data.role;

    // Get default permissions for this role
    const defaultPerms = getPermissionsForRole(role);

    // Check for custom role in organization_roles
    const { data: customRole, error: customErr } = await supabaseAdmin
      .from("organization_roles")
      .select("permissions")
      .eq("organization_id", organizationId)
      .eq("name", role)
      .maybeSingle();

    if (customErr) {
      logWarn("RBAC", "getUserPermissions custom role query error", { error: customErr.message });
    }

    // Custom role permissions override/extend defaults
    const customPerms = customRole?.permissions || [];
    const allPerms = [...new Set([...defaultPerms, ...customPerms])];

    return {
      success: true,
      data: { permissions: allPerms, role },
    };
  } catch (err) {
    logError("RBAC", "getUserPermissions unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

// ─── Role Management ────────────────────────────────────────────────

/**
 * Set a user's role in an organization.
 * Only admins and owners can change roles.
 */
export async function setOrganizationRole(organizationId, userId, role, performedBy) {
  try {
    if (!organizationId || !userId || !role || !performedBy) {
      return { success: false, error: "organizationId, userId, role, and performedBy are required" };
    }

    // Validate role is a known role
    const validRoles = Object.values(PLATFORM_ROLES);
    if (!validRoles.includes(role)) {
      return { success: false, error: `Invalid role: ${role}. Must be one of: ${validRoles.join(", ")}` };
    }

    // Check performer has manage_members permission
    const permCheck = await hasPermission(performedBy, organizationId, PERMISSIONS.ORG_MANAGE_MEMBERS);
    if (!permCheck.success || !permCheck.data.allowed) {
      return { success: false, error: "Insufficient permissions to change roles" };
    }

    // Update role
    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logError("RBAC", "setOrganizationRole update error", { error: error.message });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "role_changed",
      entityType: "organization_member",
      entityId: data.id,
      userId: performedBy,
      details: {
        organizationId,
        targetUserId: userId,
        newRole: role,
      },
    });

    logInfo("RBAC", "Role updated", { organizationId, userId, role, performedBy });

    return { success: true, data };
  } catch (err) {
    logError("RBAC", "setOrganizationRole unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Create a custom role for an organization.
 * Custom roles extend the default role permissions.
 */
export async function createCustomRole(organizationId, name, permissions, performedBy) {
  try {
    if (!organizationId || !name || !Array.isArray(permissions) || !performedBy) {
      return { success: false, error: "organizationId, name, permissions (array), and performedBy are required" };
    }

    // Check performer has manage_settings permission
    const permCheck = await hasPermission(performedBy, organizationId, PERMISSIONS.ORG_MANAGE_SETTINGS);
    if (!permCheck.success || !permCheck.data.allowed) {
      return { success: false, error: "Insufficient permissions to create custom roles" };
    }

    // Validate all permissions are valid
    const allValidPerms = Object.values(PERMISSIONS);
    const invalidPerms = permissions.filter((p) => !allValidPerms.includes(p));
    if (invalidPerms.length > 0) {
      return { success: false, error: `Invalid permissions: ${invalidPerms.join(", ")}` };
    }

    // Check if role name already exists for this org
    const { data: existing } = await supabaseAdmin
      .from("organization_roles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Role "${name}" already exists in this organization` };
    }

    // Create role
    const { data, error } = await supabaseAdmin
      .from("organization_roles")
      .insert({
        organization_id: organizationId,
        name,
        permissions,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logError("RBAC", "createCustomRole insert error", { error: error.message });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "custom_role_created",
      entityType: "organization_role",
      entityId: data.id,
      userId: performedBy,
      details: { organizationId, name, permissions },
    });

    logInfo("RBAC", "Custom role created", { organizationId, name, performedBy });

    return { success: true, data };
  } catch (err) {
    logError("RBAC", "createCustomRole unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List all roles for an organization (system defaults + custom).
 */
export async function getOrganizationRoles(organizationId) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    // Get custom roles from database
    const { data: customRoles, error } = await supabaseAdmin
      .from("organization_roles")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      logError("RBAC", "getOrganizationRoles query error", { error: error.message });
      return { success: false, error: error.message };
    }

    // Build complete roles list (system defaults + custom)
    const systemRoles = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([name, permissions]) => ({
      name,
      permissions,
      is_system: true,
      description: `Default ${name} role`,
    }));

    const customRolesList = (customRoles || []).map((r) => ({
      name: r.name,
      permissions: r.permissions,
      is_system: r.is_system,
      description: r.description,
      id: r.id,
    }));

    return {
      success: true,
      data: [...systemRoles, ...customRolesList],
    };
  } catch (err) {
    logError("RBAC", "getOrganizationRoles unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Initialize default system roles for an organization.
 * Called when a new organization is created.
 */
export async function initializeOrganizationRoles(organizationId, performedBy) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    const rolesToInit = Object.entries(DEFAULT_ROLE_PERMISSIONS)
      .filter(([name]) => name !== PLATFORM_ROLES.PLATFORM_ADMIN) // Skip platform admin
      .map(([name, permissions]) => ({
        organization_id: organizationId,
        name,
        permissions,
        is_system: true,
        description: `Default ${name} role`,
      }));

    const { data, error } = await supabaseAdmin
      .from("organization_roles")
      .insert(rolesToInit)
      .select();

    if (error) {
      logError("RBAC", "initializeOrganizationRoles insert error", { error: error.message });
      return { success: false, error: error.message };
    }

    logInfo("RBAC", "Organization roles initialized", { organizationId, count: data.length });

    return { success: true, data };
  } catch (err) {
    logError("RBAC", "initializeOrganizationRoles unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

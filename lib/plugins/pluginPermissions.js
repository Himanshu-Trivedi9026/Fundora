// Plugin Permissions — sandboxed permission checking for plugins
// Extends the existing RBAC pattern from lib/rbac/

export const PLUGIN_PERMISSIONS = {
  STORAGE_READ: "storage:read",
  STORAGE_WRITE: "storage:write",
  STORAGE_DELETE: "storage:delete",
  DATABASE_READ: "database:read",
  DATABASE_WRITE: "database:write",
  API_CALL: "api:call",
  API_RECEIVE_WEBHOOK: "api:receive_webhook",
  NOTIFICATION_SEND: "notification:send",
  NOTIFICATION_READ: "notification:read",
  UI_INJECT: "ui:inject",
  UI_MODIFY: "ui:modify",
  USER_READ: "user:read",
  USER_EMAIL: "user:email",
  PAYMENT_READ: "payment:read",
  PAYMENT_WRITE: "payment:write",
  CAMPAIGN_READ: "campaign:read",
  CAMPAIGN_WRITE: "campaign:write",
  ADMIN_READ: "admin:read",
  ADMIN_WRITE: "admin:write",
};

// Permission risk levels for audit/approval
export const PERMISSION_RISK_LEVELS = {
  "storage:read": "low",
  "storage:write": "medium",
  "storage:delete": "high",
  "database:read": "medium",
  "database:write": "high",
  "api:call": "low",
  "api:receive_webhook": "medium",
  "notification:send": "low",
  "notification:read": "low",
  "ui:inject": "medium",
  "ui:modify": "medium",
  "user:read": "medium",
  "user:email": "low",
  "payment:read": "high",
  "payment:write": "critical",
  "campaign:read": "low",
  "campaign:write": "medium",
  "admin:read": "critical",
  "admin:write": "critical",
};

export function checkPluginPermission(pluginPermissions, requiredPermission) {
  if (!Array.isArray(pluginPermissions)) {
    return { allowed: false, reason: "Plugin has no permissions defined" };
  }

  if (pluginPermissions.includes("*")) {
    return { allowed: true, reason: "Wildcard permission granted" };
  }

  if (pluginPermissions.includes(requiredPermission)) {
    return { allowed: true, reason: "Permission granted" };
  }

  return {
    allowed: false,
    reason: `Missing permission: ${requiredPermission}`,
  };
}

export function checkAllPermissions(pluginPermissions, requiredPermissions) {
  for (const perm of requiredPermissions) {
    const result = checkPluginPermission(pluginPermissions, perm);
    if (!result.allowed) {
      return { allowed: false, missing: perm, reason: result.reason };
    }
  }
  return { allowed: true, missing: null, reason: "All permissions granted" };
}

export function getPermissionRiskLevel(permission) {
  return PERMISSION_RISK_LEVELS[permission] || "medium";
}

export function getHighestRiskLevel(permissions) {
  const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  let highest = "low";
  for (const perm of permissions) {
    const level = getPermissionRiskLevel(perm);
    if (riskOrder[level] > riskOrder[highest]) {
      highest = level;
    }
  }
  return highest;
}

export function requiresApproval(permissions) {
  const level = getHighestRiskLevel(permissions);
  return level === "high" || level === "critical";
}

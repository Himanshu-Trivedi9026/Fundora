/**
 * RBAC barrel exports.
 */

export {
  checkPlatformAdmin,
  hasPermission,
  getUserRole,
  getUserPermissions,
  setOrganizationRole,
  createCustomRole,
  getOrganizationRoles,
  initializeOrganizationRoles,
  PLATFORM_ROLES,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from "./rbacEngine.js";

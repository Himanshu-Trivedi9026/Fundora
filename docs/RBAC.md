# Role-Based Access Control (RBAC)

Platform-wide and per-organization role-based access control for Fundora. Provides permission checking, role assignment, custom role creation, and integration with the authentication middleware.

## Overview

The RBAC Engine provides fine-grained permission control across the Fundora platform. It operates at two levels:

1. **Platform level** — Platform admins have unrestricted access to all features.
2. **Organization level** — Users have roles within organizations that grant specific permissions. Custom roles can extend the default permission sets.

All functions follow the `{ success: boolean, data?, error? }` return pattern and never throw.

### Key Design Principles

- **Platform admins bypass everything** — `checkPlatformAdmin` is always checked first.
- **Default role permissions are defined in code** — Stored in `DEFAULT_ROLE_PERMISSIONS` as a constant map.
- **Custom roles extend defaults** — Custom roles stored in `organization_roles` add permissions on top of the default set for a given role name.
- **Permission unions, not intersections** — When both default and custom permissions exist, they are merged (union), meaning custom roles can only **add** permissions, never remove them.
- **Integrated with `withAuth`** — The `withAuthAndPermission` middleware composes authentication with RBAC checks.

## Constants

### `PLATFORM_ROLES`

```js
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
```

### `PERMISSIONS`

```js
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
};
```

## Platform Roles and Permissions

### Default Permission Matrix

| Role | Permissions |
|------|-------------|
| **platform_admin** | ALL permissions (unrestricted) |
| **org_owner** | `org:read`, `org:update`, `org:delete`, `org:manage_members`, `org:manage_settings`, `campaign:create/read/update/delete`, `finance:view/manage/approve_payout`, `compliance:view/manage`, `moderation:view/manage`, `analytics:view/export`, `api:manage/use`, `webhook:manage` |
| **org_admin** | `org:read`, `org:manage_members`, `campaign:create/read/update`, `finance:view`, `compliance:view`, `moderation:view`, `analytics:view`, `api:manage`, `webhook:manage` |
| **finance_manager** | `org:read`, `campaign:read`, `finance:view/manage/approve_payout`, `analytics:view` |
| **campaign_manager** | `org:read`, `campaign:create/read/update`, `analytics:view` |
| **reviewer** | `org:read`, `campaign:read/approve`, `compliance:view`, `moderation:view` |
| **auditor** | `org:read`, `campaign:read`, `finance:view`, `compliance:view`, `analytics:view/export` |
| **moderator** | `org:read`, `campaign:read`, `moderation:view/manage` |
| **creator** | `campaign:create/read/update` |
| **donor** | `campaign:read` |
| **guest** | `campaign:read` |

### Permission Categories

Permissions follow a `resource:action` naming convention:

- **`org:*`** — Organization management (create, read, update, delete, manage members, manage settings)
- **`campaign:*`** — Campaign CRUD and approval
- **`finance:*`** — Financial data viewing, management, and payout approval
- **`compliance:*`** — Compliance case viewing and management
- **`moderation:*`** — Content moderation viewing and management
- **`analytics:*`** — Analytics data viewing and export
- **`api:*`** — API key management and usage
- **`webhook:*`** — Webhook management
- **`platform:admin`** — Full platform administration

## Core Functions

### `checkPlatformAdmin(userId)`

Check if a user is a platform admin. Platform admins are identified by a membership record in `organization_members` with `organization_id = NULL` and `role = "platform_admin"`.

```js
import { checkPlatformAdmin } from "@/lib/rbac";

const result = await checkPlatformAdmin("user-uuid");
// result.data: { isPlatformAdmin: true/false }
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | User UUID |

**Returns:**

```js
{ success: true, data: { isPlatformAdmin: boolean } }
```

---

### `hasPermission(userId, organizationId, permission)`

Check if a user has a specific permission in an organization context. This is the primary permission-checking function used throughout the platform.

```js
import { hasPermission } from "@/lib/rbac";

const result = await hasPermission("user-uuid", "org-uuid", "campaign:create");
// result.data: {
//   allowed: true,
//   role: "campaign_manager",
//   permissions: ["campaign:create", ...],
//   reason: "Permission granted"
// }
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | User UUID |
| `organizationId` | `string` | No | Organization UUID (null for personal context) |
| `permission` | `string` | Yes | Permission string from `PERMISSIONS` |

**Flow:**

1. Check if the user is a **platform admin** → if yes, always allowed (returns all permissions).
2. If no `organizationId`, returns `allowed: false` with reason "No organization context".
3. Look up the user's role in the organization via `getUserRole`.
4. If not a member, returns `allowed: false`.
5. Get all effective permissions via `getUserPermissions` (default + custom role union).
6. Check if the requested permission is in the set.

**Returns:**

```js
{
  success: true,
  data: {
    allowed: boolean,
    role: string | null,
    permissions: string[],
    reason: string,
  }
}
```

---

### `getPermissionsForRole(role)`

Get the default permissions for a built-in role. Returns the permissions array from `DEFAULT_ROLE_PERMISSIONS`, or an empty array for unknown roles.

```js
import { getPermissionsForRole } from "@/lib/rbac";

const perms = getPermissionsForRole("campaign_manager");
// ["campaign:create", "campaign:read", "campaign:update", "analytics:view"]
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `role` | `string` | Yes | Role name from `PLATFORM_ROLES` |

---

### `getUserRole(userId, organizationId)`

Get a user's current role within an organization.

```js
const result = await getUserRole("user-uuid", "org-uuid");
// result.data: { role: "admin" } or null
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | User UUID |
| `organizationId` | `string` | Yes | Organization UUID |

---

### `getUserPermissions(userId, organizationId)`

Get the complete set of permissions for a user in an organization. Combines default role permissions with any custom role overrides from `organization_roles`.

```js
const result = await getUserPermissions("user-uuid", "org-uuid");
// result.data: {
//   permissions: ["campaign:create", "campaign:read", ...],
//   role: "campaign_manager"
// }
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | Yes | User UUID |
| `organizationId` | `string` | Yes | Organization UUID |

**Resolution logic:**
1. Get the user's role in the organization.
2. Fetch default permissions for that role from `DEFAULT_ROLE_PERMISSIONS`.
3. Fetch any custom role entry with the same name from `organization_roles`.
4. Merge both sets (union) to produce the final permission list.

---

### `setOrganizationRole(organizationId, userId, role, performedBy)`

Assign a new role to a user within an organization. Requires the `org:manage_members` permission.

```js
import { setOrganizationRole } from "@/lib/rbac";

const result = await setOrganizationRole("org-uuid", userId, "finance_manager", adminUserId);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationId` | `string` | Yes | Organization UUID |
| `userId` | `string` | Yes | Target user UUID |
| `role` | `string` | Yes | One of `PLATFORM_ROLES` values |
| `performedBy` | `string` | Yes | User performing the action |

**Side effects:** Logs a `role_changed` audit event.

---

### `createCustomRole(organizationId, name, permissions, performedBy)`

Create a custom role for an organization. Requires the `org:manage_settings` permission. Custom roles are stored in `organization_roles` and extend (union with) the default permissions for the same-named built-in role.

```js
import { createCustomRole, PERMISSIONS } from "@/lib/rbac";

const result = await createCustomRole(
  "org-uuid",
  "finance_reviewer",
  [PERMISSIONS.FINANCE_VIEW, PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_EXPORT],
  adminUserId
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationId` | `string` | Yes | Organization UUID |
| `name` | `string` | Yes | Role name (must be unique within the org) |
| `permissions` | `string[]` | Yes | Array of permission strings |
| `performedBy` | `string` | Yes | User performing the action |

**Validation:**
- All permission strings must be valid values from `PERMISSIONS`.
- Role name must be unique within the organization.
- The performing user must have `org:manage_settings` permission.

**Side effects:** Logs a `custom_role_created` audit event.

---

### `getOrganizationRoles(organizationId)`

List all roles available in an organization, including both system defaults and custom roles.

```js
const result = await getOrganizationRoles("org-uuid");
// result.data: [
//   { name: "org_owner", permissions: [...], is_system: true, description: "..." },
//   { name: "finance_reviewer", permissions: [...], is_system: false, id: "..." },
//   ...
// ]
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationId` | `string` | Yes | Organization UUID |

---

### `initializeOrganizationRoles(organizationId, performedBy)`

Initialize the default system roles for a newly created organization. Inserts all roles from `DEFAULT_ROLE_PERMISSIONS` (except `platform_admin`) into `organization_roles` with `is_system: true`.

```js
const result = await initializeOrganizationRoles("org-uuid", ownerId);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationId` | `string` | Yes | Organization UUID |
| `performedBy` | `string` | No | User performing initialization |

## Custom Roles

Custom roles allow organizations to define their own role names with specific permission sets. Key behaviors:

1. **Extends, not replaces** — Custom role permissions are merged (union) with default permissions for a matching role name.
2. **Named roles** — Custom roles have a name that maps to a `PLATFORM_ROLES` value. For example, a custom role named `"campaign_manager"` adds permissions on top of the default `campaign_manager` permissions.
3. **Organization-scoped** — Custom roles are scoped to a single organization.
4. **Non-system roles** — Custom roles are created with `is_system: false`. System roles are seeded by `initializeOrganizationRoles`.

```js
// The "campaign_manager" role already has: campaign:create, campaign:read, campaign:update, analytics:view
// Adding a custom role entry for "campaign_manager" with additional permissions:
await createCustomRole(orgId, "campaign_manager", [
  PERMISSIONS.CAMPAIGN_APPROVE,  // Extra permission
], userId);

// Effective permissions for "campaign_manager" in this org:
// campaign:create, campaign:read, campaign:update, analytics:view, campaign:approve
```

## Integration with `withAuth` Middleware

The RBAC Engine integrates with the Fundora authentication middleware via two functions in `lib/withAuth.js`:

### `withAuth(handler)`

Standard authentication wrapper. Validates the Bearer token and attaches the user to `req.user`.

```js
import { withAuth } from "@/lib/withAuth";

export default withAuth(async function handler(req, res, user) {
  // user is guaranteed to exist
  return res.status(200).json({ userId: user.id });
});
```

### `withAuthAndPermission(handler, permission)`

Authentication + RBAC permission check. Composes `withAuth` with a permission check, extracting `organizationId` from `req.query` or `req.body`.

```js
import { withAuthAndPermission } from "@/lib/withAuth";

// Only users with "campaign:create" permission can access this route
export default withAuthAndPermission(async function handler(req, res, user) {
  // user is authenticated and has the required permission
  // req.userRole and req.userPermissions are populated
  return res.status(200).json({ success: true });
}, "campaign:create");
```

**Behavior:**
1. Authenticates the user (same as `withAuth`).
2. Extracts `organizationId` from `req.query.organizationId` or `req.body.organizationId`.
3. Calls `hasPermission(user.id, orgId, permission)`.
4. Returns `403 Forbidden` if permission is denied.
5. Attaches `req.userRole` and `req.userPermissions` for downstream use.

**403 Response:**

```json
{
  "error": "Forbidden",
  "requiredPermission": "campaign:create",
  "reason": "Permission denied"
}
```

## Permission Checking Flow

```
Request arrives
    │
    ▼
withAuth extracts Bearer token
    │
    ▼
supabaseAdmin.auth.getUser(token)
    │
    ├── Invalid → 401 Unauthorized
    │
    ▼
withAuthAndPermission extracts organizationId
    │
    ▼
hasPermission(userId, orgId, permission)
    │
    ├── checkPlatformAdmin(userId)
    │   └── Is platform_admin? → YES: allowed = true (bypass)
    │
    ├── No orgId → allowed = false (no org context)
    │
    ├── getUserRole(userId, orgId)
    │   └── Not a member? → allowed = false
    │
    ├── getUserPermissions(userId, orgId)
    │   ├── getPermissionsForRole(role) → default permissions
    │   ├── Query organization_roles → custom permissions
    │   └── Merge (union) → effective permissions
    │
    └── permission in effectivePermissions?
        ├── YES → allowed = true
        └── NO → allowed = false
```

## Database Tables

| Table | Description |
|-------|-------------|
| `organization_members` | Stores user role assignments per organization. Platform admins have `organization_id = NULL`. |
| `organization_roles` | Custom role definitions with permission arrays. `is_system = true` for defaults. |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/rbac/roles` | GET | List roles for an organization (`organizationId` param) or list available permissions (`mode=permissions`) |
| `/api/rbac/roles` | POST | `create_custom_role` — Create a custom role; `assign_role` — Assign a role to a user |

## Tests

- `tests/lib/rbac/rbacEngine.test.js` — Unit tests for all RBAC functions
- `tests/integration/rbac-integration.test.js` — Integration tests for RBAC with organization context
- `tests/security/rbac-security.test.js` — Security tests verifying permission bypasses are blocked

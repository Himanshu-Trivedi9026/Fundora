# Organization Engine

Multi-tenant organization management for the Fundora enterprise platform. Provides full CRUD for organizations, member management with role-based access, invitation workflows, hierarchical departments and teams, and key-value settings.

## Overview

The Organization Engine enables Fundora to support enterprise customers who operate as organizations (companies, incubators, universities, NGOs, etc.). Each organization is a multi-tenant container with its own members, roles, departments, teams, settings, and API keys.

All functions follow a consistent `{ success: boolean, data?, error? }` return pattern and never throw exceptions. All mutations are audit-logged via `logAuditEvent`, and all database operations use `supabaseAdmin` (service role) for server-side access.

### Key Design Principles

- **Soft deletes** — Organizations are soft-deleted (`deleted_at` timestamp) rather than hard-deleted, preserving referential integrity.
- **Slug uniqueness** — Each organization has a unique URL slug for public-facing pages.
- **Owner protections** — The organization owner cannot be removed or have their role downgraded by other admins.
- **Invitation expiry** — Invitations expire after 7 days and must be accepted or revoked before then.
- **Hierarchical structure** — Departments support parent-child relationships; teams can belong to departments or directly to organizations.

## Constants

### `ORG_TYPES`

```js
export const ORG_TYPES = [
  "company",
  "incubator",
  "university",
  "ngo",
  "government",
  "accelerator",
  "other",
];
```

### `ORG_STATUSES`

```js
export const ORG_STATUSES = ["active", "suspended", "pending", "archived"];
```

### `ORG_ROLES`

```js
export const ORG_ROLES = [
  "owner",
  "admin",
  "finance_manager",
  "campaign_manager",
  "reviewer",
  "auditor",
  "moderator",
  "member",
  "guest",
];
```

## Organization CRUD

### `createOrganization(options)`

Create a new organization and automatically add the creator as `owner`.

```js
import { createOrganization } from "@/lib/organization";

const result = await createOrganization({
  name: "Acme Corp",
  slug: "acme-corp",
  type: "company", // optional, default: "company"
  description: "...", // optional
  website: "...", // optional
  ownerId: "uuid", // required — the creating user
  industry: "technology", // optional
  size: "51-200", // optional
  contactEmail: "...", // optional
  contactPhone: "...", // optional
  metadata: {}, // optional, default: {}
});
```

**Parameters:**

| Parameter      | Type     | Required | Default     | Description                      |
| -------------- | -------- | -------- | ----------- | -------------------------------- |
| `name`         | `string` | Yes      | —           | Display name of the organization |
| `slug`         | `string` | Yes      | —           | URL-safe unique identifier       |
| `type`         | `string` | No       | `"company"` | One of `ORG_TYPES`               |
| `description`  | `string` | No       | —           | Organization description         |
| `website`      | `string` | No       | —           | Website URL                      |
| `ownerId`      | `string` | Yes      | —           | UUID of the creating user        |
| `industry`     | `string` | No       | —           | Industry sector                  |
| `size`         | `string` | No       | —           | Company size bracket             |
| `contactEmail` | `string` | No       | —           | Contact email                    |
| `contactPhone` | `string` | No       | —           | Contact phone                    |
| `metadata`     | `object` | No       | `{}`        | Arbitrary JSON metadata          |

**Returns:**

```js
{ success: true, data: Organization }
// or
{ success: false, error: "name, slug, and ownerId are required" }
```

**Side effects:**

- Adds the `ownerId` user as an `owner` member in `organization_members`.
- Logs an `organization_created` audit event.

---

### `getOrganization(orgId)`

Fetch an organization by its UUID. Excludes soft-deleted organizations.

```js
const result = await getOrganization("org-uuid");
// result.data: { id, name, slug, type, owner_id, ... }
```

**Parameters:**

| Parameter | Type     | Required | Description       |
| --------- | -------- | -------- | ----------------- |
| `orgId`   | `string` | Yes      | Organization UUID |

---

### `getOrganizationBySlug(slug)`

Fetch an organization by its URL slug. Excludes soft-deleted organizations.

```js
const result = await getOrganizationBySlug("acme-corp");
```

**Parameters:**

| Parameter | Type     | Required | Description       |
| --------- | -------- | -------- | ----------------- |
| `slug`    | `string` | Yes      | Organization slug |

---

### `updateOrganization(orgId, updates, userId)`

Update an organization's fields. Only the `owner` or `admin` members can update.

```js
const result = await updateOrganization(
  "org-uuid",
  {
    name: "Acme Corporation",
    description: "Updated description",
    settings: { theme: "dark" },
  },
  user.id,
);
```

**Parameters:**

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `orgId`   | `string` | Yes      | Organization UUID              |
| `updates` | `object` | Yes      | Fields to update (whitelisted) |
| `userId`  | `string` | Yes      | User performing the update     |

**Allowed update fields:** `name`, `description`, `website`, `logo_url`, `type`, `industry`, `size`, `tax_id`, `registration_number`, `contact_email`, `contact_phone`, `address`, `settings`, `metadata`, `status`

**Side effects:** Logs an `organization_updated` audit event.

---

### `deleteOrganization(orgId, userId)`

Soft-delete an organization. Only the **owner** can delete. Sets `deleted_at` timestamp and changes status to `archived`.

```js
const result = await deleteOrganization("org-uuid", user.id);
```

**Parameters:**

| Parameter | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `orgId`   | `string` | Yes      | Organization UUID              |
| `userId`  | `string` | Yes      | Must be the organization owner |

**Side effects:** Logs an `organization_deleted` audit event.

---

### `listOrganizations(options)`

List organizations with optional filters. Excludes soft-deleted organizations. Sorted by `created_at` descending.

```js
const result = await listOrganizations({
  userId: "uuid", // optional — only orgs user belongs to
  type: "company", // optional filter
  status: "active", // optional filter
  limit: 50, // default: 50
  offset: 0, // default: 0
});
// result.data: Organization[], result.total: number
```

**Parameters:**

| Parameter | Type     | Required | Default | Description                    |
| --------- | -------- | -------- | ------- | ------------------------------ |
| `userId`  | `string` | No       | —       | Filter to user's organizations |
| `type`    | `string` | No       | —       | Filter by organization type    |
| `status`  | `string` | No       | —       | Filter by status               |
| `limit`   | `number` | No       | `50`    | Pagination limit               |
| `offset`  | `number` | No       | `0`     | Pagination offset              |

---

### `getUserOrganizations(userId)`

Get all organizations a user belongs to, with their membership role and join date.

```js
const result = await getUserOrganizations(user.id);
// result.data: [{ ...org, membership_role: "admin", membership_joined_at: "..." }]
```

**Parameters:**

| Parameter | Type     | Required | Description |
| --------- | -------- | -------- | ----------- |
| `userId`  | `string` | Yes      | User UUID   |

---

### `transferOwnership(orgId, currentOwnerId, newOwnerId)`

Transfer organization ownership. The current owner becomes an admin, and the new owner is assigned the `owner` role.

```js
const result = await transferOwnership(
  "org-uuid",
  currentOwner.id,
  newOwner.id,
);
```

**Parameters:**

| Parameter        | Type     | Required | Description              |
| ---------------- | -------- | -------- | ------------------------ |
| `orgId`          | `string` | Yes      | Organization UUID        |
| `currentOwnerId` | `string` | Yes      | Must be current owner    |
| `newOwnerId`     | `string` | Yes      | Must be an active member |

**Side effects:** Logs an `ownership_transferred` audit event.

---

### `archiveOrganization(orgId, userId)`

Archive an organization (set status to `archived`). Requires `owner` or `admin` role.

```js
const result = await archiveOrganization("org-uuid", user.id);
```

**Side effects:** Logs an `organization_archived` audit event.

## Member Management

### `addMember(options)`

Add a user to an organization. If the user was previously a member (now inactive), they are reactivated with the new role.

```js
const result = await addMember({
  organizationId: "org-uuid",
  userId: "user-uuid",
  role: "campaign_manager", // optional, default: "member"
  invitedBy: "admin-uuid", // optional
});
```

**Parameters:**

| Parameter        | Type     | Required | Default    | Description           |
| ---------------- | -------- | -------- | ---------- | --------------------- |
| `organizationId` | `string` | Yes      | —          | Organization UUID     |
| `userId`         | `string` | Yes      | —          | User to add           |
| `role`           | `string` | No       | `"member"` | One of `ORG_ROLES`    |
| `invitedBy`      | `string` | No       | —          | User who invited them |

**Side effects:** Logs `member_added` or `member_reactivated` audit event.

---

### `removeMember(organizationId, userId, performedBy)`

Remove a member (set status to `inactive`). Requires `owner` or `admin` role. Cannot remove the organization owner.

```js
const result = await removeMember("org-uuid", targetUser.id, adminUser.id);
```

**Parameters:**

| Parameter        | Type     | Required | Description            |
| ---------------- | -------- | -------- | ---------------------- |
| `organizationId` | `string` | Yes      | Organization UUID      |
| `userId`         | `string` | Yes      | Member to remove       |
| `performedBy`    | `string` | Yes      | Must be owner or admin |

**Side effects:** Logs a `member_removed` audit event.

---

### `updateMemberRole(organizationId, userId, newRole, performedBy)`

Update a member's role within an organization. Requires `owner` or `admin` role.

```js
const result = await updateMemberRole(
  "org-uuid",
  userId,
  "finance_manager",
  adminId,
);
```

**Parameters:**

| Parameter        | Type     | Required | Description            |
| ---------------- | -------- | -------- | ---------------------- |
| `organizationId` | `string` | Yes      | Organization UUID      |
| `userId`         | `string` | Yes      | Member to update       |
| `newRole`        | `string` | Yes      | One of `ORG_ROLES`     |
| `performedBy`    | `string` | Yes      | Must be owner or admin |

**Side effects:** Logs a `member_role_updated` audit event.

---

### `getMembers(organizationId, options)`

List members of an organization with optional role/status filters.

```js
const result = await getMembers("org-uuid", {
  role: "admin", // optional filter
  status: "active", // optional, default: "active"
  limit: 50, // default: 50
  offset: 0, // default: 0
});
// result.data: Member[], result.total: number
```

---

### `getMember(organizationId, userId)`

Get a specific member record.

```js
const result = await getMember("org-uuid", "user-uuid");
```

## Invitation Management

The invitation flow allows organization admins/owners to invite users by email. Invitations generate a 48-character random token, expire after 7 days, and can be in one of four states: `pending`, `accepted`, `expired`, `revoked`.

### `createInvitation(options)`

Create an invitation to join an organization.

```js
const result = await createInvitation({
  organizationId: "org-uuid",
  email: "newuser@example.com",
  role: "member", // optional, default: "member"
  invitedBy: "admin-uuid", // required
});
// result.data.token — share this token with the invitee
```

**Parameters:**

| Parameter        | Type     | Required | Default    | Description                     |
| ---------------- | -------- | -------- | ---------- | ------------------------------- |
| `organizationId` | `string` | Yes      | —          | Organization UUID               |
| `email`          | `string` | Yes      | —          | Invitee's email                 |
| `role`           | `string` | No       | `"member"` | Role to assign on acceptance    |
| `invitedBy`      | `string` | Yes      | —          | Admin/owner creating the invite |

**Validation:**

- Requires `owner` or `admin` role for the `invitedBy` user.
- Rejects duplicate pending invitations for the same email + organization.
- Token expires after 7 days.

**Side effects:** Logs an `invitation_created` audit event.

---

### `acceptInvitation(invitationId, userId)`

Accept a pending invitation, adding the user as a member.

```js
const result = await acceptInvitation("invitation-uuid", "user-uuid");
```

**Parameters:**

| Parameter      | Type     | Required | Description                   |
| -------------- | -------- | -------- | ----------------------------- |
| `invitationId` | `string` | Yes      | Invitation UUID               |
| `userId`       | `string` | Yes      | User accepting the invitation |

**Validation:**

- Invitation must be in `pending` status.
- Invitation must not be expired.
- Calls `addMember` internally to create the membership.

**Side effects:** Logs an `invitation_accepted` audit event.

---

### `revokeInvitation(invitationId, performedBy)`

Revoke a pending invitation. Requires `owner` or `admin` role.

```js
const result = await revokeInvitation("invitation-uuid", adminId);
```

---

### `getInvitations(organizationId, options)`

List invitations for an organization.

```js
const result = await getInvitations("org-uuid", {
  status: "pending", // optional filter
  limit: 50,
  offset: 0,
});
```

## Department Management

Departments support a hierarchical structure via `parent_department_id`.

### `createDepartment(options)`

```js
const result = await createDepartment({
  organizationId: "org-uuid",
  name: "Engineering",
  parentDepartmentId: null, // optional
  headUserId: "user-uuid", // optional
  description: "Core engineering team",
});
```

**Parameters:**

| Parameter            | Type     | Required | Default | Description               |
| -------------------- | -------- | -------- | ------- | ------------------------- |
| `organizationId`     | `string` | Yes      | —       | Organization UUID         |
| `name`               | `string` | Yes      | —       | Department name           |
| `parentDepartmentId` | `string` | No       | `null`  | Parent department UUID    |
| `headUserId`         | `string` | No       | `null`  | Department head user UUID |
| `description`        | `string` | No       | —       | Department description    |

---

### `updateDepartment(departmentId, updates, performedBy)`

**Allowed update fields:** `name`, `description`, `parent_department_id`, `head_user_id`, `budget`, `status`, `metadata`

### `deleteDepartment(departmentId, performedBy)`

Hard-deletes a department.

### `getDepartments(organizationId)`

List all departments for an organization, sorted by name.

## Team Management

Teams can belong to a department or directly to an organization.

### `createTeam(options)`

```js
const result = await createTeam({
  organizationId: "org-uuid",
  departmentId: "dept-uuid", // optional
  name: "Frontend Team",
  teamLeadId: "user-uuid", // optional
  description: "...",
});
```

### `addTeamMember(teamId, userId, role)`

Add a member to a team. Default role is `"member"`.

### `removeTeamMember(teamId, userId)`

Remove a member from a team.

### `getTeams(organizationId, options)`

List teams, optionally filtered by `departmentId`.

## Settings Management

Key-value settings stored per organization in the `organization_settings` table.

### `getOrganizationSettings(organizationId)`

Returns all settings as a key-value object.

```js
const result = await getOrganizationSettings("org-uuid");
// result.data: { "theme": "dark", "currency": "INR", ... }
```

### `setOrganizationSetting(organizationId, key, value, performedBy)`

Upsert a single setting. Logs an `org_setting_changed` audit event when `performedBy` is provided.

```js
const result = await setOrganizationSetting(
  "org-uuid",
  "theme",
  "dark",
  userId,
);
```

### `getOrganizationSetting(organizationId, key)`

Get a single setting value.

```js
const result = await getOrganizationSetting("org-uuid", "theme");
// result.data: "dark" or null
```

## Error Handling Patterns

All functions follow a consistent error handling pattern:

1. **Parameter validation** — Missing required parameters return `{ success: false, error: "..." }` immediately.
2. **Business logic validation** — Invalid types, duplicate slugs, insufficient permissions, etc.
3. **Database errors** — Caught and returned as `{ success: false, error: dbError.message }`.
4. **Unexpected errors** — Caught by the outer `try/catch` and returned as `{ success: false, error: "Internal error" }`.
5. **No exceptions** — Functions never throw. Callers always check `result.success`.

```js
const result = await createOrganization({ name: "Test" });
if (!result.success) {
  console.error(result.error); // "name, slug, and ownerId are required"
  return;
}
// Use result.data
```

## Database Tables

The Organization Engine uses the following tables (created in migration `008_enterprise_organizations_api.sql`):

| Table                   | Description                               |
| ----------------------- | ----------------------------------------- |
| `organizations`         | Organization records with soft delete     |
| `organization_members`  | User ↔ Organization mapping with roles    |
| `departments`           | Hierarchical department structure         |
| `teams`                 | Teams within departments or organizations |
| `team_members`          | User ↔ Team mapping                       |
| `invitations`           | Pending invitations with tokens           |
| `organization_roles`    | Custom role definitions per organization  |
| `organization_settings` | Key-value settings per organization       |

## API Routes

| Route                           | Method   | Actions                                                       |
| ------------------------------- | -------- | ------------------------------------------------------------- |
| `/api/organization`             | GET      | `orgId`, `slug`, `mode=my`, list                              |
| `/api/organization`             | POST     | `create`, `update`, `delete`, `archive`, `transfer_ownership` |
| `/api/organization/members`     | GET/POST | Member management                                             |
| `/api/organization/invitations` | GET/POST | Invitation management                                         |
| `/api/organization/departments` | GET/POST | Department management                                         |
| `/api/organization/teams`       | GET/POST | Team management                                               |
| `/api/organization/settings`    | GET/POST | Settings management                                           |
| `/api/organization/analytics`   | GET      | Organization analytics                                        |

## Tests

- `tests/lib/organization/organizationEngine.test.js` — Comprehensive unit tests covering all CRUD operations, member management, invitations, departments, teams, and settings.

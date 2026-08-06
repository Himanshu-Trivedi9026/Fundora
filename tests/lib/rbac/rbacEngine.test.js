/**
 * RBAC Engine Tests — Unit tests for role-based access control.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
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
} from "../../../lib/rbac/rbacEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

/**
 * Build a chainable mock object from a final resolved result.
 * Usage: chainMock({maybeSingle: {data: {...}, error: null}})
 * Creates: from→select→eq→eq→eq→maybeSingle (for 3 eqs)
 */
function buildChain({ eqs = 0, terminal, terminalValue }) {
  if (eqs === 0) {
    return { [terminal]: vi.fn().mockResolvedValue(terminalValue) };
  }
  return {
    eq: vi
      .fn()
      .mockReturnValue(buildChain({ eqs: eqs - 1, terminal, terminalValue })),
  };
}

function chainFrom(result) {
  return {
    select: vi.fn().mockReturnValue(
      buildChain({
        eqs: result.eqs || 0,
        terminal: result.terminal,
        terminalValue: result.value,
      }),
    ),
  };
}

// ─── Mock chain builders ──────────────────────────────────────────────

/**
 * Build a checkPlatformAdmin mock: from→select→eq→eq→is→maybeSingle
 */
function mockCheckPlatformAdmin(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(data),
          }),
        }),
      }),
    }),
  };
}

/**
 * Build a getUserRole mock: from→select→eq→eq→eq→maybeSingle (3 eqs)
 */
function mockGetUserRole(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(data),
          }),
        }),
      }),
    }),
  };
}

/**
 * Build a org_roles lookup mock: from→select→eq→eq→maybeSingle (2 eqs)
 */
function mockOrgRolesLookup(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(data),
        }),
      }),
    }),
  };
}

/**
 * Build a select→eq→order mock for getOrganizationRoles
 */
function mockOrderQuery(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

/**
 * Build an update→eq→eq→select→single mock
 */
function mockUpdate(data) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(data),
          }),
        }),
      }),
    }),
  };
}

/**
 * Build an insert→select→single mock
 */
function mockInsert(data) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

describe("RBAC Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPlatformAdmin", () => {
    it("should return true for platform admin", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockCheckPlatformAdmin({
          data: { role: "platform_admin" },
          error: null,
        }),
      );

      const result = await checkPlatformAdmin("user-1");
      expect(result.success).toBe(true);
      expect(result.data.isPlatformAdmin).toBe(true);
    });

    it("should return false for non-admin", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockCheckPlatformAdmin({ data: null, error: null }),
      );

      const result = await checkPlatformAdmin("user-1");
      expect(result.success).toBe(true);
      expect(result.data.isPlatformAdmin).toBe(false);
    });

    it("should fail without userId", async () => {
      const result = await checkPlatformAdmin(null);
      expect(result.success).toBe(false);
    });
  });

  describe("getUserRole", () => {
    it("should return user role in org", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockGetUserRole({ data: { role: "org_admin" }, error: null }),
      );

      const result = await getUserRole("user-1", "org-1");
      expect(result.success).toBe(true);
      expect(result.data.role).toBe("org_admin");
    });

    it("should return null for non-member", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockGetUserRole({ data: null, error: null }),
      );

      const result = await getUserRole("user-1", "org-1");
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("getUserPermissions", () => {
    it("should return permissions for a role", async () => {
      // getUserPermissions calls getUserRole (1 from) then queries organization_roles (1 from)
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_admin" }, error: null }),
        )
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }));

      const result = await getUserPermissions("user-1", "org-1");
      expect(result.success).toBe(true);
      expect(result.data.permissions).toContain("org:read");
      expect(result.data.permissions).toContain("campaign:create");
    });
  });

  describe("hasPermission", () => {
    it("should allow platform admin everything", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockCheckPlatformAdmin({
          data: { role: "platform_admin" },
          error: null,
        }),
      );

      const result = await hasPermission(
        "user-1",
        "org-1",
        PERMISSIONS.PLATFORM_ADMIN,
      );
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(true);
    });

    it("should deny non-member", async () => {
      // checkPlatformAdmin (not admin) + getUserRole (not member)
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockCheckPlatformAdmin({ data: null, error: null }),
        )
        .mockReturnValueOnce(mockGetUserRole({ data: null, error: null }));

      const result = await hasPermission(
        "user-1",
        "org-1",
        PERMISSIONS.CAMPAIGN_CREATE,
      );
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(false);
    });
  });

  describe("setOrganizationRole", () => {
    it("should update a member role", async () => {
      // setOrganizationRole calls hasPermission(performedBy, orgId, ORG_MANAGE_MEMBERS)
      // hasPermission: checkPlatformAdmin (1 from) + getUserRole (1 from) + getUserPermissions (2 from)
      // Then setOrganizationRole: from→update→eq→eq→select→single (1 from)
      // Total: 5 from() calls

      supabaseAdmin.from
        // 1. checkPlatformAdmin (not platform admin)
        .mockReturnValueOnce(
          mockCheckPlatformAdmin({ data: null, error: null }),
        )
        // 2. getUserRole (performedBy is org_admin)
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_admin" }, error: null }),
        )
        // 3. getUserPermissions → getUserRole (same user)
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_admin" }, error: null }),
        )
        // 4. getUserPermissions → organization_roles lookup
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }))
        // 5. Update role: from→update→eq→eq→select→single
        .mockReturnValueOnce(
          mockUpdate({
            data: { id: "mem-1", role: "finance_manager" },
            error: null,
          }),
        );

      const result = await setOrganizationRole(
        "org-1",
        "user-2",
        "finance_manager",
        "admin-1",
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", async () => {
      const result = await setOrganizationRole(
        "org-1",
        "user-2",
        "invalid_role",
        "admin-1",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("createCustomRole", () => {
    it("should create a custom role", async () => {
      // createCustomRole calls hasPermission (4 from) + check existing (1 from) + insert (1 from)
      // Total: 6 from() calls
      // NOTE: org_owner has ORG_MANAGE_SETTINGS; org_admin does NOT

      supabaseAdmin.from
        // 1. checkPlatformAdmin (not platform admin)
        .mockReturnValueOnce(
          mockCheckPlatformAdmin({ data: null, error: null }),
        )
        // 2. getUserRole (performedBy is org_owner)
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_owner" }, error: null }),
        )
        // 3. getUserPermissions → getUserRole
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_owner" }, error: null }),
        )
        // 4. getUserPermissions → organization_roles
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }))
        // 5. Check existing role name
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }))
        // 6. Insert new role
        .mockReturnValueOnce(
          mockInsert({
            data: { id: "role-1", name: "custom_role" },
            error: null,
          }),
        );

      const result = await createCustomRole(
        "org-1",
        "custom_role",
        ["campaign:read"],
        "admin-1",
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid permissions", async () => {
      // hasPermission check (org_owner)
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockCheckPlatformAdmin({ data: null, error: null }),
        )
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_owner" }, error: null }),
        )
        .mockReturnValueOnce(
          mockGetUserRole({ data: { role: "org_owner" }, error: null }),
        )
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }));

      const result = await createCustomRole(
        "org-1",
        "bad_role",
        ["invalid:permission"],
        "admin-1",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getOrganizationRoles", () => {
    it("should return system + custom roles", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockOrderQuery({
          data: [
            {
              name: "custom_role",
              permissions: ["campaign:read"],
              is_system: false,
            },
          ],
          error: null,
        }),
      );

      const result = await getOrganizationRoles("org-1");
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(5);
    });
  });

  describe("constants", () => {
    it("should have valid platform roles", () => {
      expect(PLATFORM_ROLES.PLATFORM_ADMIN).toBe("platform_admin");
      expect(PLATFORM_ROLES.ORG_OWNER).toBe("org_owner");
    });

    it("should have valid permissions", () => {
      expect(PERMISSIONS.CAMPAIGN_CREATE).toBe("campaign:create");
      expect(PERMISSIONS.FINANCE_VIEW).toBe("finance:view");
    });

    it("should have role permissions for all roles", () => {
      const roles = Object.values(PLATFORM_ROLES);
      for (const role of roles) {
        expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(DEFAULT_ROLE_PERMISSIONS[role])).toBe(true);
      }
    });
  });
});

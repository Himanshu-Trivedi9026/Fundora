/**
 * RBAC Integration Tests — Tests cross-module RBAC workflows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/supabaseAdmin", () => ({
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

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  hasPermission,
  PERMISSIONS,
  PLATFORM_ROLES,
} from "../../lib/rbac/rbacEngine";
import {
  createOrganization,
  addMember,
} from "../../lib/organization/organizationEngine";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Helper to build checkPlatformAdmin mock: from→select→eq→eq→is→maybeSingle
function mockAdminCheck(data) {
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

// Helper to build getUserRole mock: from→select→eq→eq→eq→maybeSingle
function mockUserRole(data) {
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

// Helper for org_roles lookup: from→select→eq→eq→maybeSingle
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

describe("RBAC Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("org creation, member addition, permission check flow", () => {
    it("should complete full org lifecycle", async () => {
      // use mockReturnValueOnce with a counter for from()
      let fromIdx = 0;
      const fromChains = [
        // 1a. createOrg: Check slug uniqueness: from→select→eq→maybeSingle
        {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }),
          }),
        },
        // 1b. createOrg: Insert org: from→insert→select→single
        {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "org-1", name: "Test Corp", slug: "test-corp" },
                error: null,
              }),
            }),
          }),
        },
        // 1c. createOrg: Add owner as member: from→insert
        {
          insert: vi.fn().mockResolvedValue({ error: null }),
        },
        // 2a. addMember→canManageRole (CR-6): verify the inviter may manage
        //     this role: from→select→eq→eq→eq→single (owner found)
        {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { role: "owner" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        },
        // 2b. addMember: Check existing: from→select→eq→eq→maybeSingle
        {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        },
        // 2c. addMember: Insert member: from→insert→select→single
        {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "mem-1", role: "campaign_manager" },
                error: null,
              }),
            }),
          }),
        },
        // 3a. hasPermission→checkPlatformAdmin: from→select→eq→eq→is→maybeSingle (not admin)
        mockAdminCheck({ data: null, error: null }),
        // 3b. hasPermission→getUserRole: from→select→eq→eq→eq→maybeSingle
        mockUserRole({ data: { role: "campaign_manager" }, error: null }),
        // 3c. hasPermission→getUserPermissions→getUserRole: from→select→eq→eq→eq→maybeSingle
        mockUserRole({ data: { role: "campaign_manager" }, error: null }),
        // 3d. hasPermission→getUserPermissions→org_roles: from→select→eq→eq→maybeSingle
        mockOrgRolesLookup({ data: null, error: null }),
      ];

      supabaseAdmin.from.mockImplementation(() => fromChains[fromIdx++]);

      const orgResult = await createOrganization({
        name: "Test Corp",
        slug: "test-corp",
        ownerId: "owner-1",
      });

      expect(orgResult.success).toBe(true);
      expect(orgResult.data.id).toBe("org-1");

      const memberResult = await addMember({
        organizationId: "org-1",
        userId: "member-1",
        role: "campaign_manager",
        invitedBy: "owner-1",
      });

      expect(memberResult.success).toBe(true);

      const permResult = await hasPermission(
        "member-1",
        "org-1",
        PERMISSIONS.CAMPAIGN_READ,
      );
      expect(permResult.success).toBe(true);
      expect(permResult.data.allowed).toBe(true);
      expect(permResult.data.role).toBe("campaign_manager");
    });
  });

  describe("platform admin bypass", () => {
    it("should allow platform admin to access any permission", async () => {
      // Only 1 from() call needed — checkPlatformAdmin returns early
      supabaseAdmin.from.mockReturnValue(
        mockAdminCheck({ data: { role: "platform_admin" }, error: null }),
      );

      const result = await hasPermission(
        "admin-1",
        "any-org",
        PERMISSIONS.PLATFORM_ADMIN,
      );
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(true);
      expect(result.data.role).toBe(PLATFORM_ROLES.PLATFORM_ADMIN);
    });
  });

  describe("permission denial for non-member", () => {
    it("should deny permissions for non-members", async () => {
      // 2 from() calls: checkPlatformAdmin (not admin) + getUserRole (not member)
      let fromIdx = 0;
      const fromChains = [
        mockAdminCheck({ data: null, error: null }),
        mockUserRole({ data: null, error: null }),
      ];

      supabaseAdmin.from.mockImplementation(() => fromChains[fromIdx++]);

      const result = await hasPermission(
        "stranger-1",
        "org-1",
        PERMISSIONS.FINANCE_MANAGE,
      );
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain("Not a member");
    });
  });
});

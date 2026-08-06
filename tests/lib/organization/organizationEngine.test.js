/**
 * Organization Engine Tests — Unit tests for organization CRUD, members, invitations, etc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
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
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listOrganizations,
  addMember,
  removeMember,
  getMembers,
  createInvitation,
  acceptInvitation,
  createDepartment,
  getDepartments,
  createTeam,
  getTeams,
  getOrganizationSettings,
  setOrganizationSetting,
  ORG_TYPES,
  ORG_ROLES,
} from "../../../lib/organization/organizationEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("OrganizationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOrganization", () => {
    it("should create an organization", async () => {
      const mockOrg = { id: "org-1", name: "Test Org", slug: "test-org", type: "company" };

      // Check slug uniqueness (no existing)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        // Insert org
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
            }),
          }),
        })
        // Add owner as member
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: null }),
        });

      const result = await createOrganization({
        name: "Test Org",
        slug: "test-org",
        ownerId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Test Org");
    });

    it("should fail without required fields", async () => {
      const result = await createOrganization({ name: "Test" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("slug");
    });

    it("should reject invalid type", async () => {
      const result = await createOrganization({ name: "Test", slug: "test", type: "invalid", ownerId: "user-1" });
      expect(result.success).toBe(false);
    });

    it("should reject duplicate slug", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
          }),
        }),
      });

      const result = await createOrganization({ name: "Test", slug: "test-org", ownerId: "user-1" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("already taken");
    });
  });

  describe("getOrganization", () => {
    it("should fetch an organization", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "org-1", name: "Test" }, error: null }),
            }),
          }),
        }),
      });

      const result = await getOrganization("org-1");
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("org-1");
    });
  });

  describe("updateOrganization", () => {
    it("should update organization fields", async () => {
      // Check membership (admin)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { role: "owner" }, error: null }),
                }),
              }),
            }),
          }),
        })
        // Update org
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "org-1", name: "Updated" }, error: null }),
              }),
            }),
          }),
        });

      const result = await updateOrganization("org-1", { name: "Updated" }, "user-1");
      expect(result.success).toBe(true);
    });

    it("should reject unauthorized user", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: "member" }, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await updateOrganization("org-1", { name: "Hacked" }, "user-1");
      expect(result.success).toBe(false);
    });
  });

  describe("deleteOrganization", () => {
    it("should soft-delete as owner", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { role: "owner" }, error: null }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "org-1" }, error: null }),
              }),
            }),
          }),
        });

      const result = await deleteOrganization("org-1", "owner-1");
      expect(result.success).toBe(true);
    });

    it("should reject non-owner", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await deleteOrganization("org-1", "admin-1");
      expect(result.success).toBe(false);
    });
  });

  describe("addMember", () => {
    it("should add a member", async () => {
      // Check existing
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })
        // Insert member
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "mem-1", role: "member" }, error: null }),
            }),
          }),
        });

      const result = await addMember({ organizationId: "org-1", userId: "user-1" });
      expect(result.success).toBe(true);
    });

    it("should reject duplicate active member", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "mem-1", status: "active" }, error: null }),
            }),
          }),
        }),
      });

      const result = await addMember({ organizationId: "org-1", userId: "user-1" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("already an active member");
    });
  });

  describe("createInvitation", () => {
    it("should create an invitation", async () => {
      // Check inviter is admin/owner
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
                }),
              }),
            }),
          }),
        })
        // Check existing pending
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        })
        // Insert invitation
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "inv-1", token: "abc123" }, error: null }),
            }),
          }),
        });

      const result = await createInvitation({
        organizationId: "org-1",
        email: "new@example.com",
        invitedBy: "admin-1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("createDepartment", () => {
    it("should create a department", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "dept-1", name: "Engineering" }, error: null }),
          }),
        }),
      });

      const result = await createDepartment({ organizationId: "org-1", name: "Engineering" });
      expect(result.success).toBe(true);
    });
  });

  describe("createTeam", () => {
    it("should create a team", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "team-1", name: "Frontend" }, error: null }),
          }),
        }),
      });

      const result = await createTeam({ organizationId: "org-1", name: "Frontend" });
      expect(result.success).toBe(true);
    });
  });

  describe("setOrganizationSetting", () => {
    it("should upsert a setting", async () => {
      supabaseAdmin.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "set-1", setting_key: "theme", setting_value: { color: "blue" } }, error: null }),
          }),
        }),
      });

      const result = await setOrganizationSetting("org-1", "theme", { color: "blue" });
      expect(result.success).toBe(true);
    });
  });

  describe("constants", () => {
    it("should have valid org types", () => {
      expect(ORG_TYPES).toContain("company");
      expect(ORG_TYPES).toContain("ngo");
      expect(ORG_TYPES).toContain("university");
    });

    it("should have valid org roles", () => {
      expect(ORG_ROLES).toContain("owner");
      expect(ORG_ROLES).toContain("admin");
      expect(ORG_ROLES).toContain("member");
    });
  });
});

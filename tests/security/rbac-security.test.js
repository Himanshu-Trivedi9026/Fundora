/**
 * RBAC Security Tests — Security-focused tests for the RBAC system.
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
  checkPlatformAdmin,
  setOrganizationRole,
  createCustomRole,
  PERMISSIONS,
} from "../../lib/rbac/rbacEngine";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

// ─── Mock chain builders ──────────────────────────────────────────────

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

describe("RBAC Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("input validation", () => {
    it("should reject missing userId", async () => {
      const result = await checkPlatformAdmin(null);
      expect(result.success).toBe(false);
    });

    it("should reject missing permission in hasPermission", async () => {
      const result = await hasPermission("user-1", "org-1", null);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields in setOrganizationRole", async () => {
      const result = await setOrganizationRole(null, null, null, null);
      expect(result.success).toBe(false);
    });

    it("should reject invalid role in setOrganizationRole", async () => {
      const result = await setOrganizationRole("org-1", "user-1", "superadmin", "admin-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid role");
    });

    it("should reject invalid permissions in createCustomRole", async () => {
      // createCustomRole calls hasPermission (4 from) then validates permissions
      // hasPermission: checkPlatformAdmin + getUserRole + getUserPermissions (2 from)
      supabaseAdmin.from
        .mockReturnValueOnce(mockCheckPlatformAdmin({ data: null, error: null }))
        .mockReturnValueOnce(mockGetUserRole({ data: { role: "org_owner" }, error: null }))
        .mockReturnValueOnce(mockGetUserRole({ data: { role: "org_owner" }, error: null }))
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }));

      const result = await createCustomRole(
        "org-1",
        "hacker_role",
        ["system:root", "admin:override"],
        "admin-1"
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid permissions");
    });
  });

  describe("permission boundaries", () => {
    it("should not grant org permissions without org context", async () => {
      // checkPlatformAdmin — not admin
      supabaseAdmin.from.mockReturnValueOnce(mockCheckPlatformAdmin({ data: null, error: null }));

      const result = await hasPermission("user-1", null, PERMISSIONS.CAMPAIGN_CREATE);
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain("No organization context");
    });

    it("should deny platform admin permission to non-admin", async () => {
      // hasPermission: checkPlatformAdmin (not admin) + getUserRole (not member)
      supabaseAdmin.from
        .mockReturnValueOnce(mockCheckPlatformAdmin({ data: null, error: null }))
        .mockReturnValueOnce(mockGetUserRole({ data: null, error: null }));

      const result = await hasPermission("user-1", "org-1", PERMISSIONS.PLATFORM_ADMIN);
      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(false);
    });
  });

  describe("audit logging", () => {
    it("should log role changes", async () => {
      const { logAuditEvent } = await import("../../lib/verification/auditLog");

      // setOrganizationRole calls hasPermission (4 from) + update (1 from)
      supabaseAdmin.from
        .mockReturnValueOnce(mockCheckPlatformAdmin({ data: null, error: null }))
        .mockReturnValueOnce(mockGetUserRole({ data: { role: "org_owner" }, error: null }))
        .mockReturnValueOnce(mockGetUserRole({ data: { role: "org_owner" }, error: null }))
        .mockReturnValueOnce(mockOrgRolesLookup({ data: null, error: null }))
        .mockReturnValueOnce(mockUpdate({
          data: { id: "mem-1", role: "finance_manager" },
          error: null,
        }));

      await setOrganizationRole("org-1", "user-2", "finance_manager", "admin-1");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "role_changed",
        })
      );
    });
  });

  describe("API key security", () => {
    it("should produce different hashes for different keys", async () => {
      const { hashApiKey } = await import("../../lib/apiPlatform/apiKeyEngine");
      const hash1 = hashApiKey("fk_key1");
      const hash2 = hashApiKey("fk_key2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 64-char hex hash", async () => {
      const { hashApiKey } = await import("../../lib/apiPlatform/apiKeyEngine");
      const hash = hashApiKey("fk_test_key");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("webhook signature security", () => {
    it("should not verify with wrong secret", async () => {
      const { signPayload, verifySignature } = await import("../../lib/webhooks/webhookEngine");
      const sig = signPayload({ test: true }, "secret-a");
      const result = verifySignature({ test: true }, sig, "secret-b");
      expect(result).toBe(false);
    });

    it("should not verify with tampered payload", async () => {
      const { signPayload, verifySignature } = await import("../../lib/webhooks/webhookEngine");
      const sig = signPayload({ amount: 100 }, "secret");
      const result = verifySignature({ amount: 999 }, sig, "secret");
      expect(result).toBe(false);
    });
  });
});

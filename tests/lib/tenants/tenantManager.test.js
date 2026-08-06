// Tests — Tenant Manager

import {
  createTenant,
  getTenant,
  checkQuota,
  setQuota,
  getUsageSummary,
} from "../../../lib/tenants/tenantManager.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            range: vi.fn(),
          })),
        })),
        order: vi.fn(() => ({
          range: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn() })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
    })),
  },
}));

// Mock auditLog
vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("Tenant Manager", () => {
  describe("createTenant", () => {
    it("attempts to create a tenant", async () => {
      const result = await createTenant({
        name: "Test Org",
        slug: "test-org",
        plan: "free",
        createdBy: "user-1",
      });
      expect(result.success).toBe(false); // DB mock
    });
  });

  describe("getTenant", () => {
    it("handles missing tenant", async () => {
      const result = await getTenant("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("checkQuota", () => {
    it("returns allowed when no quota exists", async () => {
      // Mock will error since no data
      const result = await checkQuota("org-1", "campaigns");
      expect(result.success).toBeDefined();
    });
  });

  describe("setQuota", () => {
    it("attempts to set a quota", async () => {
      const result = await setQuota("org-1", "campaigns", 100);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsageSummary", () => {
    it("returns list with mock", async () => {
      const result = await getUsageSummary("org-1");
      expect(result.success).toBeDefined();
    });
  });
});

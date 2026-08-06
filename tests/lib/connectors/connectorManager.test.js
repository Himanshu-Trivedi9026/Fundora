// Tests — Connector Manager

import {
  getAvailableProviders,
  registerConnector,
  connectConnector,
  disconnectConnector,
} from "../../../lib/connectors/connectorManager.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelect = vi.fn(() => ({ single: mockSingle }));

  return {
    supabaseAdmin: {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "new-1" }, error: null }) })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
            order: vi.fn(() => ({
              range: vi.fn(),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    },
  };
});

// Mock auditLog
vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("Connector Manager", () => {
  describe("getAvailableProviders", () => {
    it("returns all 7 providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("slack");
      expect(providers).toContain("teams");
      expect(providers).toContain("discord");
      expect(providers).toContain("google_workspace");
      expect(providers).toContain("github");
      expect(providers).toContain("jira");
      expect(providers).toContain("notion");
      expect(providers.length).toBe(7);
    });
  });

  describe("registerConnector", () => {
    it("registers a connector successfully", async () => {
      const result = await registerConnector({
        provider: "slack",
        label: "Test Slack",
        organizationId: "org-1",
        createdBy: "user-1",
      });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("new-1");
    });
  });

  describe("connectConnector", () => {
    it("fails for non-existent connector", async () => {
      const result = await connectConnector("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("disconnectConnector", () => {
    it("handles disconnect gracefully", async () => {
      const result = await disconnectConnector("nonexistent");
      expect(result.success).toBe(true);
    });
  });
});

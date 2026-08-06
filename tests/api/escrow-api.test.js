/**
 * Escrow API Routes Tests — Integration tests for API endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing handler
vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

vi.mock("../../lib/rateLimit", () => ({
  rateLimit: vi.fn(() => (handler) => handler),
}));

describe("Escrow API Routes", () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
      query: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("GET /api/escrow/account", () => {
    it("should return escrow account by campaign", async () => {
      const mockAccount = {
        id: "escrow-1",
        campaign_id: "campaign-1",
        status: "active",
      };

      const { supabaseAdmin } = await import("../../lib/supabaseAdmin");
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
            }),
          }),
        }),
      });

      mockReq.query = { campaignId: "campaign-1" };

      const handler = (await import("../../pages/api/escrow/account")).default;
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 405 for unsupported methods", async () => {
      mockReq.method = "DELETE";

      const handler = (await import("../../pages/api/escrow/account")).default;
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(405);
    });
  });
});

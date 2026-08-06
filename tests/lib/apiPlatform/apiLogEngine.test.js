/**
 * API Log Engine Tests — Unit tests for API request logging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

import { logApiRequest, getApiLogs, getApiUsageSummary } from "../../../lib/apiPlatform/apiLogEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("APILogEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logApiRequest", () => {
    it("should log an API request without errors", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Should not throw
      await logApiRequest({
        apiKeyId: "key-1",
        userId: "user-1",
        method: "GET",
        path: "/api/test",
        responseStatus: 200,
        responseTimeMs: 50,
      });

      expect(supabaseAdmin.from).toHaveBeenCalledWith("api_logs");
    });
  });

  describe("getApiLogs", () => {
    it("should return logs with filters", async () => {
      // getApiLogs: from→select→order→range→eq→eq (order: select, order, range, then conditional eqs)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "log-1", method: "GET" }],
                  count: 1,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await getApiLogs({ apiKeyId: "key-1", userId: "user-1" });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getApiUsageSummary", () => {
    it("should aggregate usage by day", async () => {
      // getApiUsageSummary: from→select→order→limit→eq (select, order, limit first, then conditional eq)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { created_at: "2026-01-15T10:00:00Z", response_status: 200 },
                  { created_at: "2026-01-15T11:00:00Z", response_status: 200 },
                  { created_at: "2026-01-15T12:00:00Z", response_status: 500 },
                  { created_at: "2026-01-16T10:00:00Z", response_status: 200 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getApiUsageSummary({ apiKeyId: "key-1" });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // 2 days
      expect(result.data[0].total).toBe(1); // Jan 16
      expect(result.data[1].total).toBe(3); // Jan 15
      expect(result.data[1].errors).toBe(1);
    });
  });
});

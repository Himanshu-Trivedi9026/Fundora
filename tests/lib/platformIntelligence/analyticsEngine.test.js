/**
 * Analytics Engine Tests — Unit tests for platform intelligence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    neq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import {
  calculatePlatformHealth,
  calculateTrustDistribution,
  getEscrowStats,
  getMilestoneCompletionStats,
  getPayoutSuccessStats,
  METRIC_TYPES,
  AGGREGATION_PERIODS,
} from "../../../lib/platformIntelligence/analyticsEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

/**
 * Create a fresh mock chain object. Each from() call returns a new object
 * with its own method chain, preventing state leakage between queries.
 */
function createMockChain(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
          order: vi.fn().mockResolvedValue(result),
        }),
        neq: vi.fn().mockResolvedValue(result),
        single: vi.fn().mockResolvedValue(result),
      }),
      gte: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
      neq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
      single: vi.fn().mockResolvedValue(result),
      order: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe("AnalyticsEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculatePlatformHealth", () => {
    it("should calculate platform health metrics", async () => {
      // calculatePlatformHealth makes 8 sequential .from() calls:
      // 1. .from("profiles").select("id", {count:"exact", head:true}) → {count: 5}
      // 2. .from("profiles").select(...).gte(...) → {count: 3}
      // 3. .from("campaigns").select("id", {count:"exact", head:true}) → {count: 2}
      // 4. .from("campaigns").select(...).eq("status","active") → {count: 1}
      // 5. .from("donations").select("id", {count:"exact", head:true}) → {count: 10}
      // 6. .from("donations").select("amount").eq("status","completed") → {data: [{amount: 500}]}
      // 7. .from("fraud_alerts").select("id", {count:"exact", head:true}) → {count: 0}
      // 8. .from("compliance_cases").select("id", {count:"exact", head:true}).neq(...) → {count: 0}
      // 9. .from("trust_scores").select("score") → {data: [{score: 60}]}
      supabaseAdmin.from
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 5, data: null, error: null }) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ gte: vi.fn().mockResolvedValue({ count: 3, data: null, error: null }) }) })
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 2, data: null, error: null }) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 1, data: null, error: null }) }) })
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 10, data: null, error: null }) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ amount: 500 }], error: null }) }) })
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ neq: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }) }) })
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: [{ score: 60 }], error: null }) });

      const result = await calculatePlatformHealth();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.data.metrics.totalUsers).toBe(5);
      expect(result.data.metrics.activeUsers).toBe(3);
    });
  });

  describe("calculateTrustDistribution", () => {
    it("should calculate trust distribution", async () => {
      // calculateTrustDistribution uses: .from("trust_scores").select("score")
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ score: 45 }, { score: 72 }, { score: 20 }],
          error: null,
        }),
      });

      const result = await calculateTrustDistribution();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(3);
      expect(result.data.low).toBe(1); // 20 < 30
      expect(result.data.medium).toBe(1); // 45 >= 30 && < 60
      expect(result.data.high).toBe(1); // 72 >= 60 && < 85
    });
  });

  describe("getEscrowStats", () => {
    it("should calculate escrow statistics", async () => {
      // getEscrowStats uses: .from("escrow_accounts").select("balance, status, total_donated")
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { balance: 1000, status: "active", total_donated: 1500 },
            { balance: 2000, status: "active", total_donated: 2000 },
          ],
          error: null,
        }),
      });

      const result = await getEscrowStats();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.totalLocked).toBe(3000);
      expect(result.data.activeAccounts).toBe(2);
    });
  });

  describe("getMilestoneCompletionStats", () => {
    it("should calculate milestone stats", async () => {
      // getMilestoneCompletionStats uses: .from("milestones").select("id, status")
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: "m1", status: "completed" },
            { id: "m2", status: "approved" },
            { id: "m3", status: "rejected" },
            { id: "m4", status: "active" },
          ],
          error: null,
        }),
      });

      const result = await getMilestoneCompletionStats();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(4);
      expect(result.data.completed).toBe(1);
      expect(result.data.approved).toBe(1);
      expect(result.data.rejected).toBe(1);
    });
  });

  describe("getPayoutSuccessStats", () => {
    it("should calculate payout stats", async () => {
      // getPayoutSuccessStats uses: .from("payout_requests").select("id, status, created_at, processed_at")
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: "p1", status: "completed", created_at: "2025-01-01T00:00:00Z", processed_at: "2025-01-01T00:30:00Z" },
            { id: "p2", status: "completed", created_at: "2025-01-02T00:00:00Z", processed_at: "2025-01-02T00:45:00Z" },
            { id: "p3", status: "failed", created_at: "2025-01-03T00:00:00Z", processed_at: null },
          ],
          error: null,
        }),
      });

      const result = await getPayoutSuccessStats();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(3);
      expect(result.data.completed).toBe(2);
      expect(result.data.failed).toBe(1);
    });
  });

  describe("constants", () => {
    it("should have metric types", () => {
      expect(METRIC_TYPES).toBeDefined();
      expect(METRIC_TYPES.PLATFORM_HEALTH).toBe("platform_health");
    });

    it("should have aggregation periods", () => {
      expect(AGGREGATION_PERIODS).toBeDefined();
      expect(AGGREGATION_PERIODS.DAILY).toBe("daily");
    });
  });
});

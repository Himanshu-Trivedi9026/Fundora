/**
 * Cost Tracker Tests — Unit tests for higher-level AI cost tracking with budget management.
 *
 * Covers:
 *   - recordAICost: success, missing params, DB errors
 *   - getCostSummary: aggregation by model and operation
 *   - getPlatformAICosts: daily breakdown, top users
 *   - checkCostBudget: under/over budget, env var fallback
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (before imports) ───

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// ─── Imports ───

import {
  recordAICost,
  getCostSummary,
  getPlatformAICosts,
  checkCostBudget,
} from "../../../lib/ai/costTracker.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logInfo, logError } from "../../../lib/verification/secureLogger.js";

// ─── Helpers ───
// checkCostBudget makes two queries:
//   1. from("ai_budgets")...single() → { data, error }
//   2. from("ai_usage")...eq().eq()   → awaited directly as { data, error }
// Build a chainable mock object that supports both patterns.

function buildBudgetChainMock(budgetData) {
  // Chain for query 1: from→select→eq→eq→single
  const singleResult = { data: budgetData, error: null };
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(singleResult),
        }),
      }),
    }),
  };
}

function buildSpendingChainMock(spendingData) {
  // Chain for query 2: from→select→eq→eq (awaited directly as a thenable)
  const result = { data: spendingData, error: null };
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(Promise.resolve(result)),
      }),
    }),
  };
}

function buildBudgetNoLimitChainMock() {
  // Chain for query 1: budget not found
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
        }),
      }),
    }),
  };
}

// ─── Tests ───

describe("Cost Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── recordAICost ───

  describe("recordAICost", () => {
    it("records cost successfully (insert path — no existing record)", async () => {
      // No existing record found
      supabaseAdmin.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
      // Insert succeeds
      supabaseAdmin.single.mockResolvedValueOnce({
        data: { id: "cost-1" },
        error: null,
      });

      const result = await recordAICost({
        userId: "user-1",
        operation: "chat",
        provider: "openai",
        model: "gpt-4o-mini",
        tokensIn: 100,
        tokensOut: 50,
        costCents: 0.015,
        metadata: { requestId: "req-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("cost-1");
      expect(logInfo).toHaveBeenCalledWith(
        "CostTracker",
        "AI cost recorded",
        expect.objectContaining({ userId: "user-1", operation: "chat" }),
      );
    });

    it("updates existing record when one is found (upsert path)", async () => {
      // Existing record found
      supabaseAdmin.single.mockResolvedValueOnce({
        data: { id: "cost-existing", cost_cents: 10, request_count: 3, input_tokens: 500, output_tokens: 200, total_tokens: 700 },
        error: null,
      });
      // Update succeeds
      supabaseAdmin.single.mockResolvedValueOnce({
        data: { id: "cost-existing" },
        error: null,
      });

      const result = await recordAICost({
        userId: "user-1",
        operation: "chat",
        provider: "openai",
        model: "gpt-4o-mini",
        tokensIn: 100,
        tokensOut: 50,
        costCents: 2.5,
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("cost-existing");
    });

    it("returns error when required params are missing", async () => {
      const result = await recordAICost({
        userId: null,
        operation: "chat",
        provider: "openai",
        model: "gpt-4o-mini",
        costCents: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
      expect(logError).toHaveBeenCalled();
    });

    it("handles DB insert error gracefully", async () => {
      supabaseAdmin.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: { message: "constraint violation" },
      });

      const result = await recordAICost({
        userId: "user-1",
        operation: "chat",
        provider: "openai",
        model: "gpt-4o-mini",
        costCents: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("constraint violation");
    });
  });

  // ─── getCostSummary ───

  describe("getCostSummary", () => {
    it("aggregates costs by model and operation", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: [
                { model: "gpt-4o", operation: "chat", cost_cents: 10, total_tokens: 2000, request_count: 5 },
                { model: "gpt-4o-mini", operation: "embedding", cost_cents: 0.5, total_tokens: 5000, request_count: 20 },
                { model: "gpt-4o", operation: "chat", cost_cents: 5, total_tokens: 1000, request_count: 3 },
              ],
              error: null,
            }),
          }),
        }),
      });

      const result = await getCostSummary({
        userId: "user-1",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(result.success).toBe(true);
      expect(result.data.totalCostCents).toBe(15.5);
      expect(result.data.byModel["gpt-4o"].costCents).toBe(15);
      expect(result.data.byModel["gpt-4o-mini"].costCents).toBe(0.5);
      expect(result.data.byOperation["chat"].costCents).toBe(15);
      expect(result.data.byOperation["embedding"].costCents).toBe(0.5);
    });

    it("returns zeros for no records", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getCostSummary({
        userId: "user-1",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      expect(result.success).toBe(true);
      expect(result.data.totalCostCents).toBe(0);
      expect(result.data.byModel).toEqual({});
      expect(result.data.byOperation).toEqual({});
    });

    it("returns error when required params are missing", async () => {
      const result = await getCostSummary({ userId: null, startDate: "2025-01-01", endDate: "2025-01-31" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // ─── getPlatformAICosts ───

  describe("getPlatformAICosts", () => {
    it("returns daily breakdown and top users", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: [
              { date: "2025-01-15", user_id: "user-1", cost_cents: 25, total_tokens: 5000, request_count: 10 },
              { date: "2025-01-15", user_id: "user-2", cost_cents: 10, total_tokens: 2000, request_count: 4 },
              { date: "2025-01-16", user_id: "user-1", cost_cents: 15, total_tokens: 3000, request_count: 6 },
            ],
            error: null,
          }),
        }),
      });

      const result = await getPlatformAICosts({
        startDate: "2025-01-15",
        endDate: "2025-01-16",
      });

      expect(result.success).toBe(true);
      expect(result.data.totalCostCents).toBe(50);
      expect(result.data.dailyBreakdown).toHaveLength(2);
      expect(result.data.dailyBreakdown[0].costCents).toBe(35);
      expect(result.data.topUsers.length).toBeGreaterThan(0);
      expect(result.data.topUsers[0].userId).toBe("user-1");
    });

    it("returns error when required params are missing", async () => {
      const result = await getPlatformAICosts({ startDate: null, endDate: "2025-01-16" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // ─── checkCostBudget ───

  describe("checkCostBudget", () => {
    it("returns within budget when spending is below limit", async () => {
      // Mock from() to return different chains for each query:
      // 1st call → budget lookup chain, 2nd call → spending query chain
      const budgetChain = buildBudgetChainMock({ budget_cents: 5000 });
      const spendingChain = buildSpendingChainMock([
        { cost_cents: 200 },
        { cost_cents: 100 },
      ]);
      supabaseAdmin.from
        .mockReturnValueOnce(budgetChain)
        .mockReturnValueOnce(spendingChain);

      const result = await checkCostBudget({ entity: "user-1", budgetType: "daily" });

      expect(result.success).toBe(true);
      expect(result.data.withinBudget).toBe(true);
      expect(result.data.spent).toBe(300);
      expect(result.data.limit).toBe(5000);
    });

    it("returns over budget when spending exceeds limit", async () => {
      const budgetChain = buildBudgetChainMock({ budget_cents: 100 });
      const spendingChain = buildSpendingChainMock([
        { cost_cents: 80 },
        { cost_cents: 50 },
      ]);
      supabaseAdmin.from
        .mockReturnValueOnce(budgetChain)
        .mockReturnValueOnce(spendingChain);

      const result = await checkCostBudget({ entity: "user-1", budgetType: "daily" });

      expect(result.success).toBe(true);
      expect(result.data.withinBudget).toBe(false);
      expect(result.data.spent).toBe(130);
    });

    it("returns no budget enforced when no limit is found and not platform", async () => {
      // Query 1: no budget record found (PGRST116 = no rows)
      const budgetChain = buildBudgetNoLimitChainMock();
      supabaseAdmin.from.mockReturnValueOnce(budgetChain);

      // Query 2 won't be reached — function returns early when limit is null
      const result = await checkCostBudget({ entity: "user-unknown", budgetType: "daily" });

      expect(result.success).toBe(true);
      expect(result.data.withinBudget).toBe(true);
      expect(result.data.limit).toBe(-1);
    });

    it("returns error when entity is missing", async () => {
      const result = await checkCostBudget({ entity: null, budgetType: "daily" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });
});

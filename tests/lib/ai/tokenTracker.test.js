/**
 * Token Tracker Tests — Unit tests for per-user token usage tracking and cost calculation.
 *
 * Covers:
 *   - trackTokenUsage: success, missing params, DB errors
 *   - getUserUsage: aggregation across models
 *   - getUsageStats: date range aggregation
 *   - checkUsageLimit: under and over limit
 *   - calculateCost: known and unknown models
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
  trackTokenUsage,
  getUserUsage,
  getUsageStats,
  checkUsageLimit,
  calculateCost,
  MODEL_COSTS,
} from "../../../lib/ai/tokenTracker.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logInfo, logError } from "../../../lib/verification/secureLogger.js";

// ─── Helpers ───

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

// ─── Tests ───

describe("Token Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── calculateCost ───

  describe("calculateCost", () => {
    it("calculates cost for known model (gpt-4o-mini)", () => {
      // gpt-4o-mini: inputPer1k=0.15, outputPer1k=0.6
      // 1000 input tokens = 0.15 USD = 15 cents
      // 1000 output tokens = 0.6 USD = 60 cents
      // Total = 75 cents
      const cost = calculateCost("gpt-4o-mini", 1000, 1000);
      expect(cost).toBe(75);
    });

    it("calculates cost for known model (gpt-4o)", () => {
      // gpt-4o: inputPer1k=2.5, outputPer1k=10.0
      // 1000 input = 250 cents, 1000 output = 1000 cents
      // Total = 1250 cents
      const cost = calculateCost("gpt-4o", 1000, 1000);
      expect(cost).toBe(1250);
    });

    it("falls back to default pricing for unknown model", () => {
      // default: inputPer1k=1.0, outputPer1k=3.0
      // 1000 input = 100 cents, 1000 output = 300 cents
      const cost = calculateCost("unknown-model", 1000, 1000);
      expect(cost).toBe(400);
    });

    it("handles zero tokens", () => {
      const cost = calculateCost("gpt-4o", 0, 0);
      expect(cost).toBe(0);
    });

    it("returns expected MODEL_COSTS keys", () => {
      expect(MODEL_COSTS).toHaveProperty("gpt-4o");
      expect(MODEL_COSTS).toHaveProperty("gpt-4o-mini");
      expect(MODEL_COSTS).toHaveProperty("claude-3-opus-20240229");
      expect(MODEL_COSTS).toHaveProperty("claude-3-haiku-20240307");
      expect(MODEL_COSTS).toHaveProperty("default");
    });
  });

  // ─── trackTokenUsage ───

  describe("trackTokenUsage", () => {
    it("records new usage on first request (insert path)", async () => {
      // No existing record → insert path
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });
      // Insert succeeds
      supabaseAdmin.single.mockResolvedValueOnce({
        data: { id: "usage-1", costCents: 0.015 },
        error: null,
      });

      const result = await trackTokenUsage({
        userId: "user-1",
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe("usage-1");
      expect(logInfo).toHaveBeenCalled();
    });

    it("returns error when required params are missing", async () => {
      const result = await trackTokenUsage({
        userId: null,
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
      expect(logError).toHaveBeenCalled();
    });

    it("handles DB insert errors gracefully", async () => {
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: { message: "insert failed" },
      });

      const result = await trackTokenUsage({
        userId: "user-2",
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("insert failed");
    });
  });

  // ─── getUserUsage ───

  describe("getUserUsage", () => {
    it("aggregates usage across multiple models", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                model: "gpt-4o",
                provider: "openai",
                total_tokens: 1000,
                cost_cents: 5,
                request_count: 3,
              },
              {
                model: "gpt-4o-mini",
                provider: "openai",
                total_tokens: 2000,
                cost_cents: 1.2,
                request_count: 5,
              },
              {
                model: "gpt-4o",
                provider: "openai",
                total_tokens: 500,
                cost_cents: 2.5,
                request_count: 1,
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await getUserUsage({
        userId: "user-1",
        date: "2025-01-15",
      });

      expect(result.success).toBe(true);
      expect(result.data.totalTokens).toBe(3500);
      expect(result.data.totalCostCents).toBe(8.7);
      expect(result.data.requestsByModel["gpt-4o"].tokens).toBe(1500);
      expect(result.data.requestsByModel["gpt-4o-mini"].tokens).toBe(2000);
      expect(result.data.requestsByModel["gpt-4o"].requests).toBe(4);
    });

    it("returns zeros when no records exist", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await getUserUsage({ userId: "user-empty" });

      expect(result.success).toBe(true);
      expect(result.data.totalTokens).toBe(0);
      expect(result.data.totalCostCents).toBe(0);
      expect(result.data.requestsByModel).toEqual({});
    });

    it("returns error when userId is missing", async () => {
      const result = await getUserUsage({ userId: null });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // ─── getUsageStats ───

  describe("getUsageStats", () => {
    it("aggregates stats across a date range", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: [
              {
                date: "2025-01-15",
                provider: "openai",
                model: "gpt-4o",
                total_tokens: 500,
                cost_cents: 2.5,
                request_count: 2,
              },
              {
                date: "2025-01-15",
                provider: "anthropic",
                model: "claude-3-haiku",
                total_tokens: 300,
                cost_cents: 1.5,
                request_count: 1,
              },
              {
                date: "2025-01-16",
                provider: "openai",
                model: "gpt-4o-mini",
                total_tokens: 1000,
                cost_cents: 0.6,
                request_count: 4,
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await getUsageStats({
        startDate: "2025-01-15",
        endDate: "2025-01-16",
        groupBy: "date",
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0].date).toBe("2025-01-15");
      expect(result.data[0].tokens).toBe(800);
      expect(result.data[1].tokens).toBe(1000);
    });

    it("returns error when date params are missing", async () => {
      const result = await getUsageStats({
        startDate: null,
        endDate: "2025-01-16",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // ─── checkUsageLimit ───

  describe("checkUsageLimit", () => {
    it("allows usage when under the limit", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ cost_cents: 50 }],
            error: null,
          }),
        }),
      });

      const result = await checkUsageLimit({ userId: "user-1", limit: 100 });

      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(true);
      expect(result.data.current).toBe(50);
      expect(result.data.limit).toBe(100);
    });

    it("blocks usage when over the limit", async () => {
      supabaseAdmin.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ cost_cents: 80 }, { cost_cents: 30 }],
            error: null,
          }),
        }),
      });

      const result = await checkUsageLimit({ userId: "user-1", limit: 100 });

      expect(result.success).toBe(true);
      expect(result.data.allowed).toBe(false);
      expect(result.data.current).toBe(110);
    });

    it("returns error when required params are missing", async () => {
      const result = await checkUsageLimit({ userId: null, limit: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });
});

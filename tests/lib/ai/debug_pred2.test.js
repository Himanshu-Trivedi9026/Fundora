import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { predictFundingTimeline } from "../../../lib/ai/predictionEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

describe("debug2", () => {
  it("goal already met", async () => {
    const campaign = {
      id: "camp-1",
      goal_amount: 10000,
      current_amount: 10000,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      creator: { id: "creator-1", trust_score: 0.7, reputation_score: 0.8 },
    };

    supabaseAdmin.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: campaign, error: null }),
        }),
      }),
    });

    console.log("FROM mock:", typeof supabaseAdmin.from);
    console.log(
      "FROM mock.mockReturnValueOnce stack:",
      supabaseAdmin.from._mockReturnValues?.length ?? "N/A",
    );

    const result = await predictFundingTimeline({ campaignId: "camp-1" });
    console.log("RESULT:", JSON.stringify(result));
    console.log("FROM calls:", supabaseAdmin.from.mock.calls.length);

    expect(result.data.dailyRateNeeded).toBe(0);
  });
});

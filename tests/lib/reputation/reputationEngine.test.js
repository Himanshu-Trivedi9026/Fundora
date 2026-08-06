/**
 * Reputation Engine Tests — Unit tests for reputation scoring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  getCreatorReputation,
  getDonorReputation,
  getCampaignReputation,
  updateReputationPenalty,
  getReputationLeaderboard,
  REPUTATION_WEIGHTS,
  REPUTATION_DIMENSIONS,
} from "../../../lib/reputation/reputationEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("ReputationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCreatorReputation", () => {
    it("should fetch creator reputation", async () => {
      const mockRep = {
        id: "rep-1",
        creator_id: "user-1",
        overall_score: 75,
        quality_score: 80,
        reliability_score: 70,
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRep, error: null }),
          }),
        }),
      });

      const result = await getCreatorReputation("user-1");
      expect(result.success).toBe(true);
      expect(result.data.overall_score).toBe(75);
    });

    it("should return error if not found", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "not found" },
            }),
          }),
        }),
      });

      const result = await getCreatorReputation("user-unknown");
      expect(result.success).toBe(false);
    });
  });

  describe("getDonorReputation", () => {
    it("should fetch donor reputation", async () => {
      const mockRep = { id: "rep-1", donor_id: "user-1", overall_score: 60 };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRep, error: null }),
          }),
        }),
      });

      const result = await getDonorReputation("user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("getCampaignReputation", () => {
    it("should fetch campaign reputation", async () => {
      const mockRep = {
        id: "rep-1",
        campaign_id: "campaign-1",
        overall_score: 65,
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRep, error: null }),
          }),
        }),
      });

      const result = await getCampaignReputation("campaign-1");
      expect(result.success).toBe(true);
    });
  });

  describe("updateReputationPenalty", () => {
    it("should apply penalty to creator reputation", async () => {
      const mockCreatorRep = { id: "rep-1", overall_score: 75 };
      const mockUpdated = {
        ...mockCreatorRep,
        overall_score: 65,
        penalty_count: 1,
      };

      // 1. Check creator_reputation: select("id, overall_score").eq("creator_id", userId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockCreatorRep, error: null }),
            }),
          }),
        })
        // 2. Fetch current: select("id, overall_score, penalty_count").eq("creator_id", userId).single()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockCreatorRep, penalty_count: 0 },
                error: null,
              }),
            }),
          }),
        })
        // 3. Update: update({...}).eq("id", repId).select().single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockUpdated, error: null }),
              }),
            }),
          }),
        });

      const result = await updateReputationPenalty(
        "user-1",
        1,
        "Policy violation",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getReputationLeaderboard", () => {
    it("should fetch leaderboard", async () => {
      // select("*").order(...).range(...)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [{ creator_id: "user-1", overall_score: 90 }],
              error: null,
            }),
          }),
        }),
      });

      const result = await getReputationLeaderboard({
        type: "creator",
        limit: 10,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("constants", () => {
    it("should have reputation dimensions", () => {
      expect(REPUTATION_DIMENSIONS).toBeDefined();
    });

    it("should have reputation weights", () => {
      expect(REPUTATION_WEIGHTS).toBeDefined();
    });
  });
});

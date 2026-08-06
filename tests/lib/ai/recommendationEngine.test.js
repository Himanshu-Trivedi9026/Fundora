/**
 * Recommendation Engine Tests — Unit tests for multi-signal recommendation system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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

vi.mock("../../../lib/ai/embeddingEngine.js", () => ({
  searchEmbeddings: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

import {
  getDonorRecommendations,
  getCampaignDonorSuggestions,
  getSimilarCampaigns,
  getTrendingCampaigns,
  getCreatorRecommendations,
  invalidateRecommendationCache,
  RECOMMENDATION_TYPES,
} from "../../../lib/ai/recommendationEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

// ─── Shared test data ────────────────────────────────────────────────

const MOCK_CAMPAIGN = {
  id: "camp-1",
  title: "Test Campaign",
  category: "technology",
  goal_amount: 10000,
  current_amount: 3000,
  status: "active",
  created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  creator_id: "creator-1",
  creator: { id: "creator-1", trust_score: 0.8 },
};

// ─── Mock chain builders ──────────────────────────────────────────────

function mockSelectEqLimit(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

function mockSelectEqOrderLimit(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(data),
        }),
      }),
    }),
  };
}

function mockSelectSingle(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

function mockSelectGteLt(data) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue(data),
        }),
      }),
    }),
  };
}

function mockDeleteEq(data) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(data),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("Recommendation Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDonorRecommendations", () => {
    it("should return scored campaign recommendations for a donor", async () => {
      const now = new Date().toISOString();

      // 1. fetchDonorHistory — donations with campaign join
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectEqOrderLimit({
            data: [
              { campaign_id: "camp-old", amount: 100, created_at: now, campaign: { id: "camp-old", category: "technology", goal_amount: 5000, title: "Old" } },
            ],
            error: null,
          })
        )
        // 2. fetchActiveCampaigns — candidates
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [MOCK_CAMPAIGN], error: null }),
            }),
          }),
        })
        // 3. Similar donors query
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        // 4. fetchCampaignVelocity — recent donations
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [{ id: "d1", amount: 50 }], error: null }),
            }),
          }),
        })
        // 5. fetchCampaignVelocity — previous donations
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        // 6. fetchCampaignVelocity — campaign created_at
        .mockReturnValueOnce(mockSelectSingle({ data: { created_at: MOCK_CAMPAIGN.created_at }, error: null }));

      const result = await getDonorRecommendations({ donorId: "donor-1", limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      // Should have at least one recommendation (donated campaigns are excluded)
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty("campaignId");
        expect(result.data[0]).toHaveProperty("score");
        expect(result.data[0]).toHaveProperty("reason");
        expect(result.data[0]).toHaveProperty("factors");
      }
    });

    it("should reject missing donorId", async () => {
      const result = await getDonorRecommendations({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("donorId is required");
    });

    it("should exclude already-donated campaigns", async () => {
      // History includes camp-1
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectEqOrderLimit({
            data: [
              { campaign_id: "camp-1", amount: 50, created_at: new Date().toISOString(), campaign: { id: "camp-1", category: "tech", goal_amount: 10000, title: "Camp1" } },
            ],
            error: null,
          })
        )
        // Active campaigns — only camp-1 (which is already donated to)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [MOCK_CAMPAIGN], error: null }),
            }),
          }),
        })
        // Similar donors
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        });

      const result = await getDonorRecommendations({ donorId: "donor-1" });

      expect(result.success).toBe(true);
      // camp-1 was already donated to, so should be excluded
      expect(result.data.find((r) => r.campaignId === "camp-1")).toBeUndefined();
    });
  });

  describe("getCampaignDonorSuggestions", () => {
    it("should return scored donors for a campaign", async () => {
      // 1. Fetch target campaign
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectSingle({
            data: { id: "camp-1", category: "technology", goal_amount: 10000, title: "Tech", creator_id: "creator-1" },
            error: null,
          })
        )
        // 2. Fetch category donors
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { donor_id: "d1", amount: 200, campaign: { category: "technology", goal_amount: 8000 } },
                  { donor_id: "d2", amount: 100, campaign: { category: "health", goal_amount: 5000 } },
                ],
                error: null,
              }),
            }),
          }),
        });

      const result = await getCampaignDonorSuggestions({ campaignId: "camp-1" });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty("donorId");
      expect(result.data[0]).toHaveProperty("score");
      expect(result.data[0]).toHaveProperty("reason");
    });

    it("should reject missing campaignId", async () => {
      const result = await getCampaignDonorSuggestions({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("campaignId is required");
    });

    it("should fail when campaign is not found", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockSelectSingle({ data: null, error: { message: "not found" } })
      );

      const result = await getCampaignDonorSuggestions({ campaignId: "nonexistent" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Campaign not found");
    });
  });

  describe("getSimilarCampaigns", () => {
    it("should find campaigns with matching category and features", async () => {
      // 1. Fetch reference campaign
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectSingle({
            data: { ...MOCK_CAMPAIGN, description: "A tech campaign", tags: ["ai", "ml"] },
            error: null,
          })
        )
        // 2. Fetch all active campaigns for comparison
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { id: "camp-2", title: "Similar", category: "technology", goal_amount: 12000, current_amount: 5000, status: "active", tags: ["ai"] },
                    { id: "camp-3", title: "Different", category: "arts", goal_amount: 3000, current_amount: 1000, status: "active", tags: [] },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        });

      const result = await getSimilarCampaigns({ campaignId: "camp-1" });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      // The technology campaign should score higher than the arts one
      const techResult = result.data.find((r) => r.campaignId === "camp-2");
      expect(techResult).toBeDefined();
      expect(techResult.sharedCategories).toContain("technology");
    });

    it("should reject missing campaignId", async () => {
      const result = await getSimilarCampaigns({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("campaignId is required");
    });
  });

  describe("getTrendingCampaigns", () => {
    it("should return campaigns ranked by donation velocity", async () => {
      const createdAt = new Date(Date.now() - 7 * 86400000).toISOString();

      // 1. fetchActiveCampaigns
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ ...MOCK_CAMPAIGN, created_at: createdAt }],
                error: null,
              }),
            }),
          }),
        })
        // 2. fetchCampaignVelocity — recent
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [{ id: "d1" }, { id: "d2" }, { id: "d3" }], error: null }),
            }),
          }),
        })
        // 3. fetchCampaignVelocity — previous
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ data: [{ id: "d0" }], error: null }),
              }),
            }),
          }),
        })
        // 4. fetchCampaignVelocity — campaign created_at
        .mockReturnValueOnce(mockSelectSingle({ data: { created_at: createdAt }, error: null }));

      const result = await getTrendingCampaigns({ limit: 5 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Array);
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty("campaignId");
        expect(result.data[0]).toHaveProperty("score");
        expect(result.data[0]).toHaveProperty("velocity");
        expect(result.data[0]).toHaveProperty("donationCount");
        expect(result.data[0]).toHaveProperty("recentGrowth");
      }
    });

    it("should return empty array when no active campaigns exist", async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await getTrendingCampaigns();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("getCreatorRecommendations", () => {
    it("should suggest categories and goal ranges for a creator", async () => {
      // 1. Fetch creator campaigns
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "c1", category: "technology", goal_amount: 10000, current_amount: 8000, status: "funded", created_at: new Date().toISOString() },
                  { id: "c2", category: "technology", goal_amount: 5000, current_amount: 2000, status: "active", created_at: new Date().toISOString() },
                ],
                error: null,
              }),
            }),
          }),
        })
        // 2. Fetch creator profile
        .mockReturnValueOnce(
          mockSelectSingle({
            data: { trust_score: 0.8, total_raised: 10000, total_campaigns: 2 },
            error: null,
          })
        );

      const result = await getCreatorRecommendations({ creatorId: "creator-1" });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty("category");
      expect(result.data[0]).toHaveProperty("goalRange");
      expect(result.data[0]).toHaveProperty("expectedSuccess");
    });

    it("should reject missing creatorId", async () => {
      const result = await getCreatorRecommendations({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("creatorId is required");
    });
  });

  describe("invalidateRecommendationCache", () => {
    it("should invalidate cache for a user", async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await invalidateRecommendationCache({ userId: "user-1" });

      expect(result.success).toBe(true);
      expect(result.data.invalidated).toBe(true);
    });

    it("should invalidate cache by type", async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await invalidateRecommendationCache({
        type: RECOMMENDATION_TYPES.TRENDING,
      });

      expect(result.success).toBe(true);
    });

    it("should reject when neither userId nor type is provided", async () => {
      const result = await invalidateRecommendationCache({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("At least one of userId or type is required");
    });
  });

  describe("constants", () => {
    it("should have valid recommendation types", () => {
      expect(RECOMMENDATION_TYPES.CAMPAIGNS_FOR_DONOR).toBe("campaign_for_donor");
      expect(RECOMMENDATION_TYPES.TRENDING).toBe("trending");
      expect(RECOMMENDATION_TYPES.SIMILAR_CAMPAIGNS).toBe("similar_campaigns");
    });
  });
});

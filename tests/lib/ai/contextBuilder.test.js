/**
 * Context Builder Tests — Unit tests for building AI context payloads.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import {
  buildCampaignContext,
  buildUserContext,
  buildDonorContext,
  buildPlatformContext,
} from "../../../lib/ai/contextBuilder.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

describe("ContextBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── buildCampaignContext ───

  describe("buildCampaignContext", () => {
    it("should build structured campaign context with creator and stats", async () => {
      // First call: campaign lookup
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "camp-1",
                  title: "Education Fund",
                  description: "Help students",
                  goal: 100000,
                  pledged: 50000,
                  category: "education",
                  creator_id: "creator-1",
                  created_at: new Date().toISOString(),
                  status: "active",
                },
                error: null,
              }),
            }),
          }),
        })
        // Parallel queries: creator_verifications, donations, milestones
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  trust_score: 85,
                  reputation_score: 90,
                  verification_level: "verified",
                  user_id: "creator-1",
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "don-1", amount: 1000 },
                  { id: "don-2", amount: 2000 },
                ],
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "ms-1", status: "completed" },
                { id: "ms-2", status: "pending" },
              ],
              error: null,
            }),
          }),
        });

      const result = await buildCampaignContext("camp-1");

      expect(result.success).toBe(true);
      expect(result.data.campaign).toBeDefined();
      expect(result.data.campaign.title).toBe("Education Fund");
      expect(result.data.campaign.goal).toBe(100000);
      expect(result.data.creator).toBeDefined();
      expect(result.data.creator.trustScore).toBe(85);
      expect(result.data.stats).toBeDefined();
      expect(result.data.stats.donationCount).toBe(2);
      expect(result.data.stats.avgDonation).toBe(1500);
      expect(result.data.stats.milestoneCompletion).toBe(50);
    });

    it("should fail when campaignId is missing", async () => {
      const result = await buildCampaignContext(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("campaignId is required");
    });

    it("should return null fields when campaign is not found", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
          }),
        }),
      });

      const result = await buildCampaignContext("nonexistent");
      expect(result.success).toBe(true);
      expect(result.data.campaign).toBeNull();
      expect(result.data.creator).toBeNull();
      expect(result.data.stats).toBeNull();
    });
  });

  // ─── buildUserContext ───

  describe("buildUserContext", () => {
    it("should build structured user context", async () => {
      // Profile query
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "user-1", email: "test@example.com", created_at: "2024-01-01" },
                error: null,
              }),
            }),
          }),
        })
        // Verification query
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { verification_level: "verified", completed_types: ["aadhaar", "pan"] },
                error: null,
              }),
            }),
          }),
        })
        // Trust score query
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { score: 80, breakdown: { identity: 90, activity: 70 } },
                error: null,
              }),
            }),
          }),
        })
        // Reputation query
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { overall_score: 75, dimensions: { reliability: 80 } },
                error: null,
              }),
            }),
          }),
        })
        // Stats queries (donations, projects, follows)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "d1" }, { id: "d2" }],
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "p1" }],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "f1" }, { id: "f2" }, { id: "f3" }],
              error: null,
            }),
          }),
        });

      const result = await buildUserContext("user-1");

      expect(result.success).toBe(true);
      expect(result.data.profile.id).toBe("user-1");
      expect(result.data.verification.level).toBe("verified");
      expect(result.data.trust.score).toBe(80);
      expect(result.data.reputation.overall).toBe(75);
      expect(result.data.stats.totalDonations).toBe(2);
      expect(result.data.stats.campaignsCreated).toBe(1);
      expect(result.data.stats.followerCount).toBe(3);
    });

    it("should fail when userId is missing", async () => {
      const result = await buildUserContext(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId is required");
    });
  });

  // ─── buildDonorContext ───

  describe("buildDonorContext", () => {
    it("should build donor context with history and preferences", async () => {
      // Profile
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "donor-1", email: "donor@test.com", created_at: "2024-01-01" },
                error: null,
              }),
            }),
          }),
        })
        // Donation history
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        campaign_id: "c1",
                        amount: 5000,
                        created_at: "2025-06-01",
                        campaigns: { category: "education", title: "School Fund" },
                      },
                      {
                        campaign_id: "c2",
                        amount: 3000,
                        created_at: "2025-05-01",
                        campaigns: { category: "health", title: "Hospital Fund" },
                      },
                      {
                        campaign_id: "c3",
                        amount: 2000,
                        created_at: "2025-04-01",
                        campaigns: { category: "education", title: "Library Fund" },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        // Trust score
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { score: 90 },
                error: null,
              }),
            }),
          }),
        });

      const result = await buildDonorContext("donor-1");

      expect(result.success).toBe(true);
      expect(result.data.profile.id).toBe("donor-1");
      expect(result.data.donationHistory).toHaveLength(3);
      expect(result.data.preferences).toBeDefined();
      expect(result.data.preferences.categories).toContain("education");
      expect(result.data.preferences.avgDonation).toBe(3333);
      expect(result.data.trust.score).toBe(90);
    });

    it("should fail when donorId is missing", async () => {
      const result = await buildDonorContext(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("donorId is required");
    });
  });

  // ─── buildPlatformContext ───

  describe("buildPlatformContext", () => {
    it("should build platform-wide context with stats and trending", async () => {
      // Users count
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({ count: 150, error: null }),
        })
        // Projects count
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({ count: 45, error: null }),
        })
        // Donations count
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 200, error: null }),
          }),
        })
        // Active projects count
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 30, error: null }),
          }),
        })
        // Trending campaigns
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { id: "t1", title: "Hot Campaign", pledged: 90000 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        })
        // Recent activity
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { id: "don-1", campaign_id: "c1", amount: 500, created_at: "2025-07-01" },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        });

      const result = await buildPlatformContext();

      expect(result.success).toBe(true);
      expect(result.data.stats.totalUsers).toBe(150);
      expect(result.data.stats.totalCampaigns).toBe(45);
      expect(result.data.stats.totalDonations).toBe(200);
      expect(result.data.stats.activeCampaigns).toBe(30);
      expect(result.data.trending.length).toBeGreaterThan(0);
      expect(result.data.recentActivity.length).toBeGreaterThan(0);
    });

    it("should handle DB failures gracefully with zeroed stats", async () => {
      const errorData = { count: null, error: { message: "DB down" } };

      // All 6 parallel from() calls share the same chain object.
      // The chains have varying depths:
      //   - from().select()                                     → 2 calls
      //   - from().select().eq()                                → 2 calls
      //   - from().select().eq().order().limit()                → 2 calls
      // Solution: every chainable method returns `this`, and the
      // object itself is a thenable that resolves to the error data.
      // That way, no matter which method is "terminal", `await`
      // resolves to the same error data.
      const errorChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        // Make this object a thenable so `await` resolves to the error data
        then(resolve) {
          resolve(errorData);
        },
      };

      supabaseAdmin.from.mockReturnValue(errorChain);

      const result = await buildPlatformContext();
      expect(result.success).toBe(true);
      expect(result.data.stats.totalUsers).toBe(0);
      expect(result.data.stats.activeCampaigns).toBe(0);
      expect(result.data.trending).toEqual([]);
    });
  });
});

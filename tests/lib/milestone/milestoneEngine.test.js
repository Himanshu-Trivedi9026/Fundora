/**
 * Milestone Engine Tests — Unit tests for milestone lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

import { createMilestone, activateMilestone, getCampaignMilestones, cancelMilestone } from "../../../lib/milestone/milestoneEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("MilestoneEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMilestone", () => {
    it("should create milestone with correct defaults", async () => {
      const mockMilestone = {
        id: "milestone-1",
        campaign_id: "campaign-1",
        title: "Phase 1",
        description: "Complete design",
        target_amount: 5000,
        status: "draft",
        approval_percentage: 0,
        total_reviews: 0,
        approval_count: 0,
        rejection_count: 0,
      };

      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMilestone, error: null }),
          }),
        }),
      });

      const result = await createMilestone({
        campaignId: "campaign-1",
        creatorId: "user-1",
        title: "Phase 1",
        description: "Complete design",
        targetAmount: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("draft");
    });

    it("should fail if campaignId is missing", async () => {
      const result = await createMilestone({
        creatorId: "user-1",
        title: "Phase 1",
        targetAmount: 5000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("activateMilestone", () => {
    it("should activate draft milestone", async () => {
      const mockMilestone = {
        id: "milestone-1",
        status: "draft",
        campaign_id: "campaign-1",
        creator_id: "user-1",
      };

      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockMilestone, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...mockMilestone, status: "active" }, error: null }),
              }),
            }),
          }),
        });

      const result = await activateMilestone("milestone-1", "user-1");
      expect(result.success).toBe(true);
    });

    it("should reject activation of non-draft milestone", async () => {
      const mockMilestone = {
        id: "milestone-1",
        status: "active",
        campaign_id: "campaign-1",
        creator_id: "user-1",
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMilestone, error: null }),
          }),
        }),
      });

      const result = await activateMilestone("milestone-1", "user-1");
      expect(result.success).toBe(false);
    });
  });

  describe("cancelMilestone", () => {
    it("should cancel active milestone", async () => {
      const mockMilestone = {
        id: "milestone-1",
        status: "active",
        campaign_id: "campaign-1",
        creator_id: "user-1",
      };

      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockMilestone, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...mockMilestone, status: "cancelled" }, error: null }),
              }),
            }),
          }),
        });

      const result = await cancelMilestone("milestone-1", "user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("getCampaignMilestones", () => {
    it("should return milestones for campaign", async () => {
      const mockMilestones = [
        { id: "1", title: "Phase 1", status: "active" },
        { id: "2", title: "Phase 2", status: "draft" },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMilestones, error: null }),
            }),
          }),
        }),
      });

      const result = await getCampaignMilestones("campaign-1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });
});

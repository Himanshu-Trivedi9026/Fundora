/**
 * Milestone Review Tests — Unit tests for donor reviews.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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

import { createReview, getMilestoneReviews, getReviewStats, getUserReview } from "../../../lib/milestone/milestoneReview";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("MilestoneReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createReview", () => {
    it("should create review successfully", async () => {
      const mockReview = {
        id: "review-1",
        milestone_id: "milestone-1",
        reviewer_id: "user-1",
        decision: "approve",
        vote_weight: 10,
        donation_amount: 1000,
      };

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockReview, error: null }),
        }),
      });

      // First: check existing review (none found)
      // Second: verify milestone exists
      // Third: fetch verified donations (vote weight is derived from the
      //        donor's VERIFIED contributions, never from client input)
      // Fourth: insert review
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "milestone-1", status: "submitted", campaign_id: "campaign-1" }, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [{ amount: 1000 }], error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({ insert: insertMock });

      const result = await createReview({
        milestoneId: "milestone-1",
        reviewerId: "user-1",
        decision: "approve",
        comment: "Great progress!",
        voteWeight: 1,
        donationAmount: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.data.decision).toBe("approve");

      // Vote weight is derived from verified donations (₹1000 → weight 10),
      // not from the client-supplied voteWeight/donationAmount.
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          vote_weight: 10,
          donation_amount: 1000,
        })
      );
    });

    it("should reject duplicate review from same user", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing-review" }, error: null }),
            }),
          }),
        }),
      });

      const result = await createReview({
        milestoneId: "milestone-1",
        reviewerId: "user-1",
        decision: "approve",
        comment: "Already reviewed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already reviewed");
    });
  });

  describe("getMilestoneReviews", () => {
    it("should return reviews for milestone", async () => {
      const mockReviews = [
        { id: "1", decision: "approve", vote_weight: 1 },
        { id: "2", decision: "approve", vote_weight: 1 },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockReviews, error: null }),
          }),
        }),
      });

      const result = await getMilestoneReviews("milestone-1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getReviewStats", () => {
    it("should calculate approval percentage", async () => {
      const mockReviews = [
        { decision: "approve", vote_weight: 1, donation_amount: 1000 },
        { decision: "approve", vote_weight: 1, donation_amount: 1000 },
        { decision: "reject", vote_weight: 1, donation_amount: 500 },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockReviews, error: null }),
        }),
      });

      const result = await getReviewStats("milestone-1");
      expect(result.success).toBe(true);
      expect(result.data.totalReviews).toBe(3);
      expect(result.data.approveCount).toBe(2);
      expect(result.data.approvalPercentage).toBe(67);
    });
  });

  describe("getUserReview", () => {
    it("should return user review if exists", async () => {
      const mockReview = { id: "review-1", reviewer_id: "user-1", decision: "approve" };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockReview, error: null }),
            }),
          }),
        }),
      });

      const result = await getUserReview("milestone-1", "user-1");
      expect(result.success).toBe(true);
      expect(result.data.hasReviewed).toBe(true);
      expect(result.data.review.id).toBe("review-1");
    });
  });
});

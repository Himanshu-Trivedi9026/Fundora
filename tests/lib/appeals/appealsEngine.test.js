/**
 * Appeals Engine Tests — Unit tests for appeal management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createAppeal,
  getAppeal,
  getAppeals,
  reviewAppeal,
  withdrawAppeal,
  getAppealsStats,
  APPEAL_TYPES,
  APPEAL_STATUSES,
  APPEAL_DECISIONS,
} from "../../../lib/appeals/appealsEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("AppealsEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAppeal", () => {
    it("should create an appeal", async () => {
      const mockAppeal = {
        id: "appeal-1",
        appeal_number: "APL-2026-00001",
        appeal_type: "moderation_action",
        status: "submitted",
        appellant_id: "user-1",
      };

      // 1. generateAppealNumber: select("appeal_number").like(...).order(...).limit(1)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        // 2. Insert appeal: insert({...}).select("*").single()
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAppeal, error: null }),
            }),
          }),
        });

      const result = await createAppeal({
        appealType: "moderation_action",
        appellantId: "user-1",
        originalAction: "content_removal",
        originalActionId: "action-1",
        originalActionType: "moderation",
        reason: "Content was not spam",
      });

      expect(result.success).toBe(true);
    });

    it("should validate required fields", async () => {
      const result = await createAppeal({ appealType: "test" });
      expect(result.success).toBe(false);
    });
  });

  describe("reviewAppeal", () => {
    it("should review an appeal", async () => {
      const mockAppeal = { id: "appeal-1", status: "under_review" };
      const mockReviewed = { ...mockAppeal, status: "decided", reviewer_decision: "uphold" };

      // 1. Fetch appeal: select("id, status").eq("id", appealId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAppeal, error: null }),
            }),
          }),
        })
        // 2. Update appeal: update({...}).eq("id", appealId).select("*").single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockReviewed, error: null }),
              }),
            }),
          }),
        });

      const result = await reviewAppeal("appeal-1", "uphold", "Original decision was correct", "Reviewed by admin", "admin-1");
      expect(result.success).toBe(true);
    });
  });

  describe("withdrawAppeal", () => {
    it("should withdraw an appeal", async () => {
      const mockAppeal = { id: "appeal-1", status: "submitted", appellant_id: "user-1" };
      const mockWithdrawn = { ...mockAppeal, status: "withdrawn" };

      // 1. Fetch appeal: select("id, appellant_id, status").eq("id", appealId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAppeal, error: null }),
            }),
          }),
        })
        // 2. Update appeal: update({...}).eq("id", appealId).select("*").single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockWithdrawn, error: null }),
              }),
            }),
          }),
        });

      const result = await withdrawAppeal("appeal-1", "user-1");
      expect(result.success).toBe(true);
    });

    it("should reject withdrawal by non-owner", async () => {
      const mockAppeal = { id: "appeal-1", status: "submitted", appellant_id: "user-1" };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockAppeal, error: null }),
          }),
        }),
      });

      const result = await withdrawAppeal("appeal-1", "user-2");
      expect(result.success).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have valid types", () => {
      expect(APPEAL_TYPES).toBeDefined();
    });

    it("should have valid statuses", () => {
      expect(APPEAL_STATUSES).toBeDefined();
    });

    it("should have valid decisions", () => {
      expect(APPEAL_DECISIONS).toBeDefined();
    });
  });
});

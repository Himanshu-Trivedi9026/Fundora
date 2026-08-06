/**
 * Moderation Engine Tests — Unit tests for moderation case management.
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
  createModerationCase,
  getModerationCase,
  getModerationCases,
  assignModerationCase,
  resolveModerationCase,
  escalateModerationCase,
  getModerationStats,
  MODERATION_CASE_TYPES,
  MODERATION_STATUSES,
  MODERATION_ACTIONS,
} from "../../../lib/moderation/moderationEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("ModerationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createModerationCase", () => {
    it("should create a moderation case", async () => {
      const mockCase = {
        id: "mod-1",
        case_number: "MOD-2026-00001",
        case_type: "spam",
        status: "open",
      };

      // 1. generateCaseNumber: select("case_number").like(...).order(...).limit(1).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
                }),
              }),
            }),
          }),
        })
        // 2. Insert case: insert({...}).select().single()
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        });

      const result = await createModerationCase({
        caseType: "spam",
        reporterId: "user-1",
        description: "Spam comments on campaign",
      });

      expect(result.success).toBe(true);
    });

    it("should validate required fields", async () => {
      const result = await createModerationCase({});
      expect(result.success).toBe(false);
    });
  });

  describe("resolveModerationCase", () => {
    it("should resolve a moderation case", async () => {
      const mockCase = { id: "mod-1", status: "in_review", case_number: "MOD-2026-00001" };
      const mockResolved = { ...mockCase, status: "resolved", action_taken: "warning" };

      // 1. Fetch case: select("*").eq("id", caseId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        })
        // 2. Update case: update({...}).eq("id", caseId).select().single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockResolved, error: null }),
              }),
            }),
          }),
        });

      const result = await resolveModerationCase("mod-1", "warning", "First offense", "Don't spam", "admin-1");
      expect(result.success).toBe(true);
    });
  });

  describe("escalateModerationCase", () => {
    it("should escalate a moderation case", async () => {
      const mockCase = { id: "mod-1", status: "open", priority: "medium", case_number: "MOD-2026-00001" };
      const mockEscalated = { ...mockCase, status: "escalated", priority: "critical" };

      // 1. Fetch case
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        })
        // 2. Update case
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockEscalated, error: null }),
              }),
            }),
          }),
        });

      const result = await escalateModerationCase("mod-1", "Severe harassment", "admin-1");
      expect(result.success).toBe(true);
    });
  });

  describe("constants", () => {
    it("should have valid case types", () => {
      expect(MODERATION_CASE_TYPES.SPAM).toBe("spam");
      expect(MODERATION_CASE_TYPES.HARASSMENT).toBe("harassment");
    });

    it("should have valid statuses", () => {
      expect(MODERATION_STATUSES.OPEN).toBe("open");
      expect(MODERATION_STATUSES.RESOLVED).toBe("resolved");
    });

    it("should have valid actions", () => {
      expect(MODERATION_ACTIONS.WARNING).toBe("warning");
      expect(MODERATION_ACTIONS.PERMANENT_BAN).toBe("permanent_ban");
    });
  });
});

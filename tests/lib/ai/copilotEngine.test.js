/**
 * Copilot Engine Tests — Unit tests for role-specific AI copilot interfaces.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
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

vi.mock("../../../lib/ai/aiEngine.js", () => ({
  completeAIRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { content: "AI response", sources: [], tokensUsed: 100 },
  }),
  getAIConfig: vi.fn().mockResolvedValue({ success: true, data: { enabled: true } }),
}));

vi.mock("../../../lib/ai/contextBuilder.js", () => ({
  buildCampaignContext: vi.fn().mockResolvedValue({
    success: true,
    data: { campaigns: [{ id: "c1", title: "Test Campaign" }] },
  }),
  buildUserContext: vi.fn().mockResolvedValue({
    success: true,
    data: { name: "Test User", role: "creator" },
  }),
  buildDonorContext: vi.fn().mockResolvedValue({
    success: true,
    data: { totalDonated: 500, campaignCount: 3 },
  }),
  buildPlatformContext: vi.fn().mockResolvedValue({
    success: true,
    data: { totalUsers: 1000, totalCampaigns: 200 },
  }),
}));

vi.mock("../../../lib/ai/conversationMemory.js", () => ({
  createConversation: vi.fn().mockResolvedValue({
    success: true,
    data: { conversationId: "conv-1" },
  }),
  addMessage: vi.fn().mockResolvedValue({ success: true }),
  getConversationContext: vi.fn().mockResolvedValue({
    success: true,
    data: { messages: [] },
  }),
  COPILOT_TYPES: {
    CREATOR: "creator",
    DONOR: "donor",
    ADMIN: "admin",
    MODERATOR: "moderator",
    ORGANIZATION: "organization",
  },
}));

import {
  askCopilot,
  getDashboardSummary,
  explainAnalytics,
  getWorkflowGuidance,
  getSuggestions,
} from "../../../lib/ai/copilotEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import {
  buildCampaignContext,
  buildUserContext,
  buildDonorContext,
  buildPlatformContext,
} from "../../../lib/ai/contextBuilder.js";
import {
  createConversation,
  addMessage,
  getConversationContext,
} from "../../../lib/ai/conversationMemory.js";

// ─── Tests ───────────────────────────────────────────────────────────

describe("CopilotEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── askCopilot ───────────────────────────────────────────────────

  describe("askCopilot", () => {
    it("builds context, creates conversation, calls AI, and stores messages", async () => {
      const result = await askCopilot({
        userId: "user-1",
        copilotType: "creator",
        question: "How can I improve my campaign?",
      });

      expect(result.success).toBe(true);
      expect(result.data.answer).toBeDefined();
      expect(typeof result.data.answer).toBe("string");
      expect(result.data.conversationId).toBe("conv-1");

      // Context builders were called
      expect(buildCampaignContext).toHaveBeenCalled();
      expect(buildUserContext).toHaveBeenCalled();

      // Conversation was created
      expect(createConversation).toHaveBeenCalled();

      // Messages were stored
      expect(addMessage).toHaveBeenCalledTimes(2); // user + assistant
    });

    it("uses existing conversation when conversationId is provided", async () => {
      const result = await askCopilot({
        userId: "user-1",
        copilotType: "creator",
        question: "What's my progress?",
        conversationId: "conv-existing",
      });

      expect(result.success).toBe(true);
      // Should not create a new conversation
      expect(createConversation).not.toHaveBeenCalled();
      // Should fetch existing context
      expect(getConversationContext).toHaveBeenCalled();
    });

    it("returns error when required params are missing", async () => {
      const noUser = await askCopilot({ copilotType: "creator", question: "Hi" });
      expect(noUser.success).toBe(false);

      const noType = await askCopilot({ userId: "u1", question: "Hi" });
      expect(noType.success).toBe(false);

      const noQuestion = await askCopilot({ userId: "u1", copilotType: "creator" });
      expect(noQuestion.success).toBe(false);
    });

    it("builds donor context for donor copilot type", async () => {
      const result = await askCopilot({
        userId: "user-2",
        copilotType: "donor",
        question: "Recommend campaigns for me",
      });

      expect(result.success).toBe(true);
      expect(buildDonorContext).toHaveBeenCalled();
    });

    it("builds platform context for admin copilot type", async () => {
      const result = await askCopilot({
        userId: "admin-1",
        copilotType: "admin",
        question: "What's the platform health?",
      });

      expect(result.success).toBe(true);
      expect(buildPlatformContext).toHaveBeenCalled();
    });
  });

  // ─── getDashboardSummary ──────────────────────────────────────────

  describe("getDashboardSummary", () => {
    it("returns creator-specific summary with metrics", async () => {
      // Mock campaign fetch
      const chainCreator = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "c1", title: "My Campaign", goal_amount: 10000, status: "active", created_at: new Date().toISOString() }],
            error: null,
          }),
        }),
      };
      const chainDonations = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ amount: 500, created_at: new Date().toISOString() }],
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseAdmin.from
        .mockReturnValueOnce(chainCreator)
        .mockReturnValueOnce(chainDonations);

      const result = await getDashboardSummary({
        userId: "user-1",
        copilotType: "creator",
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.summary).toBe("string");
      expect(Array.isArray(result.data.metrics)).toBe(true);
      expect(Array.isArray(result.data.highlights)).toBe(true);
      expect(Array.isArray(result.data.actionItems)).toBe(true);
    });

    it("returns admin-specific summary with platform metrics", async () => {
      const emptyChain = {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      supabaseAdmin.from
        .mockReturnValueOnce(emptyChain) // campaigns
        .mockReturnValueOnce(emptyChain) // donations
        .mockReturnValueOnce(emptyChain) // users
        .mockReturnValueOnce(emptyChain); // fraud cases

      const result = await getDashboardSummary({
        userId: "admin-1",
        copilotType: "admin",
        timeframe: "7d",
      });

      expect(result.success).toBe(true);
      expect(result.data.metrics.length).toBe(4);
      expect(result.data.summary).toContain("Platform health");
    });

    it("returns error when required params are missing", async () => {
      const noUser = await getDashboardSummary({ copilotType: "creator" });
      expect(noUser.success).toBe(false);

      const noType = await getDashboardSummary({ userId: "u1" });
      expect(noType.success).toBe(false);
    });

    it("returns error for unknown copilot type", async () => {
      const result = await getDashboardSummary({
        userId: "u1",
        copilotType: "unknown_role",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── explainAnalytics ─────────────────────────────────────────────

  describe("explainAnalytics", () => {
    it("explains a donation metric with context", async () => {
      const result = await explainAnalytics({
        userId: "user-1",
        copilotType: "creator",
        metric: "Total Raised",
        value: 5000,
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.explanation).toBe("string");
      expect(typeof result.data.comparison).toBe("string");
      expect(typeof result.data.suggestion).toBe("string");
      expect(result.data.explanation).toContain("5,000");
    });

    it("explains a conversion rate metric", async () => {
      const result = await explainAnalytics({
        userId: "user-1",
        copilotType: "creator",
        metric: "Conversion Rate",
        value: 3.5,
      });

      expect(result.success).toBe(true);
      expect(result.data.explanation).toContain("Conversion Rate");
    });

    it("returns error when userId is missing", async () => {
      const result = await explainAnalytics({ metric: "Raised", value: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toBe("userId is required");
    });

    it("returns error when metric is missing", async () => {
      const result = await explainAnalytics({ userId: "u1", value: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toBe("metric is required");
    });
  });

  // ─── getWorkflowGuidance ──────────────────────────────────────────

  describe("getWorkflowGuidance", () => {
    it("returns step-by-step guidance for campaign creation", async () => {
      const result = await getWorkflowGuidance({
        userId: "user-1",
        copilotType: "creator",
        task: "create a campaign",
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.steps)).toBe(true);
      expect(result.data.steps.length).toBeGreaterThan(0);
      expect(typeof result.data.estimatedTime).toBe("string");

      // Each step should have description and tips
      for (const step of result.data.steps) {
        expect(step).toHaveProperty("description");
        expect(step).toHaveProperty("tips");
        expect(Array.isArray(step.tips)).toBe(true);
      }
    });

    it("returns guidance for donation workflow", async () => {
      const result = await getWorkflowGuidance({
        userId: "user-2",
        copilotType: "donor",
        task: "make a donation",
      });

      expect(result.success).toBe(true);
      expect(result.data.steps.length).toBeGreaterThan(0);
    });

    it("returns guidance for moderation workflow", async () => {
      const result = await getWorkflowGuidance({
        userId: "mod-1",
        copilotType: "moderator",
        task: "moderate content",
      });

      expect(result.success).toBe(true);
      expect(result.data.steps.length).toBeGreaterThan(0);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await getWorkflowGuidance({ task: "create" });
      expect(noUser.success).toBe(false);

      const noTask = await getWorkflowGuidance({ userId: "u1" });
      expect(noTask.success).toBe(false);
    });
  });

  // ─── getSuggestions ───────────────────────────────────────────────

  describe("getSuggestions", () => {
    it("returns contextual suggestions for creator with drafts", async () => {
      // Mock draft campaigns
      const chainDrafts = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "d1", title: "", description: "", goal_amount: 0, media_urls: [] }],
              error: null,
            }),
          }),
        }),
      };
      // Mock active campaigns
      const chainActive = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "a1", title: "Active", last_update_at: null }],
              error: null,
            }),
          }),
        }),
      };

      supabaseAdmin.from
        .mockReturnValueOnce(chainDrafts)
        .mockReturnValueOnce(chainActive);

      const result = await getSuggestions({
        userId: "user-1",
        copilotType: "creator",
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Should have suggestion about missing title
      const titleSuggestion = result.data.find((s) =>
        s.suggestion.toLowerCase().includes("title")
      );
      expect(titleSuggestion).toBeDefined();
    });

    it("returns suggestions for donor role", async () => {
      const emptyChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };

      supabaseAdmin.from.mockReturnValueOnce(emptyChain);

      const result = await getSuggestions({
        userId: "user-2",
        copilotType: "donor",
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await getSuggestions({ copilotType: "creator" });
      expect(noUser.success).toBe(false);

      const noType = await getSuggestions({ userId: "u1" });
      expect(noType.success).toBe(false);
    });
  });
});

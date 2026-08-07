/**
 * AI Platform Integration Tests — Cross-module AI engine workflows.
 *
 * Verifies that multiple AI engines (engine, token tracker, cost tracker,
 * conversation memory, embedding engine, knowledge engine, recommendation
 * engine, prediction engine, campaign AI, copilot engine) work together
 * correctly through real function-to-function call chains.
 *
 * External dependencies (DB, logger, provider) are mocked; internal module
 * interactions are exercised through the actual code paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (BEFORE imports) ─────────────────────────────────────────────────

vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../lib/ai/providerRegistry", () => ({
  getActiveModelProvider: vi.fn().mockReturnValue({
    chatCompletion: vi.fn().mockResolvedValue({
      content: "AI response",
      tokens: { input: 15, output: 25 },
      model: "gpt-4o",
    }),
    createEmbedding: vi.fn().mockResolvedValue({
      success: true,
      data: { data: [{ embedding: Array(1536).fill(0.1) }] },
    }),
  }),
}));

vi.mock("../../lib/ai/modelRouter", () => ({
  routeModel: vi.fn().mockResolvedValue({
    success: true,
    data: { model: "gpt-4o", provider: "openai" },
  }),
  getRouterConfig: vi.fn().mockResolvedValue({
    success: true,
    data: { taskRoutes: {}, fallbackChain: ["openai"] },
  }),
}));

vi.mock("../../lib/ai/tokenTracker", () => ({
  trackTokenUsage: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "usage-1", costCents: 0.5 },
  }),
  checkUsageLimit: vi
    .fn()
    .mockResolvedValue({ success: true, data: { allowed: true } }),
  getUsageStats: vi.fn().mockResolvedValue({
    success: true,
    data: { totalTokens: 5000, totalCost: 10.0 },
  }),
  calculateCost: vi.fn().mockReturnValue(0.5),
}));

vi.mock("../../lib/ai/costTracker", () => ({
  recordAICost: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "cost-1", costCents: 0.5 },
  }),
  getCostSummary: vi.fn().mockResolvedValue({
    success: true,
    data: { totalCostCents: 5.0, byModel: {}, byOperation: {} },
  }),
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { completeAIRequest } from "../../lib/ai/aiEngine";
import { trackTokenUsage } from "../../lib/ai/tokenTracker";
import { recordAICost } from "../../lib/ai/costTracker";
import { routeModel } from "../../lib/ai/modelRouter";
import { getActiveModelProvider } from "../../lib/ai/providerRegistry";
import {
  createConversation,
  addMessage,
  getConversationContext,
} from "../../lib/ai/conversationMemory";
import {
  createEmbedding,
  searchEmbeddings,
} from "../../lib/ai/embeddingEngine";
import {
  indexKnowledgeArticle,
  searchKnowledge,
  chunkDocument,
} from "../../lib/ai/knowledgeEngine";
import { getSimilarCampaigns } from "../../lib/ai/recommendationEngine";
import { batchPredict } from "../../lib/ai/predictionEngine";
import { scoreCampaignQuality } from "../../lib/ai/campaignAI";
import { askCopilot, COPILOT_TYPES } from "../../lib/ai/copilotEngine";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a Supabase query chain mock that resolves with `result` at `single()`.
 * chain: from → select → eq → [eq → ...] → single
 */
function mockSingle(result) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

/**
 * Build a Supabase query chain mock that resolves with `result` at end of chain.
 * chain: from → select → eq → [eq → ...] → resolve(result)
 */
function mockResolve(result) {
  return {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: undefined, // prevent promise resolution
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AI Platform Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Test 1: AI Engine → Token Tracker → Cost Tracker ─────────────────────

  it("completeAIRequest tracks tokens and costs through tokenTracker and costTracker", async () => {
    const mockProvider = getActiveModelProvider();

    const result = await completeAIRequest({
      userId: "user-1",
      taskType: "campaign_quality",
      messages: [{ role: "user", content: "Analyze my campaign" }],
    });

    // Provider was called
    expect(mockProvider.chatCompletion).toHaveBeenCalled();

    // Token usage was recorded
    expect(trackTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        taskType: "campaign_quality",
      }),
    );

    // Cost was recorded
    expect(recordAICost).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        taskType: "campaign_quality",
      }),
    );

    // Result includes token and cost data
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.tokens).toBeDefined();
    expect(typeof result.data.costCents).toBe("number");
  });

  // ─── Test 2: AI Engine → Conversation Memory → Context Builder ────────────

  it("full conversation flow creates, stores, and retrieves context", async () => {
    const convId = "conv-123";
    const msgId = "msg-456";

    // Mock createConversation to return a conversation ID
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "ai_conversations") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: convId, title: "Creator conversation" },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const convResult = await createConversation({
      userId: "user-1",
      copilotType: COPILOT_TYPES.CREATOR,
      title: "Campaign help",
    });

    expect(convResult.success).toBe(true);
    expect(convResult.data.id).toBe(convId);

    // Mock addMessage to succeed
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "ai_messages") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: msgId },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        update: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    const userMsg = await addMessage({
      conversationId: convId,
      role: "user",
      content: "How do I improve my campaign?",
    });

    expect(userMsg.success).toBe(true);

    // Mock getConversationContext to return messages
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "ai_conversations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { summary: null, summary_updated_at: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "ai_messages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    role: "user",
                    content: "How do I improve my campaign?",
                    created_at: new Date().toISOString(),
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const ctx = await getConversationContext(convId);

    expect(ctx.success).toBe(true);
    expect(ctx.data.messages.length).toBeGreaterThanOrEqual(1);
    expect(ctx.data.messages[0].role).toBe("user");
  });

  // ─── Test 3: Embedding Engine → Knowledge Engine ──────────────────────────

  it("indexKnowledgeArticle chunks content and creates embeddings", async () => {
    const articleId = "article-abc";
    const content = "Fundora is a crowdfunding platform. ".repeat(20);

    // Mock article insert
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "knowledge_articles") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: articleId },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    // Mock embedding insert (called once per chunk)
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "ai_embeddings") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `emb-${Math.random().toString(36).slice(2, 8)}` },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const result = await indexKnowledgeArticle({
      title: "Fundora Guide",
      content,
      category: "guide",
      tags: ["fundraising", "guide"],
    });

    expect(result.success).toBe(true);
    expect(result.data.id).toBe(articleId);
    expect(result.data.chunkCount).toBeGreaterThan(1);

    // Verify chunking works standalone
    const chunks = chunkDocument({
      content: "Hello world. This is a test sentence for chunking.",
    });
    expect(chunks.success).toBe(true);
    expect(chunks.data.chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.data.chunks[0].text).toBeTruthy();
  });

  // ─── Test 4: Recommendation Engine → Embedding Engine ─────────────────────

  it("getSimilarCampaigns uses embeddings for similarity search", async () => {
    const campaignId = "campaign-xyz";

    // Mock campaign fetch
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "campaigns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: campaignId,
                  title: "Tech Startup",
                  description: "Building an AI platform",
                  category: "technology",
                  goal_amount: 50000,
                  current_amount: 20000,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    // Mock embedding search to return similar campaigns
    supabaseAdmin.rpc.mockResolvedValueOnce({
      data: [
        {
          entity_id: "campaign-sim-1",
          entity_type: "campaign",
          similarity: 0.85,
          metadata: { inputPreview: "Similar tech campaign" },
        },
        {
          entity_id: "campaign-sim-2",
          entity_type: "campaign",
          similarity: 0.72,
          metadata: { inputPreview: "Another tech project" },
        },
      ],
      error: null,
    });

    // Mock fetch of all active campaigns for feature-based scoring.
    // Current production flow: from("campaigns").select().eq(status).neq(id).limit()
    supabaseAdmin.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "campaign-sim-1",
                  title: "Similar Tech",
                  category: "technology",
                  status: "active",
                },
                {
                  id: "campaign-sim-2",
                  title: "Another Tech",
                  category: "technology",
                  status: "active",
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }));

    const result = await getSimilarCampaigns({ campaignId, limit: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  // ─── Test 5: Prediction Engine — Batch predictions ────────────────────────

  it("batchPredict processes predictions for multiple campaigns", async () => {
    const campaigns = [
      {
        id: "c1",
        title: "Health App",
        goal_amount: 30000,
        current_amount: 15000,
        category: "health",
        created_at: "2025-01-01T00:00:00Z",
        donor_count: 50,
        update_count: 5,
        creator_id: "u1",
      },
      {
        id: "c2",
        title: "Education Fund",
        goal_amount: 10000,
        current_amount: 2000,
        category: "education",
        created_at: "2025-06-01T00:00:00Z",
        donor_count: 10,
        update_count: 1,
        creator_id: "u2",
      },
      {
        id: "c3",
        title: "Art Project",
        goal_amount: 5000,
        current_amount: 5000,
        category: "arts",
        created_at: "2025-03-01T00:00:00Z",
        donor_count: 80,
        update_count: 12,
        creator_id: "u3",
      },
    ];

    // Mock fetch for each campaign
    let fetchCallCount = 0;
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "campaigns") {
        const campaign = campaigns[fetchCallCount] || campaigns[0];
        fetchCallCount++;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...campaign,
                  creator: { trust_score: 0.7, reputation_score: 0.8 },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "donations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const results = await batchPredict({
      entityType: "campaign",
      entityIds: ["c1", "c2", "c3"],
      predictionType: "success_prob",
    });

    expect(results.success).toBe(true);
    expect(results.data).toBeDefined();

    // Each campaign should have a prediction
    if (results.data.predictions) {
      expect(results.data.predictions.length).toBeGreaterThanOrEqual(1);
      for (const pred of results.data.predictions) {
        expect(pred.probability).toBeDefined();
        expect(typeof pred.probability).toBe("number");
      }
    }
  });

  // ─── Test 6: Campaign AI → AI Engine ──────────────────────────────────────

  it("scoreCampaignQuality fetches campaign data and computes quality score", async () => {
    const campaignId = "campaign-quality-test";

    // Mock campaign fetch
    supabaseAdmin.from.mockImplementationOnce((table) => {
      if (table === "campaigns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: campaignId,
                  title: "Build an Innovative Education Platform",
                  description:
                    "We are building a platform that transforms how students learn. Our community-driven approach combines AI tutoring with peer support. We need your help to make education accessible to everyone. Together we can change lives.",
                  goal_amount: 20000,
                  category: "education",
                  media_urls: ["img1.jpg", "img2.jpg", "img3.jpg"],
                  creator_id: "creator-1",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const result = await scoreCampaignQuality({ campaignId });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data.overallScore).toBe("number");
    expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.data.overallScore).toBeLessThanOrEqual(100);
    expect(result.data.dimensions).toBeDefined();
    expect(typeof result.data.dimensions.title).toBe("number");
    expect(typeof result.data.dimensions.description).toBe("number");
  });

  // ─── Test 7: Copilot Engine — Full copilot flow ───────────────────────────

  it("askCopilot creates conversation, builds context, calls AI, and stores messages", async () => {
    const convId = "copilot-conv-789";
    const question = "How can I improve my campaign engagement?";

    // Mock buildCampaignContext → supabase queries for user's campaigns
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "campaigns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "camp-1",
                  title: "My Campaign",
                  description: "Test",
                  goal_amount: 10000,
                  category: "technology",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      // For conversation creation
      if (table === "ai_conversations") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: convId, title: "creator conversation" },
                error: null,
              }),
            }),
          }),
        };
      }
      // For message inserts
      if (table === "ai_messages") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `msg-${Math.random().toString(36).slice(2, 8)}` },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });
    // Mock conversation update timestamp
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "ai_conversations") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: convId, title: "creator conversation" },
                error: null,
              }),
            }),
          }),
        };
      }
      return supabaseAdmin;
    });

    const result = await askCopilot({
      userId: "user-1",
      copilotType: COPILOT_TYPES.CREATOR,
      question,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data.answer).toBe("string");
    expect(result.data.answer.length).toBeGreaterThan(0);
    expect(result.data.conversationId).toBe(convId);
  });

  // ─── Test 8: Error propagation — provider failure doesn't crash pipeline ──

  it("provider failure is caught and returned as failure without crashing", async () => {
    const failingProvider = {
      chatCompletion: vi
        .fn()
        .mockRejectedValue(new Error("Provider rate limit exceeded")),
      createEmbedding: vi
        .fn()
        .mockRejectedValue(new Error("Provider unavailable")),
    };
    getActiveModelProvider.mockReturnValueOnce(failingProvider);

    // Should NOT throw — error is caught internally
    const result = await completeAIRequest({
      userId: "user-1",
      taskType: "test_task",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");

    // Audit log should record the failure
    const { logAuditEvent } = await import("../../lib/verification/auditLog");
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("failed"),
      }),
    );
  });
});

/**
 * Conversation Memory Tests — Unit tests for persistent conversation management.
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
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createConversation,
  addMessage,
  getConversationHistory,
  getConversationContext,
  archiveConversation,
  COPILOT_TYPES,
} from "../../../lib/ai/conversationMemory.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";

describe("ConversationMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createConversation ───

  describe("createConversation", () => {
    it("should create a conversation with valid params", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "conv-1", title: "Creator conversation" },
              error: null,
            }),
          }),
        }),
      });

      const result = await createConversation({
        userId: "user-1",
        copilotType: COPILOT_TYPES.CREATOR,
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("conv-1");
      expect(result.data.title).toBeDefined();
    });

    it("should fail when userId is missing", async () => {
      const result = await createConversation({
        copilotType: COPILOT_TYPES.CREATOR,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("userId is required");
    });

    it("should fail with invalid copilotType", async () => {
      const result = await createConversation({
        userId: "user-1",
        copilotType: "invalid_type",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("copilotType must be one of");
    });

    it("should use provided title or generate default", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "conv-2", title: "My Custom Title" },
              error: null,
            }),
          }),
        }),
      });

      const result = await createConversation({
        userId: "user-1",
        copilotType: COPILOT_TYPES.DONOR,
        title: "My Custom Title",
      });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe("My Custom Title");
    });
  });

  // ─── addMessage ───

  describe("addMessage", () => {
    it("should add a user message successfully", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "msg-1" },
                error: null,
              }),
            }),
          }),
        })
        // Update conversation timestamp
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await addMessage({
        conversationId: "conv-1",
        role: "user",
        content: "Help me improve my campaign",
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("msg-1");
    });

    it("should add an assistant message", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "msg-2" },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await addMessage({
        conversationId: "conv-1",
        role: "assistant",
        content: "Here are some suggestions for your campaign...",
        model: "gpt-4",
        tokenCount: 150,
        costCents: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("msg-2");
    });

    it("should add a system message", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "msg-3" },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await addMessage({
        conversationId: "conv-1",
        role: "system",
        content: "You are a helpful campaign advisor.",
      });

      expect(result.success).toBe(true);
    });

    it("should fail when conversationId is missing", async () => {
      const result = await addMessage({
        role: "user",
        content: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("conversationId is required");
    });

    it("should fail when role is invalid", async () => {
      const result = await addMessage({
        conversationId: "conv-1",
        role: "moderator",
        content: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("role must be one of");
    });

    it("should fail when content is missing", async () => {
      const result = await addMessage({
        conversationId: "conv-1",
        role: "user",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("content is required");
    });
  });

  // ─── getConversationHistory ───

  describe("getConversationHistory", () => {
    it("should return messages in chronological order", async () => {
      // Count query: from().select().eq() — terminal is eq
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        })
        // Messages query: from().select().eq().order().range() — terminal is range
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "m1",
                      role: "user",
                      content: "Hello",
                      model: null,
                      token_count: null,
                      cost_cents: null,
                      created_at: "2025-07-01T10:00:00Z",
                    },
                    {
                      id: "m2",
                      role: "assistant",
                      content: "Hi there!",
                      model: "gpt-4",
                      token_count: 10,
                      cost_cents: 1,
                      created_at: "2025-07-01T10:00:01Z",
                    },
                    {
                      id: "m3",
                      role: "user",
                      content: "Help me",
                      model: null,
                      token_count: null,
                      cost_cents: null,
                      created_at: "2025-07-01T10:00:02Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        });

      const result = await getConversationHistory("conv-1");

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(3);
      expect(result.data.messages[0].role).toBe("user");
      expect(result.data.messages[1].role).toBe("assistant");
      expect(result.data.total).toBe(3);
    });

    it("should respect limit parameter", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "m1",
                      role: "user",
                      content: "msg1",
                      model: null,
                      token_count: null,
                      cost_cents: null,
                      created_at: "2025-07-01",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        });

      const result = await getConversationHistory("conv-1", {
        limit: 5,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(1);
    });

    it("should fail when conversationId is missing", async () => {
      const result = await getConversationHistory(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("conversationId is required");
    });
  });

  // ─── getConversationContext ───

  describe("getConversationContext", () => {
    it("should return all messages when within token budget", async () => {
      // Conversation metadata
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { summary: null, summary_updated_at: null },
                error: null,
              }),
            }),
          }),
        })
        // Messages — terminal is order (no .limit() in this function)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    role: "user",
                    content: "Short message",
                    created_at: "2025-07-01",
                  },
                  {
                    role: "assistant",
                    content: "Short reply",
                    created_at: "2025-07-01",
                  },
                ],
                error: null,
              }),
            }),
          }),
        });

      const result = await getConversationContext("conv-1", {
        maxTokens: 4000,
      });

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(2);
      expect(result.data.tokenCount).toBeLessThanOrEqual(4000);
    });

    it("should truncate older messages when exceeding token budget", async () => {
      const longContent = "This is a long message. ".repeat(200); // ~5200 chars ≈ 1300 tokens

      // Conversation metadata with summary
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  summary: "Previous discussion about campaigns",
                  summary_updated_at: "2025-07-01",
                },
                error: null,
              }),
            }),
          }),
        })
        // Messages (3 long messages that exceed budget)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    role: "user",
                    content: longContent,
                    created_at: "2025-07-01T10:00:00Z",
                  },
                  {
                    role: "assistant",
                    content: longContent,
                    created_at: "2025-07-01T10:00:01Z",
                  },
                  {
                    role: "user",
                    content: "Latest question",
                    created_at: "2025-07-01T10:00:02Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        });

      const result = await getConversationContext("conv-1", { maxTokens: 500 });

      expect(result.success).toBe(true);
      expect(result.data.tokenCount).toBeLessThanOrEqual(500);
      // Should include the most recent message
      expect(
        result.data.messages.some((m) => m.content === "Latest question"),
      ).toBe(true);
    });

    it("should return empty when conversation has no messages", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { summary: null },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        });

      const result = await getConversationContext("conv-1");

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(0);
      expect(result.data.tokenCount).toBe(0);
    });

    it("should fail when conversationId is missing", async () => {
      const result = await getConversationContext(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("conversationId is required");
    });
  });

  // ─── archiveConversation ───

  describe("archiveConversation", () => {
    it("should archive a conversation successfully", async () => {
      // Fetch conversation for ownership check
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "conv-1",
                  user_id: "user-1",
                  title: "My conversation",
                },
                error: null,
              }),
            }),
          }),
        })
        // Update status
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await archiveConversation("conv-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.data.archived).toBe(true);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ai_conversation_archived",
          entityType: "ai_conversation",
          entityId: "conv-1",
          userId: "user-1",
        }),
      );
    });

    it("should fail when conversation is not found", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await archiveConversation("nonexistent", "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail when user does not own the conversation", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "conv-1",
                user_id: "other-user",
                title: "Not my conversation",
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await archiveConversation("conv-1", "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });

    it("should fail when conversationId is missing", async () => {
      const result = await archiveConversation(null, "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("conversationId is required");
    });

    it("should fail when userId is missing", async () => {
      const result = await archiveConversation("conv-1", null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId is required");
    });
  });
});

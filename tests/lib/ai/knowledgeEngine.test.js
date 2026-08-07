/**
 * Knowledge Engine Tests — Unit tests for knowledge base with semantic search.
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
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../lib/ai/embeddingEngine.js", () => ({
  createEmbedding: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "emb-1", dimensions: 1536 },
  }),
  searchEmbeddings: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

import {
  indexKnowledgeArticle,
  searchKnowledge,
  getRelevantContext,
  chunkDocument,
  manageKnowledgeArticle,
} from "../../../lib/ai/knowledgeEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";
import {
  createEmbedding,
  searchEmbeddings,
} from "../../../lib/ai/embeddingEngine.js";

// ─── Mock chain builders ──────────────────────────────────────────────

function mockInsertSingle(data) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(data),
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

function mockUpdateEq(data) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(data),
    }),
  };
}

function mockDeleteEq(data) {
  // Production deletes embeddings with two filters: .delete().eq().eq()
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("Knowledge Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("indexKnowledgeArticle", () => {
    it("should chunk content, create embeddings, and store the article", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockInsertSingle({ data: { id: "art-1" }, error: null }),
      );

      const result = await indexKnowledgeArticle({
        title: "Test Article",
        content: "This is test content about funding platforms.",
        category: "faq",
        tags: ["funding", "guide"],
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("art-1");
      expect(result.data.chunkCount).toBeGreaterThan(0);
      expect(createEmbedding).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalled();
    });

    it("should reject missing title", async () => {
      const result = await indexKnowledgeArticle({
        content: "Some content",
        category: "faq",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Title is required");
    });

    it("should reject content exceeding max length", async () => {
      const result = await indexKnowledgeArticle({
        title: "Big Article",
        content: "x".repeat(500001),
        category: "faq",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("should handle DB storage errors gracefully", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockInsertSingle({ data: null, error: { message: "DB failure" } }),
      );

      const result = await indexKnowledgeArticle({
        title: "Test",
        content: "Content",
        category: "faq",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to store article");
    });
  });

  describe("searchKnowledge", () => {
    it("should return semantic search results enriched with article metadata", async () => {
      searchEmbeddings.mockResolvedValueOnce({
        success: true,
        data: [
          { entityId: "art-1", entityType: "knowledge_article", score: 0.85 },
        ],
      });

      supabaseAdmin.from.mockReturnValueOnce(
        mockSelectSingle({
          data: {
            id: "art-1",
            title: "FAQ",
            content: "Long article content here",
            category: "faq",
            status: "active",
          },
          error: null,
        }),
      );

      const result = await searchKnowledge({ query: "how to fund" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("FAQ");
      expect(result.data[0].score).toBe(0.85);
    });

    it("should fall back to keyword search when semantic results are empty", async () => {
      searchEmbeddings.mockResolvedValueOnce({ success: true, data: [] });

      // Keyword fallback: from → select → eq → or → limit
      supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "art-2",
                    title: "Keyword Match",
                    content: "Relevant content",
                    category: "guide",
                    tags: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await searchKnowledge({ query: "funding guide" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Keyword Match");
      expect(result.data[0].score).toBe(0.4); // keyword approximate score
    });

    it("should reject empty query", async () => {
      const result = await searchKnowledge({ query: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Query string is required");
    });
  });

  describe("getRelevantContext", () => {
    it("should build multi-source context from knowledge articles", async () => {
      searchEmbeddings.mockResolvedValueOnce({
        success: true,
        data: [
          { entityId: "art-1", entityType: "knowledge_article", score: 0.8 },
        ],
      });

      supabaseAdmin.from.mockReturnValueOnce(
        mockSelectSingle({
          data: {
            id: "art-1",
            title: "FAQ",
            content: "Context content about funding",
            category: "faq",
            status: "active",
          },
          error: null,
        }),
      );

      const result = await getRelevantContext({ query: "funding context" });

      expect(result.success).toBe(true);
      expect(result.data.contextString).toContain("Knowledge: FAQ");
      expect(result.data.sources).toHaveLength(1);
      expect(result.data.sources[0].type).toBe("knowledge_article");
    });

    it("should return empty context when no sources match", async () => {
      searchEmbeddings.mockResolvedValueOnce({ success: true, data: [] });

      const result = await getRelevantContext({ query: "obscure topic" });

      expect(result.success).toBe(true);
      expect(result.data.contextString).toBe("");
      expect(result.data.sources).toHaveLength(0);
    });
  });

  describe("chunkDocument", () => {
    it("should split long content into overlapping chunks", () => {
      const content = "A".repeat(1200); // 1200 chars, should produce 3+ chunks
      const result = chunkDocument({ content, chunkSize: 500, overlap: 50 });

      expect(result.success).toBe(true);
      expect(result.data.chunks.length).toBeGreaterThanOrEqual(2);

      // Verify chunk metadata
      const first = result.data.chunks[0];
      expect(first.index).toBe(0);
      expect(first.charStart).toBe(0);
      expect(first.text.length).toBeLessThanOrEqual(500);
    });

    it("should return a single chunk for short content", () => {
      const result = chunkDocument({ content: "Short text", chunkSize: 500 });

      expect(result.success).toBe(true);
      expect(result.data.chunks).toHaveLength(1);
      expect(result.data.chunks[0].text).toBe("Short text");
    });

    it("should handle empty content", () => {
      const result = chunkDocument({ content: "" });

      expect(result.success).toBe(true);
      expect(result.data.chunks).toHaveLength(0);
    });

    it("should handle null content", () => {
      const result = chunkDocument({ content: null });

      expect(result.success).toBe(true);
      expect(result.data.chunks).toHaveLength(0);
    });
  });

  describe("manageKnowledgeArticle", () => {
    it("should archive an article", async () => {
      // Fetch existing article
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectSingle({
            data: {
              id: "art-1",
              title: "FAQ",
              category: "faq",
              status: "active",
            },
            error: null,
          }),
        )
        // Update status
        .mockReturnValueOnce(mockUpdateEq({ error: null }));

      const result = await manageKnowledgeArticle("art-1", "archive", "user-1");

      expect(result.success).toBe(true);
      expect(result.data.actioned).toBe(true);
      expect(logAuditEvent).toHaveBeenCalled();
    });

    it("should delete an article and its embeddings", async () => {
      // Fetch existing article
      supabaseAdmin.from
        .mockReturnValueOnce(
          mockSelectSingle({
            data: {
              id: "art-1",
              title: "FAQ",
              category: "faq",
              status: "active",
            },
            error: null,
          }),
        )
        // Delete embeddings
        .mockReturnValueOnce(mockDeleteEq({ error: null }))
        // Delete article
        .mockReturnValueOnce(mockDeleteEq({ error: null }));

      const result = await manageKnowledgeArticle("art-1", "delete", "user-1");

      expect(result.success).toBe(true);
      expect(result.data.actioned).toBe(true);
    });

    it("should reject invalid action", async () => {
      const result = await manageKnowledgeArticle("art-1", "invalid", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid action");
    });

    it("should reject missing articleId", async () => {
      const result = await manageKnowledgeArticle(null, "archive", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("articleId is required");
    });

    it("should fail when article is not found", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockSelectSingle({ data: null, error: { message: "not found" } }),
      );

      const result = await manageKnowledgeArticle(
        "nonexistent",
        "archive",
        "user-1",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Article not found");
    });
  });
});

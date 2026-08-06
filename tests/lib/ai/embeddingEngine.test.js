/**
 * Embedding Engine Tests — Unit tests for vector embedding operations.
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
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/providerRegistry.js", () => ({
  getActiveModelProvider: vi.fn().mockReturnValue({
    createEmbedding: vi.fn().mockResolvedValue({
      success: true,
      data: { data: [{ embedding: Array(1536).fill(0.1), index: 0 }], model: "text-embedding-3-small", usage: { total_tokens: 10 } },
    }),
  }),
}));

import {
  createEmbedding,
  batchCreateEmbeddings,
  searchEmbeddings,
  deleteEmbeddings,
  refreshEmbeddings,
} from "../../../lib/ai/embeddingEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logInfo, logError } from "../../../lib/verification/secureLogger.js";
import { getActiveModelProvider } from "../../../lib/ai/providerRegistry.js";

// ─── Tests ────────────────────────────────────────────────────────────

describe("Embedding Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEmbedding", () => {
    it("should debug chain mock behavior", async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "emb-1" }, error: null }),
          }),
        }),
      }));

      // Test the chain manually
      const fromResult = supabaseAdmin.from("test");
      const insertResult = fromResult.insert({});
      const selectResult = insertResult.select("id");
      const singleResult = await selectResult.single();
      expect(singleResult.data.id).toBe("emb-1");
    });

    it("should debug createEmbedding call chain", async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "emb-1" }, error: null }),
          }),
        }),
      }));

      const result = await createEmbedding({
        input: "Hello world",
        entityType: "campaign",
        entityId: "camp-1",
      });

      console.log("DEBUG result:", JSON.stringify(result));
      console.log("DEBUG from mock calls:", supabaseAdmin.from.mock.calls.length);
      console.log("DEBUG from mock last call:", supabaseAdmin.from.mock.lastCall);
      expect(result).toBeDefined();
    });

    it("should create and store a vector embedding", async () => {
      // Source chain: from().insert({...}).select("id").single()
      // Override the entire from to return a chain that resolves at .single()
      supabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "emb-1" }, error: null }),
          }),
        }),
      }));

      const result = await createEmbedding({
        input: "Hello world",
        entityType: "campaign",
        entityId: "camp-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("emb-1");
      expect(result.data.dimensions).toBe(1536);
      expect(logInfo).toHaveBeenCalled();
    });

    it("should fail without provider", async () => {
      getActiveModelProvider.mockReturnValueOnce(null);

      const result = await createEmbedding({
        input: "Hello world",
        entityType: "campaign",
        entityId: "camp-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject empty input", async () => {
      const result = await createEmbedding({
        input: "",
        entityType: "campaign",
        entityId: "camp-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Input text is required");
    });

    it("should reject missing entityType/entityId", async () => {
      const result = await createEmbedding({
        input: "Hello world",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("entityType and entityId are required");
    });
  });

  describe("batchCreateEmbeddings", () => {
    it("should process a batch of items and track results", async () => {
      const provider = getActiveModelProvider();
      provider.createEmbedding.mockResolvedValueOnce({
        success: true,
        data: {
          data: [
            { embedding: Array(1536).fill(0.1), index: 0 },
            { embedding: Array(1536).fill(0.2), index: 1 },
          ],
        },
        model: "text-embedding-3-small",
      });

      let callCount = 0;
      supabaseAdmin.from.mockImplementation(() => {
        callCount++;
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await batchCreateEmbeddings({
        items: [
          { input: "First item", entityType: "campaign", entityId: "c1" },
          { input: "Second item", entityType: "campaign", entityId: "c2" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(2);
      expect(result.data.failed).toBe(0);
    });

    it("should track DB insert failures without losing the batch", async () => {
      const provider = getActiveModelProvider();
      provider.createEmbedding.mockResolvedValueOnce({
        success: true,
        data: {
          data: [
            { embedding: Array(1536).fill(0.1), index: 0 },
            { embedding: Array(1536).fill(0.2), index: 1 },
          ],
        },
        model: "text-embedding-3-small",
      });

      let insertCall = 0;
      supabaseAdmin.from.mockImplementation(() => {
        insertCall++;
        if (insertCall === 1) {
          return { insert: vi.fn().mockResolvedValue({ error: { message: "DB error" } }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const result = await batchCreateEmbeddings({
        items: [
          { input: "First item", entityType: "campaign", entityId: "c1" },
          { input: "Second item", entityType: "campaign", entityId: "c2" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.created).toBe(1);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toHaveLength(1);
    });

    it("should reject empty items array", async () => {
      const result = await batchCreateEmbeddings({ items: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Items array is required");
    });
  });

  describe("searchEmbeddings", () => {
    it("should return vector search results with scores", async () => {
      supabaseAdmin.rpc.mockResolvedValueOnce({
        data: [
          { entity_id: "c1", entity_type: "campaign", similarity: 0.92, metadata: { inputPreview: "hello" } },
        ],
        error: null,
      });

      const result = await searchEmbeddings({ query: "hello world" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe("c1");
      expect(result.data[0].score).toBe(0.92);
    });

    it("should fall back to text search when vector search returns no results", async () => {
      supabaseAdmin.rpc.mockResolvedValueOnce({ data: [], error: null });

      // Text fallback chain: from().select().ilike().limit()
      supabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ entity_id: "c2", entity_type: "campaign", metadata: { inputPreview: "fallback" } }],
              error: null,
            }),
          }),
        }),
      }));

      const result = await searchEmbeddings({ query: "hello world" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].score).toBe(0.5);
    });

    it("should reject empty query", async () => {
      const result = await searchEmbeddings({ query: "" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Query string is required");
    });
  });

  describe("deleteEmbeddings", () => {
    it("should remove embeddings by entity type and id", async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 3 }),
          }),
        }),
      }));

      const result = await deleteEmbeddings({
        entityType: "campaign",
        entityId: "camp-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
      expect(result.data.count).toBe(3);
    });

    it("should reject missing parameters", async () => {
      const result = await deleteEmbeddings({ entityType: "campaign" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("entityType and entityId are required");
    });
  });

  describe("refreshEmbeddings", () => {
    it("should re-embed stale vectors and update them", async () => {
      let fromCall = 0;
      supabaseAdmin.from.mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) {
          // Fetch stale embeddings
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        { id: "emb-1", entity_type: "campaign", entity_id: "c1", content_hash: "abc", metadata: { inputPreview: "old text" } },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        // Update refreshed embedding
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      });

      const result = await refreshEmbeddings({
        entityType: "campaign",
        olderThan: "2020-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      expect(result.data.refreshed).toBe(1);
      expect(result.data.skipped).toBe(0);
    });

    it("should skip embeddings with no inputPreview", async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    { id: "emb-1", entity_type: "campaign", entity_id: "c1", content_hash: "abc", metadata: {} },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await refreshEmbeddings({
        entityType: "campaign",
        olderThan: "2020-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      expect(result.data.refreshed).toBe(0);
      expect(result.data.skipped).toBe(1);
    });

    it("should return zero counts when no stale embeddings exist", async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await refreshEmbeddings({
        entityType: "campaign",
        olderThan: "2020-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      expect(result.data.refreshed).toBe(0);
      expect(result.data.skipped).toBe(0);
    });
  });
});

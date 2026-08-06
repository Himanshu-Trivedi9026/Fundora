/**
 * Embedding Engine — Vector embedding operations for semantic search.
 *
 * Manages the full lifecycle of embeddings:
 *   - Creation (single and batch)
 *   - Semantic similarity search (vector + text fallback)
 *   - Deletion and refresh of stale embeddings
 *
 * Storage:
 *   - Embeddings stored in ai_embeddings table
 *   - Vectors are pgvector-compatible float arrays
 *   - Metadata stored as JSONB for flexible querying
 *
 * Security:
 *   - Never throws — all errors caught and returned as { success: false, error }
 *   - All operations logged via secureLogger
 *   - Uses supabaseAdmin for all DB operations
 *   - Provider API keys never exposed to callers
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { getActiveModelProvider } from "./providerRegistry.js";

// ─── Constants ───

const BATCH_SIZE = 20;
const DEFAULT_MATCH_COUNT = 10;
const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

// ─── Core Functions ───

/**
 * Create a vector embedding for a single piece of text.
 *
 * @param {Object}  params
 * @param {string}  params.input      — Text to embed
 * @param {string}  [params.model]    — Model override (defaults to active provider's model)
 * @param {string}  params.entityType — Entity type (e.g. 'campaign', 'knowledge_article')
 * @param {string}  params.entityId   — ID of the parent entity
 * @param {Object}  [params.metadata] — Additional metadata to store alongside the embedding
 * @returns {Promise<{success: boolean, data?: {id: string, dimensions: number}, error?: string}>}
 */
export async function createEmbedding({ input, model, entityType, entityId, metadata = {} }) {
  try {
    if (!input || typeof input !== "string") {
      return { success: false, data: null, error: "Input text is required and must be a string" };
    }

    if (!entityType || !entityId) {
      return { success: false, data: null, error: "entityType and entityId are required" };
    }

    // 1. Get active model provider
    const provider = getActiveModelProvider();

    // 2. Call provider.createEmbedding({ input, model })
    const embeddingResult = await provider.createEmbedding({
      input,
      model: model || DEFAULT_EMBEDDING_MODEL,
    });

    if (!embeddingResult.success) {
      logError("EmbeddingEngine", "Provider embedding failed", {
        entityType,
        entityId,
        error: embeddingResult.error,
      });
      return { success: false, data: null, error: `Embedding generation failed: ${embeddingResult.error}` };
    }

    const embeddingData = embeddingResult.data;
    const vector = embeddingData.data?.[0]?.embedding;

    if (!vector || !Array.isArray(vector)) {
      return { success: false, data: null, error: "Provider returned no valid embedding vector" };
    }

    const dimensions = vector.length;

    // 3. Store in ai_embeddings table
    const { data: stored, error: dbError } = await supabaseAdmin
      .from("ai_embeddings")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        embedding: JSON.stringify(vector),
        model: embeddingData.model || model || DEFAULT_EMBEDDING_MODEL,
        dimensions,
        content_hash: simpleHash(input),
        metadata: {
          ...metadata,
          inputPreview: input.substring(0, 200),
          tokenCount: embeddingData.usage?.total_tokens || 0,
        },
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      logError("EmbeddingEngine", "Failed to store embedding", {
        entityType,
        entityId,
        error: dbError.message,
      });
      return { success: false, data: null, error: `Failed to store embedding: ${dbError.message}` };
    }

    logInfo("EmbeddingEngine", "Embedding created", {
      id: stored.id,
      entityType,
      entityId,
      dimensions,
    });

    // 4. Return { success, data: { id, dimensions }, error }
    return { success: true, data: { id: stored.id, dimensions }, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "createEmbedding failed", {
      entityType,
      entityId,
      error: err.message,
    });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Create embeddings for a batch of items.
 *
 * @param {Object}   params
 * @param {Object[]} params.items — Array of { input, entityType, entityId, metadata }
 * @param {string}   [params.model] — Model override
 * @returns {Promise<{success: boolean, data?: {created: number, failed: number, errors: Array}, error?: string}>}
 */
export async function batchCreateEmbeddings({ items, model }) {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, data: null, error: "Items array is required and must not be empty" };
    }

    // Process in batches of BATCH_SIZE (20)
    const results = { created: 0, failed: 0, errors: [] };

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      // Collect all inputs in this batch for a single provider call
      const inputs = batch.map((item) => item.input || "");

      // Get active provider and call embedding API with batch inputs
      const provider = getActiveModelProvider();
      const embeddingResult = await provider.createEmbedding({
        input: inputs,
        model: model || DEFAULT_EMBEDDING_MODEL,
      });

      if (!embeddingResult.success) {
        // Mark entire batch as failed
        for (const item of batch) {
          results.failed++;
          results.errors.push({
            entityId: item.entityId,
            entityType: item.entityType,
            error: embeddingResult.error,
          });
        }
        logError("EmbeddingEngine", "Batch embedding provider call failed", {
          batchStart: i,
          error: embeddingResult.error,
        });
        continue;
      }

      const embeddingVectors = embeddingResult.data?.data || [];

      // Store each embedding individually so one DB failure doesn't lose the whole batch
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const vectorData = embeddingVectors.find((e) => e.index === j);

        if (!vectorData || !vectorData.embedding) {
          results.failed++;
          results.errors.push({
            entityId: item.entityId,
            entityType: item.entityType,
            error: "No embedding returned for this item",
          });
          continue;
        }

        const vector = vectorData.embedding;
        const dimensions = vector.length;

        const { error: dbError } = await supabaseAdmin
          .from("ai_embeddings")
          .insert({
            entity_type: item.entityType,
            entity_id: item.entityId,
            embedding: JSON.stringify(vector),
            model: model || DEFAULT_EMBEDDING_MODEL,
            dimensions,
            content_hash: simpleHash(item.input || ""),
            metadata: {
              ...item.metadata,
              inputPreview: (item.input || "").substring(0, 200),
              batchIndex: i + j,
            },
            created_at: new Date().toISOString(),
          });

        if (dbError) {
          results.failed++;
          results.errors.push({
            entityId: item.entityId,
            entityType: item.entityType,
            error: dbError.message,
          });
          logError("EmbeddingEngine", "Batch item store failed", {
            entityId: item.entityId,
            error: dbError.message,
          });
        } else {
          results.created++;
        }
      }
    }

    logInfo("EmbeddingEngine", "Batch embedding complete", {
      total: items.length,
      created: results.created,
      failed: results.failed,
    });

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "batchCreateEmbeddings failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Search for semantically similar embeddings using cosine similarity.
 * Falls back to text-based search if vector search is unavailable.
 *
 * @param {Object}  params
 * @param {string}  params.query       — Search query text
 * @param {string}  [params.entityType] — Filter by entity type
 * @param {number}  [params.matchCount=10] — Max results to return
 * @param {number}  [params.threshold=0.7] — Minimum similarity score (0–1)
 * @returns {Promise<{success: boolean, data?: Array<{entityId, entityType, score, content}>, error?: string}>}
 */
export async function searchEmbeddings({ query, entityType, matchCount = DEFAULT_MATCH_COUNT, threshold = DEFAULT_THRESHOLD }) {
  try {
    if (!query || typeof query !== "string") {
      return { success: false, data: null, error: "Query string is required" };
    }

    // 1. Create embedding for query
    const provider = getActiveModelProvider();
    const embeddingResult = await provider.createEmbedding({
      input: query,
      model: DEFAULT_EMBEDDING_MODEL,
    });

    if (!embeddingResult.success) {
      logWarn("EmbeddingEngine", "Query embedding failed, falling back to text search", {
        error: embeddingResult.error,
      });
      return await textFallbackSearch({ query, entityType, matchCount });
    }

    const queryVector = embeddingResult.data?.data?.[0]?.embedding;

    if (!queryVector || !Array.isArray(queryVector)) {
      return await textFallbackSearch({ query, entityType, matchCount });
    }

    // 2. Call Supabase RPC for cosine similarity search
    let rpcQuery = supabaseAdmin.rpc("search_embeddings", {
      query_embedding: JSON.stringify(queryVector),
      match_count: matchCount,
      match_threshold: threshold,
      filter_entity_type: entityType || null,
    });

    const { data: rpcData, error: rpcError } = await rpcQuery;

    if (rpcError || !rpcData || rpcData.length === 0) {
      // Fallback: text search on metadata or content_hash
      logInfo("EmbeddingEngine", "Vector search unavailable or empty, using text fallback", {
        rpcError: rpcError?.message,
      });
      return await textFallbackSearch({ query, entityType, matchCount });
    }

    // 3. Return results
    const results = rpcData.map((row) => ({
      entityId: row.entity_id,
      entityType: row.entity_type,
      score: row.similarity || row.score || 0,
      content: row.metadata?.inputPreview || "",
    }));

    logInfo("EmbeddingEngine", "Vector search completed", {
      queryLength: query.length,
      resultCount: results.length,
    });

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "searchEmbeddings failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Delete all embeddings for a specific entity.
 *
 * @param {Object} params
 * @param {string} params.entityType — Entity type to filter by
 * @param {string} params.entityId   — Entity ID to delete embeddings for
 * @returns {Promise<{success: boolean, data?: {deleted: boolean, count: number}, error?: string}>}
 */
export async function deleteEmbeddings({ entityType, entityId }) {
  try {
    if (!entityType || !entityId) {
      return { success: false, data: null, error: "entityType and entityId are required" };
    }

    const { data, error: dbError, count } = await supabaseAdmin
      .from("ai_embeddings")
      .delete({ count: "exact" })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (dbError) {
      logError("EmbeddingEngine", "Failed to delete embeddings", {
        entityType,
        entityId,
        error: dbError.message,
      });
      return { success: false, data: null, error: `Failed to delete embeddings: ${dbError.message}` };
    }

    const deletedCount = count ?? (data?.length || 0);

    logInfo("EmbeddingEngine", "Embeddings deleted", {
      entityType,
      entityId,
      count: deletedCount,
    });

    return { success: true, data: { deleted: true, count: deletedCount }, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "deleteEmbeddings failed", { entityType, entityId, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Refresh stale embeddings by re-embedding entities older than a given date.
 *
 * @param {Object}  params
 * @param {string}  params.entityType   — Entity type to filter by
 * @param {string}  [params.olderThan]  — ISO date string; re-embed if created before this date
 * @returns {Promise<{success: boolean, data?: {refreshed: number, skipped: number}, error?: string}>}
 */
export async function refreshEmbeddings({ entityType, olderThan }) {
  try {
    if (!entityType) {
      return { success: false, data: null, error: "entityType is required" };
    }

    // Default: refresh embeddings older than 30 days
    const cutoffDate = olderThan || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch stale embeddings
    const { data: staleEmbeddings, error: fetchError } = await supabaseAdmin
      .from("ai_embeddings")
      .select("id, entity_type, entity_id, content_hash, metadata")
      .eq("entity_type", entityType)
      .lt("created_at", cutoffDate)
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchError) {
      logError("EmbeddingEngine", "Failed to fetch stale embeddings", {
        entityType,
        error: fetchError.message,
      });
      return { success: false, data: null, error: `Failed to fetch stale embeddings: ${fetchError.message}` };
    }

    if (!staleEmbeddings || staleEmbeddings.length === 0) {
      return { success: true, data: { refreshed: 0, skipped: 0 }, error: null };
    }

    let refreshed = 0;
    let skipped = 0;
    const provider = getActiveModelProvider();

    for (const embedding of staleEmbeddings) {
      const inputText = embedding.metadata?.inputPreview;

      if (!inputText) {
        // Cannot re-embed without the original text preview
        skipped++;
        continue;
      }

      // Re-generate the embedding
      const embeddingResult = await provider.createEmbedding({
        input: inputText,
        model: embedding.metadata?.model || DEFAULT_EMBEDDING_MODEL,
      });

      if (!embeddingResult.success || !embeddingResult.data?.data?.[0]?.embedding) {
        skipped++;
        logError("EmbeddingEngine", "Re-embedding failed for entity", {
          entityId: embedding.entity_id,
          error: embeddingResult.error || "No embedding returned",
        });
        continue;
      }

      const newVector = embeddingResult.data.data[0].embedding;

      // Update the existing embedding record
      const { error: updateError } = await supabaseAdmin
        .from("ai_embeddings")
        .update({
          embedding: JSON.stringify(newVector),
          dimensions: newVector.length,
          content_hash: simpleHash(inputText),
          created_at: new Date().toISOString(),
        })
        .eq("id", embedding.id);

      if (updateError) {
        skipped++;
        logError("EmbeddingEngine", "Failed to update refreshed embedding", {
          id: embedding.id,
          error: updateError.message,
        });
      } else {
        refreshed++;
      }
    }

    logInfo("EmbeddingEngine", "Embedding refresh complete", {
      entityType,
      total: staleEmbeddings.length,
      refreshed,
      skipped,
    });

    return { success: true, data: { refreshed, skipped }, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "refreshEmbeddings failed", { entityType, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Internal Helpers ───

/**
 * Text-based fallback search when vector search is unavailable.
 * Uses ILIKE on metadata fields.
 *
 * @param {Object}  params
 * @param {string}  params.query
 * @param {string}  [params.entityType]
 * @param {number}  params.matchCount
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 * @private
 */
async function textFallbackSearch({ query, entityType, matchCount }) {
  try {
    let dbQuery = supabaseAdmin
      .from("ai_embeddings")
      .select("entity_id, entity_type, metadata, content_hash")
      .ilike("metadata->>inputPreview", `%${query}%`)
      .limit(matchCount);

    if (entityType) {
      dbQuery = dbQuery.eq("entity_type", entityType);
    }

    const { data, error: dbError } = await dbQuery;

    if (dbError) {
      logError("EmbeddingEngine", "Text fallback search failed", { error: dbError.message });
      return { success: false, data: null, error: `Text search failed: ${dbError.message}` };
    }

    const results = (data || []).map((row) => ({
      entityId: row.entity_id,
      entityType: row.entity_type,
      score: 0.5, // approximate relevance for text match
      content: row.metadata?.inputPreview || "",
    }));

    logInfo("EmbeddingEngine", "Text fallback search completed", { resultCount: results.length });

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("EmbeddingEngine", "textFallbackSearch failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Warn-level log helper (re-exports from secureLogger pattern).
 * @private
 */
function logWarn(module, message, context) {
  logError(module, `[WARN] ${message}`, context);
}

/**
 * Simple deterministic hash for content deduplication.
 * Used for change detection (not cryptographic).
 *
 * @param {string} text
 * @returns {string} Hex digest (first 16 chars)
 * @private
 */
function simpleHash(text) {
  let hash = 0;
  const str = text || "";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").substring(0, 16);
}

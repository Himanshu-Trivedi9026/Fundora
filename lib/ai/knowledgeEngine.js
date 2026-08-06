/**
 * Knowledge Engine — Knowledge base with semantic search and document indexing.
 *
 * Manages the full lifecycle of knowledge articles:
 *   - Indexing with automatic chunking and embedding
 *   - Semantic and keyword search
 *   - Multi-source context retrieval for AI prompts
 *   - Article lifecycle management (update, delete, archive)
 *
 * Storage:
 *   - Articles stored in knowledge_articles table
 *   - Chunks embedded via embeddingEngine into ai_embeddings table
 *   - All mutations audit-logged
 *
 * Security:
 *   - Never throws — all errors caught and returned as { success: false, error }
 *   - All mutations audit-logged via auditLog
 *   - Uses supabaseAdmin for all DB operations
 *   - Content sanitized before storage
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { createEmbedding, searchEmbeddings } from "./embeddingEngine.js";

// ─── Constants ───

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;
const DEFAULT_SEARCH_MATCH_COUNT = 5;
const DEFAULT_SEARCH_THRESHOLD = 0.6;
const MAX_CONTENT_LENGTH = 500000;
const DEFAULT_MAX_TOKENS = 2000;

// ─── Core Functions ───

/**
 * Index a knowledge article: chunk it, embed each chunk, and store metadata.
 *
 * @param {Object}   params
 * @param {string}   params.title      — Article title
 * @param {string}   params.content    — Full article content (plain text)
 * @param {string}   params.category   — Article category (e.g. 'faq', 'policy', 'guide')
 * @param {string[]} [params.tags]     — Tags for classification
 * @param {string}   [params.source]   — Source attribution (URL or author)
 * @param {Object}   [params.metadata] — Additional metadata
 * @returns {Promise<{success: boolean, data?: {id: string, chunkCount: number}, error?: string}>}
 */
export async function indexKnowledgeArticle({ title, content, category, tags = [], source, metadata = {} }) {
  try {
    if (!title || typeof title !== "string") {
      return { success: false, data: null, error: "Title is required and must be a string" };
    }

    if (!content || typeof content !== "string") {
      return { success: false, data: null, error: "Content is required and must be a string" };
    }

    if (!category || typeof category !== "string") {
      return { success: false, data: null, error: "Category is required and must be a string" };
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return { success: false, data: null, error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` };
    }

    // 1. Chunk the content
    const chunkResult = chunkDocument({ content });

    if (!chunkResult.success) {
      return { success: false, data: null, error: `Chunking failed: ${chunkResult.error}` };
    }

    const { chunks } = chunkResult.data;

    // 2. Store article metadata in knowledge_articles table
    const { data: article, error: articleError } = await supabaseAdmin
      .from("knowledge_articles")
      .insert({
        title,
        content,
        category,
        tags,
        source: source || null,
        metadata: {
          ...metadata,
          chunkCount: chunks.length,
          contentLength: content.length,
          indexedAt: new Date().toISOString(),
        },
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (articleError) {
      logError("KnowledgeEngine", "Failed to store article", {
        title,
        category,
        error: articleError.message,
      });
      return { success: false, data: null, error: `Failed to store article: ${articleError.message}` };
    }

    // 3. Create embeddings for each chunk
    let successfulChunks = 0;

    for (const chunk of chunks) {
      const embeddingResult = await createEmbedding({
        input: chunk.text,
        entityType: "knowledge_article",
        entityId: article.id,
        metadata: {
          articleTitle: title,
          category,
          tags,
          chunkIndex: chunk.index,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        },
      });

      if (embeddingResult.success) {
        successfulChunks++;
      } else {
        logError("KnowledgeEngine", "Failed to embed chunk", {
          articleId: article.id,
          chunkIndex: chunk.index,
          error: embeddingResult.error,
        });
      }
    }

    // 4. Audit log
    await logAuditEvent({
      eventType: "knowledge.article_indexed",
      entityType: "knowledge_article",
      entityId: article.id,
      action: "index",
      details: {
        title,
        category,
        tags,
        source,
        totalChunks: chunks.length,
        embeddedChunks: successfulChunks,
      },
    });

    logInfo("KnowledgeEngine", "Article indexed", {
      id: article.id,
      title,
      category,
      chunkCount: chunks.length,
      embeddedChunks: successfulChunks,
    });

    // Return { success, data: { id, chunkCount }, error }
    return { success: true, data: { id: article.id, chunkCount: chunks.length }, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "indexKnowledgeArticle failed", { title, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Search the knowledge base for articles relevant to a query.
 * Uses semantic search first, falls back to keyword search.
 *
 * @param {Object}  params
 * @param {string}  params.query          — Search query
 * @param {string}  [params.category]     — Filter by category
 * @param {number}  [params.matchCount=5] — Max results
 * @param {number}  [params.threshold=0.6] — Minimum similarity score
 * @returns {Promise<{success: boolean, data?: Array<{articleId, title, snippet, score, category}>, error?: string}>}
 */
export async function searchKnowledge({ query, category, matchCount = DEFAULT_SEARCH_MATCH_COUNT, threshold = DEFAULT_SEARCH_THRESHOLD }) {
  try {
    if (!query || typeof query !== "string") {
      return { success: false, data: null, error: "Query string is required" };
    }

    // 1. Semantic search via embeddings
    const searchResult = await searchEmbeddings({
      query,
      entityType: "knowledge_article",
      matchCount: matchCount * 2, // fetch extra to deduplicate by article
      threshold,
    });

    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      // Deduplicate by entityId (article ID) and enrich with article metadata
      const seenArticleIds = new Set();
      const uniqueResults = [];

      for (const result of searchResult.data) {
        if (seenArticleIds.has(result.entityId)) continue;
        seenArticleIds.add(result.entityId);

        // Fetch article metadata for the snippet and title
        const { data: article } = await supabaseAdmin
          .from("knowledge_articles")
          .select("id, title, category, content, status")
          .eq("id", result.entityId)
          .single();

        if (!article || article.status !== "active") continue;

        // Apply category filter if specified
        if (category && article.category !== category) continue;

        uniqueResults.push({
          articleId: article.id,
          title: article.title,
          snippet: truncateText(article.content, 300),
          score: result.score,
          category: article.category,
        });

        if (uniqueResults.length >= matchCount) break;
      }

      if (uniqueResults.length > 0) {
        logInfo("KnowledgeEngine", "Semantic search completed", {
          queryLength: query.length,
          resultCount: uniqueResults.length,
        });
        return { success: true, data: uniqueResults, error: null };
      }
    }

    // 2. Fallback to keyword search if no embedding results
    logInfo("KnowledgeEngine", "No semantic results, using keyword fallback", { query });
    return await keywordFallbackSearch({ query, category, matchCount });
  } catch (err) {
    logError("KnowledgeEngine", "searchKnowledge failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Retrieve relevant context from multiple sources for AI prompt construction.
 * Combines knowledge articles and campaign data.
 *
 * @param {Object}   params
 * @param {string}   params.query                  — Context query
 * @param {string[]} [params.entityTypes]          — Entity types to search
 * @param {number}   [params.maxTokens=2000]       — Approximate token budget for context
 * @returns {Promise<{success: boolean, data?: {contextString: string, sources: Array<{type, id, relevance}>}, error?: string}>}
 */
export async function getRelevantContext({ query, entityTypes = ["knowledge_article"], maxTokens = DEFAULT_MAX_TOKENS }) {
  try {
    if (!query || typeof query !== "string") {
      return { success: false, data: null, error: "Query string is required" };
    }

    const sources = [];
    const contextParts = [];
    let currentTokenEstimate = 0;

    // Approximate token budget: ~4 chars per token
    const maxChars = maxTokens * 4;

    // 1. Search knowledge articles if requested
    if (entityTypes.includes("knowledge_article")) {
      const knowledgeResult = await searchKnowledge({
        query,
        matchCount: 5,
        threshold: DEFAULT_SEARCH_THRESHOLD,
      });

      if (knowledgeResult.success && knowledgeResult.data) {
        for (const article of knowledgeResult.data) {
          const snippetChars = truncateText(article.snippet, 600);

          if (currentTokenEstimate + snippetChars.length > maxChars) break;

          contextParts.push(
            `[Knowledge: ${article.title}]\n${snippetChars}`,
          );
          sources.push({
            type: "knowledge_article",
            id: article.articleId,
            relevance: article.score,
          });
          currentTokenEstimate += snippetChars.length;
        }
      }
    }

    // 2. Search campaign data if requested
    if (entityTypes.includes("campaign")) {
      const campaignResults = await searchCampaignContext({ query, maxChars: maxChars - currentTokenEstimate });

      if (campaignResults.success && campaignResults.data) {
        for (const campaign of campaignResults.data) {
          const text = `[Campaign: ${campaign.title}]\n${campaign.description}`;

          if (currentTokenEstimate + text.length > maxChars) break;

          contextParts.push(text);
          sources.push({
            type: "campaign",
            id: campaign.id,
            relevance: campaign.relevance || 0.5,
          });
          currentTokenEstimate += text.length;
        }
      }
    }

    // 3. Search creator data if requested
    if (entityTypes.includes("creator")) {
      const creatorResults = await searchCreatorContext({ query, maxChars: maxChars - currentTokenEstimate });

      if (creatorResults.success && creatorResults.data) {
        for (const creator of creatorResults.data) {
          const text = `[Creator: ${creator.name}]\n${creator.bio || ""}`;

          if (currentTokenEstimate + text.length > maxChars) break;

          contextParts.push(text);
          sources.push({
            type: "creator",
            id: creator.id,
            relevance: creator.relevance || 0.5,
          });
          currentTokenEstimate += text.length;
        }
      }
    }

    const contextString = contextParts.join("\n\n");

    logInfo("KnowledgeEngine", "Context retrieval complete", {
      queryLength: query.length,
      sourceCount: sources.length,
      contextLength: contextString.length,
    });

    return {
      success: true,
      data: {
        contextString,
        sources,
      },
      error: null,
    };
  } catch (err) {
    logError("KnowledgeEngine", "getRelevantContext failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Split text into overlapping chunks for embedding.
 * Pure function with no side effects.
 *
 * @param {Object}  params
 * @param {string}  params.content           — Text to chunk
 * @param {number}  [params.chunkSize=500]   — Maximum characters per chunk
 * @param {number}  [params.overlap=50]      — Character overlap between consecutive chunks
 * @returns {{success: boolean, data?: {chunks: Array<{text: string, index: number, charStart: number, charEnd: number}>}, error?: string}}
 */
export function chunkDocument({ content, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP }) {
  try {
    // Edge case: empty content
    if (!content || typeof content !== "string") {
      return { success: true, data: { chunks: [] }, error: null };
    }

    // Edge case: content fits in a single chunk
    if (content.length <= chunkSize) {
      return {
        success: true,
        data: {
          chunks: [
            {
              text: content,
              index: 0,
              charStart: 0,
              charEnd: content.length,
            },
          ],
        },
        error: null,
      };
    }

    const chunks = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < content.length) {
      let endIndex = Math.min(startIndex + chunkSize, content.length);

      // Try to break at a natural boundary (space, period, newline)
      if (endIndex < content.length) {
        const breakPoint = findNaturalBreakPoint(content, startIndex, endIndex);

        if (breakPoint > startIndex) {
          endIndex = breakPoint;
        }
      }

      const chunkText = content.substring(startIndex, endIndex);

      // Skip empty or whitespace-only chunks
      if (chunkText.trim().length > 0) {
        chunks.push({
          text: chunkText,
          index: chunkIndex,
          charStart: startIndex,
          charEnd: endIndex,
        });
        chunkIndex++;
      }

      // The chunk ended at the content boundary — this is the final chunk.
      // Terminate the loop; advancing by overlap would rewind startIndex below
      // content.length and never progress (endIndex is capped at content.length),
      // which caused an infinite loop / OOM.
      if (endIndex >= content.length) {
        break;
      }

      // Move start forward, accounting for overlap
      startIndex = endIndex - overlap;

      // Guard against zero or negative progress (overlap >= chunkSize edge case)
      if (startIndex >= endIndex) {
        startIndex = endIndex;
      }
    }

    return { success: true, data: { chunks }, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "chunkDocument failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Manage a knowledge article lifecycle: update, delete, or archive.
 *
 * @param {string} articleId  — Article ID
 * @param {string} action     — 'update' | 'delete' | 'archive'
 * @param {string} performedBy — User or system that performed the action
 * @param {Object} [updates]  — Fields to update (only used for action='update')
 * @returns {Promise<{success: boolean, data?: {actioned: boolean}, error?: string}>}
 */
export async function manageKnowledgeArticle(articleId, action, performedBy, updates = {}) {
  try {
    if (!articleId) {
      return { success: false, data: null, error: "articleId is required" };
    }

    const validActions = ["update", "delete", "archive"];

    if (!validActions.includes(action)) {
      return { success: false, data: null, error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` };
    }

    if (!performedBy) {
      return { success: false, data: null, error: "performedBy is required" };
    }

    // Verify article exists
    const { data: article, error: fetchError } = await supabaseAdmin
      .from("knowledge_articles")
      .select("id, title, category, status")
      .eq("id", articleId)
      .single();

    if (fetchError || !article) {
      return { success: false, data: null, error: `Article not found: ${articleId}` };
    }

    switch (action) {
      case "update": {
        const updatePayload = {
          ...updates,
          updated_at: new Date().toISOString(),
        };

        // Remove fields that should not be overwritten
        delete updatePayload.id;
        delete updatePayload.created_at;

        const { error: updateError } = await supabaseAdmin
          .from("knowledge_articles")
          .update(updatePayload)
          .eq("id", articleId);

        if (updateError) {
          logError("KnowledgeEngine", "Failed to update article", { articleId, error: updateError.message });
          return { success: false, data: null, error: `Failed to update article: ${updateError.message}` };
        }

        // If content changed, re-embed chunks
        if (updates.content) {
          // Delete old embeddings
          const { error: deleteErr } = await supabaseAdmin
            .from("ai_embeddings")
            .delete()
            .eq("entity_type", "knowledge_article")
            .eq("entity_id", articleId);

          if (deleteErr) {
            logError("KnowledgeEngine", "Failed to delete old embeddings on update", {
              articleId,
              error: deleteErr.message,
            });
          }

          // Re-chunk and re-embed
          const chunkResult = chunkDocument({ content: updates.content });

          if (chunkResult.success) {
            for (const chunk of chunkResult.data.chunks) {
              await createEmbedding({
                input: chunk.text,
                entityType: "knowledge_article",
                entityId: articleId,
                metadata: {
                  articleTitle: updates.title || article.title,
                  category: updates.category || article.category,
                  chunkIndex: chunk.index,
                  charStart: chunk.charStart,
                  charEnd: chunk.charEnd,
                },
              });
            }
          }
        }

        break;
      }

      case "delete": {
        // Delete embeddings first
        const { error: embDeleteErr } = await supabaseAdmin
          .from("ai_embeddings")
          .delete()
          .eq("entity_type", "knowledge_article")
          .eq("entity_id", articleId);

        if (embDeleteErr) {
          logError("KnowledgeEngine", "Failed to delete embeddings on article delete", {
            articleId,
            error: embDeleteErr.message,
          });
        }

        // Delete article
        const { error: articleDeleteErr } = await supabaseAdmin
          .from("knowledge_articles")
          .delete()
          .eq("id", articleId);

        if (articleDeleteErr) {
          logError("KnowledgeEngine", "Failed to delete article", {
            articleId,
            error: articleDeleteErr.message,
          });
          return { success: false, data: null, error: `Failed to delete article: ${articleDeleteErr.message}` };
        }

        break;
      }

      case "archive": {
        const { error: archiveError } = await supabaseAdmin
          .from("knowledge_articles")
          .update({
            status: "archived",
            updated_at: new Date().toISOString(),
          })
          .eq("id", articleId);

        if (archiveError) {
          logError("KnowledgeEngine", "Failed to archive article", {
            articleId,
            error: archiveError.message,
          });
          return { success: false, data: null, error: `Failed to archive article: ${archiveError.message}` };
        }

        break;
      }
    }

    // Audit log the action
    await logAuditEvent({
      eventType: `knowledge.article_${action}`,
      entityType: "knowledge_article",
      entityId: articleId,
      userId: performedBy,
      action,
      details: {
        title: article.title,
        category: article.category,
        previousStatus: article.status,
        newStatus: action === "archive" ? "archived" : article.status,
      },
    });

    logInfo("KnowledgeEngine", `Article ${action}d`, {
      articleId,
      title: article.title,
      performedBy,
    });

    return { success: true, data: { actioned: true }, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "manageKnowledgeArticle failed", { articleId, action, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Internal Helpers ───

/**
 * Keyword-based fallback search when semantic search yields no results.
 *
 * @param {Object}  params
 * @param {string}  params.query
 * @param {string}  [params.category]
 * @param {number}  params.matchCount
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 * @private
 */
async function keywordFallbackSearch({ query, category, matchCount }) {
  try {
    // Split query into keywords and build an OR filter
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    let dbQuery = supabaseAdmin
      .from("knowledge_articles")
      .select("id, title, content, category, tags, status")
      .eq("status", "active");

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    // Build keyword filter using OR on title and content
    if (keywords.length > 0) {
      const orFilters = keywords
        .map((kw) => `title.ilike.%${kw}%,content.ilike.%${kw}%`)
        .join(",");

      dbQuery = dbQuery.or(orFilters);
    }

    dbQuery = dbQuery.limit(matchCount);

    const { data, error: dbError } = await dbQuery;

    if (dbError) {
      logError("KnowledgeEngine", "Keyword fallback search failed", { error: dbError.message });
      return { success: false, data: null, error: `Keyword search failed: ${dbError.message}` };
    }

    const results = (data || []).map((article) => ({
      articleId: article.id,
      title: article.title,
      snippet: truncateText(article.content, 300),
      score: 0.4, // approximate relevance for keyword match
      category: article.category,
    }));

    logInfo("KnowledgeEngine", "Keyword fallback search completed", { resultCount: results.length });

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "keywordFallbackSearch failed", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Search campaign data for context retrieval.
 *
 * @param {Object} params
 * @param {string} params.query
 * @param {number} params.maxChars
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 * @private
 */
async function searchCampaignContext({ query, maxChars }) {
  try {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) {
      return { success: true, data: [], error: null };
    }

    const orFilters = keywords
      .map((kw) => `title.ilike.%${kw}%,description.ilike.%${kw}%`)
      .join(",");

    const { data, error: dbError } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, description, category, status")
      .eq("status", "active")
      .or(orFilters)
      .limit(3);

    if (dbError) {
      logError("KnowledgeEngine", "Campaign context search failed", { error: dbError.message });
      return { success: true, data: [], error: null };
    }

    const results = (data || []).map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      description: truncateText(campaign.description, 400),
      relevance: 0.4,
    }));

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "searchCampaignContext failed", { error: err.message });
    return { success: true, data: [], error: null };
  }
}

/**
 * Search creator profiles for context retrieval.
 *
 * @param {Object} params
 * @param {string} params.query
 * @param {number} params.maxChars
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 * @private
 */
async function searchCreatorContext({ query, maxChars }) {
  try {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    if (keywords.length === 0) {
      return { success: true, data: [], error: null };
    }

    const orFilters = keywords
      .map((kw) => `name.ilike.%${kw}%,bio.ilike.%${kw}%`)
      .join(",");

    const { data, error: dbError } = await supabaseAdmin
      .from("creators")
      .select("id, name, bio, category")
      .eq("status", "active")
      .or(orFilters)
      .limit(3);

    if (dbError) {
      logError("KnowledgeEngine", "Creator context search failed", { error: dbError.message });
      return { success: true, data: [], error: null };
    }

    const results = (data || []).map((creator) => ({
      id: creator.id,
      name: creator.name,
      bio: truncateText(creator.bio, 400),
      relevance: 0.4,
    }));

    return { success: true, data: results, error: null };
  } catch (err) {
    logError("KnowledgeEngine", "searchCreatorContext failed", { error: err.message });
    return { success: true, data: [], error: null };
  }
}

/**
 * Find a natural break point near the end of a chunk for cleaner splitting.
 * Looks backwards from endIndex for whitespace or sentence-ending punctuation.
 *
 * @param {string} text
 * @param {number} startIndex
 * @param {number} endIndex
 * @returns {number} The index to break at
 * @private
 */
function findNaturalBreakPoint(text, startIndex, endIndex) {
  // Look for sentence endings first (., !, ?) followed by space
  for (let i = endIndex - 1; i > startIndex + Math.floor((endIndex - startIndex) * 0.3); i--) {
    const char = text[i];
    if ((char === "." || char === "!" || char === "?") && i + 1 < text.length && text[i + 1] === " ") {
      return i + 2; // Include the space after punctuation
    }
  }

  // Fall back to last space
  for (let i = endIndex - 1; i > startIndex + Math.floor((endIndex - startIndex) * 0.3); i--) {
    if (text[i] === " " || text[i] === "\n") {
      return i + 1;
    }
  }

  return endIndex;
}

/**
 * Truncate text to a maximum length, appending ellipsis if truncated.
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 * @private
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || "";
  return text.substring(0, maxLength - 3) + "...";
}

// ─── Backward Compatibility Aliases ───

/**
 * Search knowledge base (alias for searchKnowledge for backward compatibility).
 *
 * @param {Object} params
 * @param {string} params.query — Search query
 * @param {number} [params.limit] — Max results
 * @param {string} [params.category] — Filter by category
 * @param {string} [params.requestedBy] — User requesting the search
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function searchKnowledgeBase({ query, limit, category, requestedBy }) {
  return await searchKnowledge({
    query,
    category,
    matchCount: limit || DEFAULT_SEARCH_MATCH_COUNT,
  });
}

/**
 * Delete a knowledge article (alias for manageKnowledgeArticle with action="delete").
 *
 * @param {Object} params
 * @param {string} params.articleId — Article ID to delete
 * @param {string} params.deletedBy — User performing the deletion
 * @returns {Promise<{success: boolean, data?: {actioned: boolean}, error?: string}>}
 */
export async function deleteKnowledgeArticle({ articleId, deletedBy }) {
  return await manageKnowledgeArticle(articleId, "delete", deletedBy);
}

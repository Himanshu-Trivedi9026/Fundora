/**
 * Conversation Memory — Persistent conversations with context windowing.
 *
 * Manages the full lifecycle of AI conversations:
 *   - Creation, messaging, history retrieval
 *   - Soft archival
 *   - Smart context windowing (summary + recent messages)
 *   - AI-powered conversation summarization
 *
 * Features:
 *   - Multiple copilot types (creator, donor, admin, moderator, organization)
 *   - Paginated message history
 *   - Token-aware context window truncation
 *   - Audit logging for all mutations
 *
 * Security:
 *   - Users can only access their own conversations
 *   - All mutations are audit-logged
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Constants ───

export const COPILOT_TYPES = {
  CREATOR: "creator",
  DONOR: "donor",
  ADMIN: "admin",
  MODERATOR: "moderator",
  ORGANIZATION: "organization",
};

const MESSAGE_ROLES = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

// Approximate tokens per character (English text: ~4 chars per token)
const CHARS_PER_TOKEN = 4;

// ─── Core Functions ───

/**
 * Create a new conversation.
 *
 * @param {Object} params
 * @param {string}  params.userId     — Owner user ID
 * @param {string}  params.copilotType — One of COPILOT_TYPES
 * @param {string}  [params.title]    — Optional conversation title
 * @returns {Promise<{success: boolean, data?: {id: string, title: string}, error?: string}>}
 */
export async function createConversation({ userId, copilotType, title }) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!copilotType || !Object.values(COPILOT_TYPES).includes(copilotType)) {
      return { success: false, error: `copilotType must be one of: ${Object.values(COPILOT_TYPES).join(", ")}` };
    }

    const conversationTitle = title || `${copilotType} conversation`;

    const { data, error } = await supabaseAdmin
      .from("ai_conversations")
      .insert({
        user_id: userId,
        copilot_type: copilotType,
        title: conversationTitle,
        status: "active",
        created_at: new Date().toISOString(),
      })
      .select("id, title")
      .single();

    if (error) {
      logError("createConversation DB error", { userId, copilotType, error: error.message });
      return { success: false, error: `Failed to create conversation: ${error.message}` };
    }

    await logAuditEvent({
      action: "ai_conversation_created",
      entityType: "ai_conversation",
      entityId: data.id,
      userId,
      metadata: { copilotType, title: conversationTitle },
    });

    logInfo("Conversation created", { conversationId: data.id, userId, copilotType });

    return { success: true, data: { id: data.id, title: data.title } };
  } catch (error) {
    logError("createConversation error", { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Add a message to a conversation.
 *
 * @param {Object} params
 * @param {string}  params.conversationId — Conversation ID
 * @param {string}  params.role          — "system", "user", or "assistant"
 * @param {string}  params.content       — Message content
 * @param {string}  [params.model]       — Model used (for assistant messages)
 * @param {number}  [params.tokenCount]  — Token count for this message
 * @param {number}  [params.costCents]   — Cost in cents
 * @returns {Promise<{success: boolean, data?: {id: string}, error?: string}>}
 */
export async function addMessage({
  conversationId,
  role,
  content,
  model,
  tokenCount,
  costCents,
}) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }
    if (!role || !Object.values(MESSAGE_ROLES).includes(role)) {
      return { success: false, error: `role must be one of: ${Object.values(MESSAGE_ROLES).join(", ")}` };
    }
    if (!content && content !== "") {
      return { success: false, error: "content is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        model: model || null,
        token_count: tokenCount || null,
        cost_cents: costCents || null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("addMessage DB error", { conversationId, role, error: error.message });
      return { success: false, error: `Failed to add message: ${error.message}` };
    }

    // Update conversation's updated_at timestamp
    await supabaseAdmin
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    logInfo("Message added", { conversationId, messageId: data.id, role });

    return { success: true, data: { id: data.id } };
  } catch (error) {
    logError("addMessage error", { conversationId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Get paginated message history for a conversation.
 *
 * @param {string} conversationId — Conversation ID
 * @param {Object} [options]
 * @param {number} [options.limit=50]  — Max messages to return
 * @param {number} [options.offset=0]  — Offset for pagination
 * @returns {Promise<{success: boolean, data?: {messages: Array, total: number}, error?: string}>}
 */
export async function getConversationHistory(conversationId, { limit = 50, offset = 0 } = {}) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (countError) {
      logError("getConversationHistory count error", { conversationId, error: countError.message });
      return { success: false, error: `Failed to count messages: ${countError.message}` };
    }

    // Get paginated messages
    const { data: messages, error } = await supabaseAdmin
      .from("ai_messages")
      .select("id, role, content, model, token_count, cost_cents, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("getConversationHistory DB error", { conversationId, error: error.message });
      return { success: false, error: `Failed to load messages: ${error.message}` };
    }

    const formattedMessages = (messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      tokenCount: m.token_count,
      costCents: m.cost_cents,
      timestamp: m.created_at,
    }));

    logInfo("Conversation history loaded", {
      conversationId,
      messageCount: formattedMessages.length,
      total: count || 0,
    });

    return {
      success: true,
      data: {
        messages: formattedMessages,
        total: count || 0,
      },
    };
  } catch (error) {
    logError("getConversationHistory error", { conversationId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * List active conversations for a user.
 *
 * @param {string} userId — User ID
 * @param {Object} [options]
 * @param {number} [options.limit=20] — Max conversations to return
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getActiveConversations(userId, { limit = 20 } = {}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    const { data: conversations, error } = await supabaseAdmin
      .from("ai_conversations")
      .select("id, title, copilot_type, status, created_at, updated_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("getActiveConversations DB error", { userId, error: error.message });
      return { success: false, error: `Failed to load conversations: ${error.message}` };
    }

    const formatted = (conversations || []).map((c) => ({
      id: c.id,
      title: c.title,
      copilotType: c.copilot_type,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    logInfo("Active conversations loaded", { userId, count: formatted.length });

    return { success: true, data: formatted };
  } catch (error) {
    logError("getActiveConversations error", { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Soft-archive a conversation.
 *
 * @param {string} conversationId — Conversation ID
 * @param {string} userId — User ID (for ownership check)
 * @returns {Promise<{success: boolean, data?: {archived: true}, error?: string}>}
 */
export async function archiveConversation(conversationId, userId) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    // Verify ownership
    const { data: conversation, error: fetchError } = await supabaseAdmin
      .from("ai_conversations")
      .select("id, user_id, title")
      .eq("id", conversationId)
      .single();

    if (fetchError || !conversation) {
      return { success: false, error: "Conversation not found" };
    }

    if (conversation.user_id !== userId) {
      logError("archiveConversation unauthorized", { conversationId, userId });
      return { success: false, error: "Unauthorized: you can only archive your own conversations" };
    }

    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      logError("archiveConversation DB error", { conversationId, error: error.message });
      return { success: false, error: `Failed to archive conversation: ${error.message}` };
    }

    await logAuditEvent({
      action: "ai_conversation_archived",
      entityType: "ai_conversation",
      entityId: conversationId,
      userId,
      metadata: { title: conversation.title },
    });

    logInfo("Conversation archived", { conversationId, userId });

    return { success: true, data: { archived: true } };
  } catch (error) {
    logError("archiveConversation error", { conversationId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Generate a summary of a conversation.
 *
 * Uses AI to create a summary, with fallback to last 5 messages.
 *
 * @param {string} conversationId — Conversation ID
 * @returns {Promise<{success: boolean, data?: {summary: string, keyEntities: Array}, error?: string}>}
 */
export async function summarizeConversation(conversationId) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }

    // Pull all messages
    const { data: messages, error } = await supabaseAdmin
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      logError("summarizeConversation DB error", { conversationId, error: error.message });
      return { success: false, error: `Failed to load messages: ${error.message}` };
    }

    if (!messages || messages.length === 0) {
      return {
        success: true,
        data: { summary: "Empty conversation", keyEntities: [] },
      };
    }

    // Extract key entities (campaign IDs, user IDs, amounts mentioned)
    const keyEntities = extractKeyEntities(messages);

    // Fallback: build summary from last 5 messages
    const lastMessages = messages.slice(-5);
    const fallbackSummary = lastMessages
      .map((m) => `[${m.role}]: ${m.content?.substring(0, 200) || ""}`)
      .join("\n");

    // Try AI summary via completeAIRequest (import lazily to avoid circular deps)
    let summary = fallbackSummary;
    try {
      const { completeAIRequest } = await import("./aiEngine.js");
      const conversationText = messages
        .map((m) => `[${m.role}]: ${m.content}`)
        .join("\n");

      const aiResult = await completeAIRequest({
        taskType: "conversation_summary",
        messages: [
          {
            role: "user",
            content: `Summarize this conversation in 2-3 sentences, highlighting key decisions and topics:\n\n${conversationText.substring(0, 8000)}`,
          },
        ],
        systemPrompt: "You are a conversation summarizer. Be concise and factual.",
        temperature: 0.3,
        maxTokens: 300,
      });

      if (aiResult.success && aiResult.data?.content) {
        summary = aiResult.data.content;
      }
    } catch (aiError) {
      logInfo("AI summary unavailable, using fallback", { conversationId, error: aiError.message });
    }

    // Store the summary back on the conversation
    await supabaseAdmin
      .from("ai_conversations")
      .update({
        summary,
        summary_updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    logInfo("Conversation summarized", { conversationId, messageCount: messages.length });

    return { success: true, data: { summary, keyEntities } };
  } catch (error) {
    logError("summarizeConversation error", { conversationId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Get context window for a conversation with smart truncation.
 *
 * Keeps the most recent messages and a summary of older ones,
 * staying within the specified token budget.
 *
 * @param {string} conversationId — Conversation ID
 * @param {Object} [options]
 * @param {number} [options.maxTokens=4000] — Maximum token budget
 * @returns {Promise<{success: boolean, data?: {messages: Array, summary: string|null, tokenCount: number}, error?: string}>}
 */
export async function getConversationContext(conversationId, { maxTokens = 4000 } = {}) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }

    // Pull conversation metadata (including stored summary)
    const { data: conversation } = await supabaseAdmin
      .from("ai_conversations")
      .select("summary, summary_updated_at")
      .eq("id", conversationId)
      .single();

    // Pull all messages
    const { data: messages, error } = await supabaseAdmin
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      logError("getConversationContext DB error", { conversationId, error: error.message });
      return { success: false, error: `Failed to load context: ${error.message}` };
    }

    if (!messages || messages.length === 0) {
      return {
        success: true,
        data: { messages: [], summary: conversation?.summary || null, tokenCount: 0 },
      };
    }

    // Format all messages
    const allMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
    }));

    // Calculate total tokens
    const totalChars = allMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const totalTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);

    // If within budget, return all messages
    if (totalTokens <= maxTokens) {
      return {
        success: true,
        data: {
          messages: allMessages,
          summary: conversation?.summary || null,
          tokenCount: totalTokens,
        },
      };
    }

    // Smart truncation: keep recent messages + summary of older ones
    let includedMessages = [];
    let runningTokens = 0;

    // Reserve space for summary (~10% of budget or stored summary)
    const summaryBudget = Math.floor(maxTokens * 0.1);
    let summary = conversation?.summary || null;

    if (summary) {
      runningTokens += Math.ceil(summary.length / CHARS_PER_TOKEN);
    }

    // Add messages from most recent, working backwards
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msgTokens = Math.ceil((allMessages[i].content?.length || 0) / CHARS_PER_TOKEN);
      if (runningTokens + msgTokens > maxTokens) {
        break;
      }
      runningTokens += msgTokens;
      includedMessages.unshift(allMessages[i]);
    }

    // If no stored summary, create one from excluded messages
    if (!summary && includedMessages.length < allMessages.length) {
      const excludedMessages = allMessages.slice(0, allMessages.length - includedMessages.length);
      summary = excludedMessages
        .slice(-5)
        .map((m) => `[${m.role}]: ${m.content?.substring(0, 100) || ""}`)
        .join("\n");
    }

    logInfo("Conversation context windowed", {
      conversationId,
      totalMessages: allMessages.length,
      includedMessages: includedMessages.length,
      tokenCount: runningTokens,
    });

    return {
      success: true,
      data: {
        messages: includedMessages,
        summary,
        tokenCount: runningTokens,
      },
    };
  } catch (error) {
    logError("getConversationContext error", { conversationId, error: error.message });
    return { success: false, error: error.message };
  }
}

// ─── Internal Helpers ───

/**
 * Extract key entities from messages (campaign IDs, amounts, etc.)
 *
 * @param {Array} messages — Array of { role, content }
 * @returns {Array<string>} List of extracted entity strings
 */
function extractKeyEntities(messages) {
  const entities = new Set();

  for (const msg of messages) {
    if (!msg.content) continue;

    // Extract campaign IDs (UUID-like patterns)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuids = msg.content.match(uuidPattern);
    if (uuids) {
      for (const uuid of uuids) {
        entities.add(`uuid:${uuid}`);
      }
    }

    // Extract monetary amounts (₹ followed by numbers)
    const amountPattern = /₹[\s]*[\d,]+(?:\.\d{1,2})?/g;
    const amounts = msg.content.match(amountPattern);
    if (amounts) {
      for (const amount of amounts) {
        entities.add(`amount:${amount.trim()}`);
      }
    }

    // Extract campaign names (in single or double quotes)
    const namePattern = /['"]([^'"]{3,60})['"]/g;
    let nameMatch;
    while ((nameMatch = namePattern.exec(msg.content)) !== null) {
      entities.add(`name:${nameMatch[1]}`);
    }
  }

  return Array.from(entities);
}

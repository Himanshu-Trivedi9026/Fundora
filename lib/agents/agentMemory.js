// Agent Memory — persistent memory management for AI agents
// Supports conversations, facts, preferences, context, knowledge, state

import { supabaseAdmin } from "../supabaseAdmin.js";

const MEMORY_TTL = {
  conversation: 3600,  // 1 hour
  fact: 86400 * 7,     // 7 days
  preference: 86400 * 30, // 30 days
  context: 300,        // 5 minutes
  knowledge: 86400 * 90, // 90 days
  state: 86400,        // 24 hours
};

export async function storeMemory(agentId, memoryType, key, value, options = {}) {
  try {
    const ttl = options.ttl || MEMORY_TTL[memoryType] || 3600;
    const expiresAt = options.persistent ? null : new Date(Date.now() + ttl * 1000).toISOString();

    const { data, error } = await supabaseAdmin.from("agent_memory").upsert(
      {
        agent_id: agentId,
        memory_type: memoryType,
        key,
        value,
        ttl_seconds: options.persistent ? null : ttl,
        expires_at: expiresAt,
        is_persistent: options.persistent || false,
        metadata: options.metadata || {},
      },
      { onConflict: "agent_id,memory_type,key" }
    ).select().single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function recallMemory(agentId, memoryType, key) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_memory")
      .select("*")
      .eq("agent_id", agentId)
      .eq("memory_type", memoryType)
      .eq("key", key)
      .single();

    if (error) return { success: false, error: error.message };

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { success: true, data: null, expired: true };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function recallByType(agentId, memoryType) {
  try {
    let query = supabaseAdmin
      .from("agent_memory")
      .select("*")
      .eq("agent_id", agentId)
      .eq("memory_type", memoryType);

    // Filter out expired
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function forgetMemory(agentId, memoryType, key) {
  try {
    const { error } = await supabaseAdmin
      .from("agent_memory")
      .delete()
      .eq("agent_id", agentId)
      .eq("memory_type", memoryType)
      .eq("key", key);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function clearMemory(agentId) {
  try {
    const { error } = await supabaseAdmin
      .from("agent_memory")
      .delete()
      .eq("agent_id", agentId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function buildAgentContext(agentId) {
  try {
    const memories = await recallByType(agentId, "context");
    const knowledge = await recallByType(agentId, "knowledge");
    const state = await recallByType(agentId, "state");

    const context = {
      recentMemories: (memories.data || []).slice(0, 20).map((m) => m.value),
      knowledgeBase: (knowledge.data || []).map((m) => m.value),
      currentState: (state.data || []).reduce((acc, m) => {
        acc[m.key] = m.value;
        return acc;
      }, {}),
      timestamp: new Date().toISOString(),
    };

    return { success: true, data: context };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function storeConversationMessage(agentId, role, content, metadata = {}) {
  const key = `msg_${Date.now()}`;
  return storeMemory(agentId, "conversation", key, { role, content, metadata }, {
    ttl: MEMORY_TTL.conversation,
    metadata: { role },
  });
}

export async function getConversationHistory(agentId, limit = 50) {
  const result = await recallByType(agentId, "conversation");
  if (!result.success) return result;
  return {
    success: true,
    data: (result.data || []).slice(0, limit).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    ),
  };
}

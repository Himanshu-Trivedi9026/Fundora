// Agent Engine — central agent orchestrator
// Manages agent lifecycle, execution, scheduling, and context

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import {
  runAgent,
  approveAgentRun,
  cancelAgentRun,
  getAgentRun,
  listAgentRuns,
} from "./agentExecution.js";
import { buildAgentContext } from "./agentContext.js";
import {
  scheduleAgentRun,
  processScheduledRuns,
  listSchedules,
  toggleSchedule,
} from "./agentScheduler.js";
import { storeMemory, recallMemory, recallByType } from "./agentMemory.js";
import {
  checkAgentPermission,
  grantAgentPermission,
} from "./agentPermissions.js";

export async function createAgent(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .insert({
        name: options.name,
        slug: options.slug || options.name.toLowerCase().replace(/\s+/g, "-"),
        description: options.description || "",
        agent_type: options.agentType || "custom",
        status: "inactive",
        model: options.model || "gpt-4",
        system_prompt: options.systemPrompt || "",
        config: options.config || {},
        permissions: options.permissions || [],
        memory_config: options.memoryConfig || {},
        max_execution_time_ms: options.maxExecutionTimeMs || 30000,
        max_concurrent_runs: options.maxConcurrentRuns || 1,
        requires_human_approval: options.requiresHumanApproval || false,
        human_approval_actions: options.humanApprovalActions || [],
        organization_id: options.organizationId || null,
        owner_id: options.ownerId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await logAuditEvent({
      action: "agent.created",
      actorId: options.ownerId,
      targetType: "agent",
      targetId: data.id,
      metadata: { name: options.name, type: options.agentType },
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateAgent(agentId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getAgent(agentId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listAgents(options = {}) {
  try {
    let query = supabaseAdmin.from("agents").select("*", { count: "exact" });

    if (options.agentType) query = query.eq("agent_type", options.agentType);
    if (options.status) query = query.eq("status", options.status);
    if (options.organizationId)
      query = query.eq("organization_id", options.organizationId);
    if (options.ownerId) query = query.eq("owner_id", options.ownerId);

    query = query.order("created_at", { ascending: false });

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function activateAgent(agentId) {
  return updateAgent(agentId, { status: "active" });
}

export async function deactivateAgent(agentId) {
  return updateAgent(agentId, { status: "inactive" });
}

export async function deleteAgent(agentId) {
  try {
    const { error } = await supabaseAdmin
      .from("agents")
      .update({ status: "archived", deleted_at: new Date().toISOString() })
      .eq("id", agentId);

    if (error) return { success: false, error: error.message };

    await logAuditEvent({
      action: "agent.deleted",
      targetType: "agent",
      targetId: agentId,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export {
  runAgent,
  approveAgentRun,
  cancelAgentRun,
  getAgentRun,
  listAgentRuns,
  buildAgentContext,
  scheduleAgentRun,
  processScheduledRuns,
  listSchedules,
  toggleSchedule,
  storeMemory,
  recallMemory,
  recallByType,
  checkAgentPermission,
  grantAgentPermission,
};

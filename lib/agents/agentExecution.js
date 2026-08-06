// Agent Execution — run agents with sandboxing, timeouts, and error handling
// Manages agent run lifecycle and result storage

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logError } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

export async function runAgent(agentId, input = {}, options = {}) {
  try {
    // Fetch agent config
    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error || !agent) return { success: false, error: "Agent not found" };
    if (agent.status !== "active")
      return { success: false, error: "Agent is not active" };

    // Create run record
    const { data: run, error: runError } = await supabaseAdmin
      .from("agent_runs")
      .insert({
        agent_id: agentId,
        run_type: options.runType || "manual",
        status: agent.requires_human_approval ? "pending_approval" : "running",
        input,
        context: options.context || {},
        started_at: new Date().toISOString(),
        correlation_id: options.correlationId || null,
        metadata: options.metadata || {},
      })
      .select()
      .single();

    if (runError) return { success: false, error: runError.message };

    // Update agent last_run_at
    await supabaseAdmin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agentId);

    // If approval required, don't execute yet
    if (agent.requires_human_approval) {
      return {
        success: true,
        data: {
          runId: run.id,
          status: "pending_approval",
          message: "Agent requires human approval before execution",
        },
      };
    }

    // Execute in background
    executeAgentRun(agent, run.id, input, options).catch((err) => {
      logError("Background agent execution failed", {
        agentId,
        runId: run.id,
        error: err.message,
      });
    });

    return {
      success: true,
      data: {
        runId: run.id,
        status: "running",
        agentId,
        agentName: agent.name,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeAgentRun(agent, runId, input, options) {
  const startedAt = Date.now();
  try {
    const maxTime = agent.max_execution_time_ms || 30000;

    // Execute with timeout
    const output = await Promise.race([
      simulateAgentExecution(agent, input, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), maxTime),
      ),
    ]);

    const duration = Date.now() - startedAt;

    // Mark run as completed
    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "completed",
        output,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        token_usage: output.tokenUsage || {},
        cost: output.cost || 0,
      })
      .eq("id", runId);

    // Check threshold alerts
    if (output.cost > (options.costThreshold || 0.1)) {
      const { checkThresholdAlert } =
        await import("../observability/alertManager.js");
      await checkThresholdAlert(
        "agent_cost",
        output.cost,
        options.costThreshold || 0.1,
        {
          severity: "warning",
          source: "agent_platform",
        },
      );
    }

    await logAuditEvent({
      action: "agent.run.completed",
      actorId: agent.owner_id,
      targetType: "agent",
      targetId: agent.id,
      metadata: { runId, duration, cost: output.cost },
    });
  } catch (err) {
    const duration = Date.now() - startedAt;

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "failed",
        error: { message: err.message, stack: err.stack },
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", runId);

    await supabaseAdmin
      .from("agents")
      .update({
        last_error: err.message,
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    await logAuditEvent({
      action: "agent.run.failed",
      actorId: agent.owner_id,
      targetType: "agent",
      targetId: agent.id,
      metadata: { runId, error: err.message },
    });
  }
}

async function simulateAgentExecution(agent, input, options) {
  // In production: call AI model with system_prompt + input
  // Apply agent permissions, sandboxing, token limits
  await new Promise((r) => setTimeout(r, 500));

  return {
    success: true,
    summary: `Agent ${agent.name} executed successfully`,
    details: { inputSize: JSON.stringify(input).length },
    tokenUsage: { prompt: 150, completion: 50, total: 200 },
    cost: 0.002,
  };
}

export async function approveAgentRun(runId, userId) {
  try {
    const { data: run, error } = await supabaseAdmin
      .from("agent_runs")
      .select("*, agents(*)")
      .eq("id", runId)
      .single();

    if (error || !run) return { success: false, error: "Run not found" };
    if (run.status !== "pending_approval")
      return { success: false, error: "Run is not awaiting approval" };

    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "running",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", runId);

    // Execute after approval
    executeAgentRun(run.agents, runId, run.input, {}).catch((err) => {
      logError("Post-approval execution failed", { runId, error: err.message });
    });

    return { success: true, data: { runId, status: "running" } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function cancelAgentRun(runId) {
  try {
    const { error } = await supabaseAdmin
      .from("agent_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", runId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getAgentRun(runId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_runs")
      .select("*, agents(name, agent_type)")
      .eq("id", runId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listAgentRuns(agentId, options = {}) {
  try {
    let query = supabaseAdmin
      .from("agent_runs")
      .select("*", { count: "exact" })
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (options.status) query = query.eq("status", options.status);

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

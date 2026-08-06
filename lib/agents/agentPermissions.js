// Agent Permissions — permission checking and enforcement for agents
// Ensures agents can only perform authorized actions

import { supabaseAdmin } from "../supabaseAdmin.js";

export const AGENT_ACTIONS = {
  READ: "read",
  WRITE: "write",
  DELETE: "delete",
  EXECUTE: "execute",
  MODERATE: "moderate",
  APPROVE: "approve",
  REJECT: "reject",
  SUSPEND: "suspend",
  FLAG: "flag",
  HOLD: "hold",
  MANAGE: "manage",
};

export async function checkAgentPermission(agentId, resource, action) {
  try {
    // Check built-in permissions from agent config
    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .select("permissions")
      .eq("id", agentId)
      .single();

    if (error || !agent) return { success: false, error: "Agent not found" };

    const requiredPermission = `${resource}:${action}`;
    const hasPermission = (agent.permissions || []).includes(requiredPermission);

    // Check agent_permissions table for additional grants
    const { data: grants } = await supabaseAdmin
      .from("agent_permissions")
      .select("*")
      .eq("agent_id", agentId)
      .eq("resource", resource)
      .eq("action", action)
      .maybeSingle();

    return {
      success: true,
      data: {
        allowed: hasPermission || !!grants,
        permission: requiredPermission,
        source: grants ? "agent_permissions" : hasPermission ? "agent_config" : "none",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function checkAllPermissions(agentId, permissions) {
  const results = await Promise.all(
    permissions.map((perm) => {
      const [resource, action] = perm.split(":");
      return checkAgentPermission(agentId, resource, action);
    })
  );

  return {
    success: true,
    data: results.every((r) => r.success && r.data.allowed),
    details: results.map((r) => r.data || r),
  };
}

export async function grantAgentPermission(agentId, resource, action, scope = {}, grantedBy) {
  try {
    const { error } = await supabaseAdmin.from("agent_permissions").insert({
      agent_id: agentId,
      resource,
      action,
      scope,
      granted_by: grantedBy,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function revokeAgentPermission(agentId, resource, action) {
  try {
    const { error } = await supabaseAdmin
      .from("agent_permissions")
      .delete()
      .eq("agent_id", agentId)
      .eq("resource", resource)
      .eq("action", action);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function requiresHumanApproval(agentType) {
  const approvalRequired = ["compliance", "finance", "moderator"];
  return approvalRequired.includes(agentType);
}

export function getApprovalActions(agentType) {
  const actions = {
    moderator: ["content:hide", "content:remove", "user:suspend"],
    compliance: ["compliance:approve", "compliance:reject"],
    finance: ["transaction:flag", "payout:hold"],
  };
  return actions[agentType] || [];
}

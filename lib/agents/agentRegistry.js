// Agent Registry — singleton registry for agent type definitions
// Maps agent types (creator, donor, moderator, etc.) to their configs

const AGENT_TYPES = {
  creator: {
    name: "Creator Agent",
    description: "Assists campaign creators with optimization and management",
    defaultModel: "gpt-4",
    permissions: ["campaign:read", "campaign:write", "analytics:read"],
    requiresApproval: false,
  },
  donor: {
    name: "Donor Agent",
    description: "Helps donors discover and evaluate campaigns",
    defaultModel: "gpt-4",
    permissions: ["campaign:read", "analytics:read", "recommendations:read"],
    requiresApproval: false,
  },
  moderator: {
    name: "Moderator Agent",
    description: "Monitors platform content and flags violations",
    defaultModel: "gpt-4",
    permissions: ["content:read", "content:moderate", "users:read"],
    requiresApproval: true,
    approvalActions: ["content:hide", "content:remove", "user:suspend"],
  },
  compliance: {
    name: "Compliance Agent",
    description: "Reviews campaigns and users for regulatory compliance",
    defaultModel: "gpt-4",
    permissions: ["compliance:read", "compliance:review", "documents:read"],
    requiresApproval: true,
    approvalActions: ["compliance:approve", "compliance:reject"],
  },
  finance: {
    name: "Finance Agent",
    description: "Monitors financial transactions and flags anomalies",
    defaultModel: "gpt-4",
    permissions: ["finance:read", "transactions:read", "alerts:write"],
    requiresApproval: true,
    approvalActions: ["transaction:flag", "payout:hold"],
  },
  organization: {
    name: "Organization Agent",
    description: "Manages organization settings and member onboarding",
    defaultModel: "gpt-4",
    permissions: ["org:read", "org:write", "members:manage"],
    requiresApproval: false,
  },
  plugin: {
    name: "Plugin Agent",
    description: "Discovers and recommends plugins from the marketplace",
    defaultModel: "gpt-4",
    permissions: ["plugins:read", "marketplace:read"],
    requiresApproval: false,
  },
  custom: {
    name: "Custom Agent",
    description: "User-defined agent with custom configuration",
    defaultModel: "gpt-4",
    permissions: [],
    requiresApproval: false,
  },
};

const _instances = new Map();

export function getAgentType(type) {
  return AGENT_TYPES[type] || null;
}

export function listAgentTypes() {
  return Object.entries(AGENT_TYPES).map(([key, config]) => ({
    type: key,
    ...config,
  }));
}

export function registerAgentType(type, config) {
  if (AGENT_TYPES[type]) {
    return { success: false, error: `Agent type '${type}' already registered` };
  }
  AGENT_TYPES[type] = {
    name: config.name || type,
    description: config.description || "",
    defaultModel: config.defaultModel || "gpt-4",
    permissions: config.permissions || [],
    requiresApproval: config.requiresApproval || false,
    approvalActions: config.approvalActions || [],
  };
  return { success: true };
}

export function createAgentInstance(agentType, config = {}) {
  const typeDef = AGENT_TYPES[agentType];
  if (!typeDef)
    return { success: false, error: `Unknown agent type: ${agentType}` };

  const instance = {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: agentType,
    name: config.name || typeDef.name,
    model: config.model || typeDef.defaultModel,
    status: "inactive",
    permissions: config.permissions || [...typeDef.permissions],
    requiresApproval:
      config.requiresApproval !== undefined
        ? config.requiresApproval
        : typeDef.requiresApproval,
    approvalActions: config.approvalActions || typeDef.approvalActions || [],
    config: config.config || {},
    memoryConfig: config.memoryConfig || {},
    createdAt: new Date().toISOString(),
  };

  _instances.set(instance.id, instance);
  return { success: true, data: instance };
}

export function getAgentInstance(agentId) {
  return _instances.get(agentId) || null;
}

export function listAgentInstances() {
  return Array.from(_instances.values());
}

export function removeAgentInstance(agentId) {
  return _instances.delete(agentId);
}

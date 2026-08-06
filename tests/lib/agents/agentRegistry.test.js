// Tests — Agent Registry

import {
  getAgentType,
  listAgentTypes,
  registerAgentType,
  createAgentInstance,
  getAgentInstance,
  listAgentInstances,
  removeAgentInstance,
} from "../../../lib/agents/agentRegistry.js";

describe("Agent Registry", () => {
  beforeEach(() => {
    // Clean up any test instances
    const instances = listAgentInstances();
    instances.forEach((inst) => {
      const id = inst.id || inst;
      removeAgentInstance(id);
    });
  });

  describe("getAgentType", () => {
    it("returns built-in agent types", () => {
      const creator = getAgentType("creator");
      expect(creator).toBeDefined();
      expect(creator.name).toBe("Creator Agent");
      expect(creator.requiresApproval).toBe(false);
    });

    it("returns compliance as requiring approval", () => {
      const compliance = getAgentType("compliance");
      expect(compliance).toBeDefined();
      expect(compliance.requiresApproval).toBe(true);
    });

    it("returns null for unknown type", () => {
      const result = getAgentType("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("listAgentTypes", () => {
    it("returns all 8 built-in types", () => {
      const types = listAgentTypes();
      expect(types.length).toBe(8);
      const names = types.map((t) => t.name);
      expect(names).toContain("Creator Agent");
      expect(names).toContain("Compliance Agent");
      expect(names).toContain("Finance Agent");
    });
  });

  describe("registerAgentType", () => {
    it("registers a custom agent type", () => {
      const custom = {
        name: "Custom Bot",
        description: "A custom test agent",
        defaultModel: "gpt-4",
        permissions: ["read", "write"],
        requiresApproval: false,
        approvalActions: [],
      };

      registerAgentType("custom_bot", custom);
      const retrieved = getAgentType("custom_bot");
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe("Custom Bot");
    });
  });

  describe("createAgentInstance", () => {
    it("creates a named agent instance", () => {
      const result = createAgentInstance("creator", { customField: "test" });
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.id).toContain("agent_");
    });

    it("creates different IDs for separate calls", () => {
      const a = createAgentInstance("creator").data;
      const b = createAgentInstance("creator").data;
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("listAgentInstances", () => {
    it("lists all created instances", () => {
      createAgentInstance("creator");
      createAgentInstance("donor");
      const instances = listAgentInstances();
      expect(instances.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("removeAgentInstance", () => {
    it("removes an instance by ID", () => {
      const { data: instance } = createAgentInstance("creator");
      const result = removeAgentInstance(instance.id);
      expect(result).toBe(true);
      expect(getAgentInstance(instance.id)).toBeNull();
    });
  });
});

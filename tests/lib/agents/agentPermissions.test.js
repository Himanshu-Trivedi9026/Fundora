// Tests — Agent Permissions

import {
  checkAgentPermission,
  requiresHumanApproval,
  getApprovalActions,
  grantAgentPermission,
  revokeAgentPermission,
} from "../../../lib/agents/agentPermissions.js";

describe("Agent Permissions", () => {
  describe("requiresHumanApproval", () => {
    it("requires approval for compliance", () => {
      expect(requiresHumanApproval("compliance")).toBe(true);
    });

    it("requires approval for finance", () => {
      expect(requiresHumanApproval("finance")).toBe(true);
    });

    it("requires approval for moderator", () => {
      expect(requiresHumanApproval("moderator")).toBe(true);
    });

    it("does not require approval for creator", () => {
      expect(requiresHumanApproval("creator")).toBe(false);
    });

    it("does not require approval for donor", () => {
      expect(requiresHumanApproval("donor")).toBe(false);
    });
  });

  describe("getApprovalActions", () => {
    it("returns approval actions for compliance", () => {
      const actions = getApprovalActions("compliance");
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain("compliance:approve");
      expect(actions).toContain("compliance:reject");
    });

    it("returns approval actions for finance", () => {
      const actions = getApprovalActions("finance");
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain("payout:hold");
    });
  });
});

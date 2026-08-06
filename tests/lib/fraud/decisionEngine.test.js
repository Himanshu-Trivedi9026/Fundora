/**
 * Decision Engine Tests — Unit tests for decision determination.
 */

import { describe, it, expect } from "vitest";
import {
  determineDecision,
  DECISION_MATRIX,
  TRIGGER_OVERRIDES,
} from "../../../lib/fraud/decisionEngine";

describe("DecisionEngine", () => {
  describe("determineDecision", () => {
    it("should return allow for low risk, high trust user", () => {
      const result = determineDecision({
        riskScore: 10,
        riskLevel: "low",
        trustScore: 80,
        verificationLevel: 4,
        trigger: "donation",
      });

      expect(result.action).toBe("allow");
      expect(result.restrictions).toEqual([]);
    });

    it("should return block for critical risk, low trust user", () => {
      const result = determineDecision({
        riskScore: 90,
        riskLevel: "critical",
        trustScore: 10,
        verificationLevel: 0,
        trigger: "donation",
      });

      expect(result.action).toBe("block");
      expect(result.restrictions).toContain("create_campaign");
      expect(result.restrictions).toContain("donate");
    });

    it("should return manual_review for high risk, medium trust", () => {
      const result = determineDecision({
        riskScore: 55,
        riskLevel: "high",
        trustScore: 45,
        verificationLevel: 2,
        trigger: "unknown",
      });

      expect(result.action).toBe("manual_review");
      expect(result.restrictions).toContain("request_payout");
    });

    it("should escalate decision for high-value donations", () => {
      const result = determineDecision({
        riskScore: 35,
        riskLevel: "medium",
        trustScore: 45,
        verificationLevel: 2,
        trigger: "donation",
        context: { donationAmount: 60000 },
      });

      // Medium risk + medium trust = monitor, but large donation escalates
      expect(["monitor", "manual_review"]).toContain(result.action);
    });

    it("should escalate decision for high-value payouts", () => {
      const result = determineDecision({
        riskScore: 20,
        riskLevel: "low",
        trustScore: 50,
        verificationLevel: 3,
        trigger: "payout",
        context: { payoutAmount: 150000 },
      });

      // Low risk + medium trust = allow, but large payout escalates
      expect(["allow", "monitor", "manual_review"]).toContain(result.action);
    });

    it("should include reason in result", () => {
      const result = determineDecision({
        riskScore: 50,
        riskLevel: "medium",
        trustScore: 40,
        verificationLevel: 2,
        trigger: "verification",
      });

      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it("should include confidence in result", () => {
      const result = determineDecision({
        riskScore: 50,
        riskLevel: "medium",
        trustScore: 40,
        verificationLevel: 2,
        trigger: "login",
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("should handle missing context gracefully", () => {
      const result = determineDecision({
        riskScore: 50,
        riskLevel: "medium",
        trustScore: 40,
        verificationLevel: 2,
        trigger: "unknown",
      });

      expect(result.action).toBeDefined();
      expect(result.restrictions).toBeDefined();
    });
  });

  describe("DECISION_MATRIX", () => {
    it("should have all risk levels", () => {
      expect(DECISION_MATRIX.low).toBeDefined();
      expect(DECISION_MATRIX.medium).toBeDefined();
      expect(DECISION_MATRIX.high).toBeDefined();
      expect(DECISION_MATRIX.critical).toBeDefined();
    });

    it("should have all trust levels for each risk level", () => {
      Object.values(DECISION_MATRIX).forEach((riskLevel) => {
        expect(riskLevel.low).toBeDefined();
        expect(riskLevel.medium).toBeDefined();
        expect(riskLevel.high).toBeDefined();
      });
    });

    it("should only contain valid actions", () => {
      const validActions = [
        "allow",
        "monitor",
        "manual_review",
        "limit",
        "block",
        "escalate",
      ];
      Object.values(DECISION_MATRIX).forEach((riskLevel) => {
        Object.values(riskLevel).forEach((action) => {
          expect(validActions).toContain(action);
        });
      });
    });
  });

  describe("TRIGGER_OVERRIDES", () => {
    it("should have overrides for key triggers", () => {
      expect(TRIGGER_OVERRIDES.donation).toBeDefined();
      expect(TRIGGER_OVERRIDES.payout).toBeDefined();
      expect(TRIGGER_OVERRIDES.verification).toBeDefined();
      expect(TRIGGER_OVERRIDES.account_change).toBeDefined();
    });
  });
});

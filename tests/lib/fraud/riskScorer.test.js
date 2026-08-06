/**
 * Risk Scorer Tests — Unit tests for risk score calculation.
 */

import { describe, it, expect } from "vitest";
import { calculateRiskScore, getRiskLevel, getRiskLevelInfo, RISK_WEIGHTS, RISK_LEVELS } from "../../../lib/fraud/riskScorer";

describe("RiskScorer", () => {
  describe("calculateRiskScore", () => {
    it("should return low risk for trusted, verified user with no signals", () => {
      const result = calculateRiskScore({
        signals: {
          accountAgeDays: 60,
          knownDevice: true,
          deviceCount24h: 1,
          newDevice: false,
          deviceRiskFlags: [],
          recentVerificationAttempts: 0,
          recentBankChanges: 0,
          recentActivityCount: 5,
          previousRuleHits: 0,
          countryMismatch: false,
          disposableEmail: false,
        },
        ruleResults: { triggered: [] },
        trustScore: 80,
        verificationLevel: 4,
        trigger: "donation",
      });

      expect(result.score).toBeLessThan(30);
      expect(result.level).toBe("low");
    });

    it("should return high risk for new, unverified user with suspicious signals", () => {
      const result = calculateRiskScore({
        signals: {
          accountAgeDays: 2,
          knownDevice: false,
          deviceCount24h: 5,
          newDevice: true,
          deviceRiskFlags: ["suspicious"],
          recentVerificationAttempts: 5,
          recentBankChanges: 3,
          recentActivityCount: 25,
          previousRuleHits: 3,
          countryMismatch: true,
          disposableEmail: true,
        },
        ruleResults: {
          triggered: [
            { ruleId: "1", ruleName: "rapid_donations", category: "velocity", severity: "high", riskContribution: 15 },
            { ruleId: "2", ruleName: "multiple_devices", category: "velocity", severity: "medium", riskContribution: 10 },
          ],
        },
        trustScore: 10,
        verificationLevel: 0,
        trigger: "donation",
      });

      expect(result.score).toBeGreaterThan(50);
      expect(["high", "critical"]).toContain(result.level);
    });

    it("should handle empty signals gracefully", () => {
      const result = calculateRiskScore({
        signals: {},
        ruleResults: { triggered: [] },
        trustScore: 0,
        verificationLevel: 0,
        trigger: "unknown",
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toBeDefined();
    });

    it("should include breakdown in result", () => {
      const result = calculateRiskScore({
        signals: { accountAgeDays: 30 },
        ruleResults: { triggered: [] },
        trustScore: 50,
        verificationLevel: 2,
        trigger: "login",
      });

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.signalRisk).toBeDefined();
      expect(result.breakdown.ruleRisk).toBeDefined();
      expect(result.breakdown.trustRisk).toBeDefined();
      expect(result.breakdown.verificationRisk).toBeDefined();
    });

    it("should clamp score to 0-100", () => {
      const result = calculateRiskScore({
        signals: {
          accountAgeDays: 0,
          knownDevice: false,
          deviceCount24h: 10,
          newDevice: true,
          deviceRiskFlags: ["flag1", "flag2", "flag3"],
          recentVerificationAttempts: 10,
          recentBankChanges: 10,
          recentActivityCount: 100,
          previousRuleHits: 20,
          countryMismatch: true,
          disposableEmail: true,
        },
        ruleResults: {
          triggered: Array(10).fill({ ruleId: "1", ruleName: "test", riskContribution: 15 }),
        },
        trustScore: 0,
        verificationLevel: 0,
        trigger: "donation",
      });

      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getRiskLevel", () => {
    it("should return low for scores 0-25", () => {
      expect(getRiskLevel(0)).toBe("low");
      expect(getRiskLevel(15)).toBe("low");
      expect(getRiskLevel(25)).toBe("low");
    });

    it("should return medium for scores 26-50", () => {
      expect(getRiskLevel(26)).toBe("medium");
      expect(getRiskLevel(40)).toBe("medium");
      expect(getRiskLevel(50)).toBe("medium");
    });

    it("should return high for scores 51-75", () => {
      expect(getRiskLevel(51)).toBe("high");
      expect(getRiskLevel(65)).toBe("high");
      expect(getRiskLevel(75)).toBe("high");
    });

    it("should return critical for scores 76-100", () => {
      expect(getRiskLevel(76)).toBe("critical");
      expect(getRiskLevel(90)).toBe("critical");
      expect(getRiskLevel(100)).toBe("critical");
    });
  });

  describe("getRiskLevelInfo", () => {
    it("should return info for all levels", () => {
      const levels = ["low", "medium", "high", "critical"];
      levels.forEach((level) => {
        const info = getRiskLevelInfo(level);
        expect(info.label).toBeDefined();
        expect(info.color).toBeDefined();
        expect(info.description).toBeDefined();
      });
    });
  });

  describe("RISK_WEIGHTS", () => {
    it("should sum to 1.0", () => {
      const total = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 2);
    });
  });

  describe("RISK_LEVELS", () => {
    it("should have all four levels", () => {
      expect(RISK_LEVELS.LOW).toBeDefined();
      expect(RISK_LEVELS.MEDIUM).toBeDefined();
      expect(RISK_LEVELS.HIGH).toBeDefined();
      expect(RISK_LEVELS.CRITICAL).toBeDefined();
    });

    it("should have non-overlapping ranges", () => {
      expect(RISK_LEVELS.LOW.max).toBeLessThan(RISK_LEVELS.MEDIUM.min);
      expect(RISK_LEVELS.MEDIUM.max).toBeLessThan(RISK_LEVELS.HIGH.min);
      expect(RISK_LEVELS.HIGH.max).toBeLessThan(RISK_LEVELS.CRITICAL.min);
    });
  });
});

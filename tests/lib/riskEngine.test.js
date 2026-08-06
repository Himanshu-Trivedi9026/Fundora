import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  getRiskLevel,
  RISK_FACTORS,
  RISK_LEVELS,
} from "../../lib/risk/riskEngine";

describe("Risk Engine", () => {
  describe("calculateRiskScore", () => {
    it("returns a riskScore between 0 and 100", () => {
      const result = calculateRiskScore({});
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it("returns a valid riskLevel", () => {
      const result = calculateRiskScore({});
      expect(["minimal", "low", "medium", "high", "critical"]).toContain(result.riskLevel);
    });

    it("returns lastCalculated as ISO string", () => {
      const result = calculateRiskScore({});
      expect(result.lastCalculated).toBeTruthy();
      expect(new Date(result.lastCalculated).toISOString()).toBe(result.lastCalculated);
    });

    it("returns riskFactors breakdown", () => {
      const result = calculateRiskScore({});
      expect(result.riskFactors).toHaveProperty("network");
      expect(result.riskFactors).toHaveProperty("chargebacks");
      expect(result.riskFactors).toHaveProperty("spam");
      expect(result.riskFactors).toHaveProperty("accounts");
      expect(result.riskFactors).toHaveProperty("device");
      expect(result.riskFactors).toHaveProperty("reports");
      expect(result.riskFactors).toHaveProperty("fraud");
    });

    it("each factor has score and confidence", () => {
      const result = calculateRiskScore({});
      Object.values(result.riskFactors).forEach((factor) => {
        expect(factor).toHaveProperty("score");
        expect(factor).toHaveProperty("confidence");
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
      });
    });

    it("returns riskLevelLabel and riskLevelColor", () => {
      const result = calculateRiskScore({});
      expect(result.riskLevelLabel).toBeTruthy();
      expect(result.riskLevelColor).toBeTruthy();
    });

    it("minimal risk with no signals", () => {
      const result = calculateRiskScore({});
      expect(result.riskScore).toBeLessThanOrEqual(20);
      expect(["minimal", "low"]).toContain(result.riskLevel);
    });
  });

  describe("getRiskLevel", () => {
    it("returns Minimal Risk for scores 0-15", () => {
      const result = getRiskLevel(5);
      expect(result.label).toBe("Minimal Risk");
      expect(result.color).toBe("success");
    });

    it("returns Low Risk for scores 16-35", () => {
      const result = getRiskLevel(25);
      expect(result.label).toBe("Low Risk");
      expect(result.color).toBe("primary");
    });

    it("returns Medium Risk for scores 36-55", () => {
      const result = getRiskLevel(45);
      expect(result.label).toBe("Medium Risk");
      expect(result.color).toBe("warning");
    });

    it("returns High Risk for scores 56-75", () => {
      const result = getRiskLevel(65);
      expect(result.label).toBe("High Risk");
      expect(result.color).toBe("danger");
    });

    it("returns Critical Risk for scores 76-100", () => {
      const result = getRiskLevel(85);
      expect(result.label).toBe("Critical Risk");
      expect(result.color).toBe("danger");
    });
  });

  describe("RISK_FACTORS", () => {
    it("has all 7 risk factors", () => {
      expect(Object.keys(RISK_FACTORS)).toHaveLength(7);
    });

    it("each factor has weight, label, and description", () => {
      Object.values(RISK_FACTORS).forEach((factor) => {
        expect(factor).toHaveProperty("weight");
        expect(factor).toHaveProperty("label");
        expect(factor).toHaveProperty("description");
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
      });
    });

    it("weights sum to 1.0", () => {
      const total = Object.values(RISK_FACTORS).reduce((a, b) => a + b.weight, 0);
      expect(total).toBeCloseTo(1.0, 10);
    });
  });

  describe("RISK_LEVELS", () => {
    it("has all 5 risk levels", () => {
      expect(Object.keys(RISK_LEVELS)).toHaveLength(5);
    });

    it("each level has min, max, label, and color", () => {
      Object.values(RISK_LEVELS).forEach((level) => {
        expect(level).toHaveProperty("min");
        expect(level).toHaveProperty("max");
        expect(level).toHaveProperty("label");
        expect(level).toHaveProperty("color");
      });
    });
  });
});

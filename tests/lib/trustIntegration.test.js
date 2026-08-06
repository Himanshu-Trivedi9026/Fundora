import { describe, it, expect } from "vitest";
import {
  applyVerificationApproval,
  applyVerificationRejection,
  calculateBusinessTrustBonus,
  calculateBankTrustBonus,
  VERIFICATION_WEIGHTS,
  BUSINESS_TYPE_MULTIPLIERS,
} from "../../lib/trust/trustEngine";

describe("Trust Integration — Verification Adjustments", () => {
  describe("applyVerificationApproval", () => {
    // Uses configurable VERIFICATION_WEIGHTS
    it("boosts score by 10 for phone verification", () => {
      expect(applyVerificationApproval(50, "phone")).toBe(60);
    });

    it("boosts score by 25 for id verification", () => {
      expect(applyVerificationApproval(50, "id")).toBe(75);
    });

    it("boosts score by 20 for bank verification", () => {
      expect(applyVerificationApproval(50, "bank")).toBe(70);
    });

    it("boosts score by 25 for business verification", () => {
      expect(applyVerificationApproval(50, "business")).toBe(75);
    });

    it("boosts score by 5 for selfie verification", () => {
      expect(applyVerificationApproval(50, "selfie")).toBe(55);
    });

    it("boosts score by 5 for address verification", () => {
      expect(applyVerificationApproval(50, "address")).toBe(55);
    });

    it("boosts score by 10 for gst verification", () => {
      expect(applyVerificationApproval(50, "gst")).toBe(60);
    });

    it("defaults to +5 for unknown verification type", () => {
      expect(applyVerificationApproval(50, "unknown")).toBe(55);
    });

    it("caps score at 100 (bank: 90 + 20 = 110 → 100)", () => {
      expect(applyVerificationApproval(90, "bank")).toBe(100);
    });

    it("caps score at 100 (at exactly 100, no change)", () => {
      expect(applyVerificationApproval(100, "id")).toBe(100);
    });

    it("boosts from 0", () => {
      expect(applyVerificationApproval(0, "id")).toBe(25);
    });

    it("boosts from low score", () => {
      expect(applyVerificationApproval(10, "bank")).toBe(30);
    });

    it("handles negative current score gracefully", () => {
      expect(applyVerificationApproval(-5, "id")).toBe(20);
    });

    it("returns a number", () => {
      const result = applyVerificationApproval(50, "phone");
      expect(typeof result).toBe("number");
    });

    it("all boost values are positive", () => {
      const types = ["phone", "id", "bank", "business", "selfie", "address", "gst", "unknown"];
      types.forEach((type) => {
        const result = applyVerificationApproval(0, type);
        expect(result).toBeGreaterThan(0);
      });
    });
  });

  describe("applyVerificationRejection", () => {
    // Uses configurable VERIFICATION_WEIGHTS with 40% penalty
    it("reduces score by 4 for phone rejection (10 * 0.4)", () => {
      expect(applyVerificationRejection(50, "phone")).toBe(46);
    });

    it("reduces score by 10 for id rejection (25 * 0.4)", () => {
      expect(applyVerificationRejection(50, "id")).toBe(40);
    });

    it("reduces score by 8 for bank rejection (20 * 0.4)", () => {
      expect(applyVerificationRejection(50, "bank")).toBe(42);
    });

    it("reduces score by 10 for business rejection (25 * 0.4)", () => {
      expect(applyVerificationRejection(50, "business")).toBe(40);
    });

    it("reduces score by 2 for selfie rejection (5 * 0.4)", () => {
      expect(applyVerificationRejection(50, "selfie")).toBe(48);
    });

    it("reduces score by 2 for address rejection (5 * 0.4)", () => {
      expect(applyVerificationRejection(50, "address")).toBe(48);
    });

    it("defaults to -2 for unknown verification type (5 * 0.4)", () => {
      expect(applyVerificationRejection(50, "unknown")).toBe(48);
    });

    it("floors score at 0 (id: 5 - 10 = -5 → 0)", () => {
      expect(applyVerificationRejection(5, "id")).toBe(0);
    });

    it("floors score at 0 (bank: 3 - 8 = -5 → 0)", () => {
      expect(applyVerificationRejection(3, "bank")).toBe(0);
    });

    it("floors score at 0 (at exactly 0, no change)", () => {
      expect(applyVerificationRejection(0, "id")).toBe(0);
    });

    it("reduces from high score", () => {
      expect(applyVerificationRejection(90, "id")).toBe(80);
    });

    it("reduces from maximum score", () => {
      expect(applyVerificationRejection(100, "bank")).toBe(92);
    });

    it("handles negative current score gracefully", () => {
      expect(applyVerificationRejection(-5, "id")).toBe(0);
    });

    it("returns a number", () => {
      const result = applyVerificationRejection(50, "phone");
      expect(typeof result).toBe("number");
    });

    it("all penalties reduce the score", () => {
      const types = ["phone", "id", "bank", "business", "selfie", "address", "gst", "unknown"];
      types.forEach((type) => {
        const before = 50;
        const after = applyVerificationRejection(before, type);
        expect(after).toBeLessThan(before);
      });
    });
  });

  describe("combined approval and rejection", () => {
    it("approval followed by rejection balances out for id type", () => {
      let score = 50;
      score = applyVerificationApproval(score, "id"); // +25 → 75
      score = applyVerificationRejection(score, "id"); // -10 → 65
      expect(score).toBe(65);
    });

    it("multiple rejections eventually floor at 0", () => {
      let score = 15;
      score = applyVerificationRejection(score, "id"); // -10 → 5
      score = applyVerificationRejection(score, "id"); // -10 → 0
      expect(score).toBe(0);
    });

    it("multiple approvals eventually cap at 100", () => {
      let score = 80;
      score = applyVerificationApproval(score, "id"); // +25 → 100
      score = applyVerificationApproval(score, "id"); // +25 → 100 (capped)
      expect(score).toBe(100);
    });
  });

  describe("configurable weights", () => {
    it("VERIFICATION_WEIGHTS is exported", () => {
      expect(VERIFICATION_WEIGHTS).toBeDefined();
      expect(VERIFICATION_WEIGHTS.phone).toBe(10);
      expect(VERIFICATION_WEIGHTS.id).toBe(25);
      expect(VERIFICATION_WEIGHTS.bank).toBe(20);
      expect(VERIFICATION_WEIGHTS.business).toBe(25);
    });

    it("BUSINESS_TYPE_MULTIPLIERS is exported", () => {
      expect(BUSINESS_TYPE_MULTIPLIERS).toBeDefined();
      expect(BUSINESS_TYPE_MULTIPLIERS.private_limited).toBe(1.2);
      expect(BUSINESS_TYPE_MULTIPLIERS.individual).toBe(0.8);
    });
  });

  describe("calculateBusinessTrustBonus", () => {
    it("returns 0 for null input", () => {
      expect(calculateBusinessTrustBonus(null)).toBe(0);
    });

    it("calculates bonus for private_limited (25 * 1.2 = 30)", () => {
      expect(calculateBusinessTrustBonus({ business_type: "private_limited" })).toBe(30);
    });

    it("calculates bonus for individual (25 * 0.8 = 20)", () => {
      expect(calculateBusinessTrustBonus({ business_type: "individual" })).toBe(20);
    });

    it("defaults to 1.0 multiplier for unknown type", () => {
      expect(calculateBusinessTrustBonus({ business_type: "unknown" })).toBe(25);
    });
  });

  describe("calculateBankTrustBonus", () => {
    it("returns 0 for null input", () => {
      expect(calculateBankTrustBonus(null)).toBe(0);
    });

    it("returns base bank bonus (20) without penny drop", () => {
      expect(calculateBankTrustBonus({})).toBe(20);
    });

    it("adds penny drop bonus when successful (20 + 10 = 30)", () => {
      expect(calculateBankTrustBonus({ penny_drop_status: "success" })).toBe(30);
    });

    it("does not add penny drop bonus when failed", () => {
      expect(calculateBankTrustBonus({ penny_drop_status: "failed" })).toBe(20);
    });
  });
});

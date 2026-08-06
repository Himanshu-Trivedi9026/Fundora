import { describe, it, expect } from "vitest";
import {
  calculateTrustScore,
  getTrustLevel,
  applyVerificationApproval,
  applyVerificationRejection,
  calculateBusinessTrustBonus,
  calculateBankTrustBonus,
  VERIFICATION_WEIGHTS,
  BUSINESS_TYPE_MULTIPLIERS,
  MODULE_WEIGHTS,
} from "../../lib/trust/trustEngine";

describe("Trust Engine", () => {
  // ─── calculateTrustScore ───
  describe("calculateTrustScore", () => {
    it("returns a score between 0 and 100 with no data", async () => {
      const result = await calculateTrustScore();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("returns a score between 0 and 100 with empty object", async () => {
      const result = await calculateTrustScore({});
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("returns confidence between 0 and 100", async () => {
      const result = await calculateTrustScore({});
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("returns lastCalculated as ISO string", async () => {
      const result = await calculateTrustScore({});
      expect(result.lastCalculated).toBeTruthy();
      expect(new Date(result.lastCalculated).toISOString()).toBe(
        result.lastCalculated,
      );
    });

    it("returns all 6 module breakdowns", async () => {
      const result = await calculateTrustScore({});
      expect(result.modules).toHaveProperty("identity");
      expect(result.modules).toHaveProperty("campaigns");
      expect(result.modules).toHaveProperty("community");
      expect(result.modules).toHaveProperty("payments");
      expect(result.modules).toHaveProperty("reports");
      expect(result.modules).toHaveProperty("ai");
    });

    it("each module has score and confidence properties", async () => {
      const result = await calculateTrustScore({});
      Object.values(result.modules).forEach((mod) => {
        expect(mod).toHaveProperty("score");
        expect(mod).toHaveProperty("confidence");
        expect(typeof mod.score).toBe("number");
        expect(typeof mod.confidence).toBe("number");
      });
    });

    it("scores higher with verified identity at level 4", async () => {
      const unverified = await calculateTrustScore({});
      const verified = await calculateTrustScore({
        verification: {
          verification_level: 4,
          verified_at: new Date().toISOString(),
        },
      });
      expect(verified.score).toBeGreaterThan(unverified.score);
    });

    it("scores higher with identity level 5 vs level 0", async () => {
      const level0 = await calculateTrustScore({
        verification: { verification_level: 0 },
      });
      const level5 = await calculateTrustScore({
        verification: { verification_level: 5 },
      });
      expect(level5.modules.identity.score).toBeGreaterThan(
        level0.modules.identity.score,
      );
    });

    it("identity module scores 0 when no verification data", async () => {
      const result = await calculateTrustScore({});
      expect(result.modules.identity.score).toBe(0);
    });

    it("identity module gets recency bonus for recent verification", async () => {
      const recent = await calculateTrustScore({
        verification: {
          verification_level: 3,
          verified_at: new Date().toISOString(),
        },
      });
      const old = await calculateTrustScore({
        verification: {
          verification_level: 3,
          verified_at: "2020-01-01T00:00:00Z",
        },
      });
      expect(recent.modules.identity.score).toBeGreaterThanOrEqual(
        old.modules.identity.score,
      );
    });

    it("campaigns module returns base stub score with projects", async () => {
      const result = await calculateTrustScore({ projects: [{ id: "1" }] });
      expect(result.modules.campaigns.score).toBe(50);
      expect(result.modules.campaigns.confidence).toBe(30);
    });

    it("campaigns module returns lower score with no projects", async () => {
      const result = await calculateTrustScore({});
      expect(result.modules.campaigns.score).toBe(30);
      expect(result.modules.campaigns.confidence).toBe(20);
    });

    it("community module returns base stub score with profile", async () => {
      const result = await calculateTrustScore({ profile: { followers: 100 } });
      expect(result.modules.community.score).toBe(40);
    });

    it("payments module returns base stub score with donations", async () => {
      const result = await calculateTrustScore({ donations: [{ id: "d1" }] });
      expect(result.modules.payments.score).toBe(45);
    });

    it("payments module returns lower score with no donations", async () => {
      const result = await calculateTrustScore({});
      expect(result.modules.payments.score).toBe(25);
    });

    it("reports module scores higher with no reports", async () => {
      const noReports = await calculateTrustScore({});
      const withReports = await calculateTrustScore({
        reports: [{ id: "r1" }],
      });
      expect(noReports.modules.reports.score).toBeGreaterThan(
        withReports.modules.reports.score,
      );
    });

    it("reports module scores 80 with no reports (good)", async () => {
      const result = await calculateTrustScore({});
      expect(result.modules.reports.score).toBe(80);
    });

    it("ai module always returns neutral stub score", async () => {
      const result = await calculateTrustScore({ aiSignals: { fraud: false } });
      expect(result.modules.ai.score).toBe(50);
      expect(result.modules.ai.confidence).toBe(10);
    });

    it("handles all data provided", async () => {
      const result = await calculateTrustScore({
        verification: {
          verification_level: 5,
          verified_at: new Date().toISOString(),
        },
        projects: [{ id: "1" }, { id: "2" }],
        profile: { followers: 500 },
        donations: [{ id: "d1" }, { id: "d2" }],
        reports: [],
        aiSignals: { fraud: false },
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ─── getTrustLevel ───
  describe("getTrustLevel", () => {
    it("returns High Trust for score >= 80", () => {
      const result = getTrustLevel(85);
      expect(result.label).toBe("High Trust");
      expect(result.color).toBe("success");
      expect(result.description).toContain("Exemplary");
    });

    it("returns High Trust at boundary score 80", () => {
      const result = getTrustLevel(80);
      expect(result.label).toBe("High Trust");
    });

    it("returns Moderate Trust for scores 60-79", () => {
      const result = getTrustLevel(65);
      expect(result.label).toBe("Moderate Trust");
      expect(result.color).toBe("primary");
      expect(result.description).toContain("Verified creator");
    });

    it("returns Moderate Trust at boundary score 60", () => {
      const result = getTrustLevel(60);
      expect(result.label).toBe("Moderate Trust");
    });

    it("returns Developing Trust for scores 40-59", () => {
      const result = getTrustLevel(45);
      expect(result.label).toBe("Developing Trust");
      expect(result.color).toBe("warning");
      expect(result.description).toContain("Building");
    });

    it("returns Developing Trust at boundary score 40", () => {
      const result = getTrustLevel(40);
      expect(result.label).toBe("Developing Trust");
    });

    it("returns Low Trust for scores 20-39", () => {
      const result = getTrustLevel(25);
      expect(result.label).toBe("Low Trust");
      expect(result.color).toBe("danger");
      expect(result.description).toContain("Limited verification");
    });

    it("returns Low Trust at boundary score 20", () => {
      const result = getTrustLevel(20);
      expect(result.label).toBe("Low Trust");
    });

    it("returns New Creator for scores < 20", () => {
      const result = getTrustLevel(10);
      expect(result.label).toBe("New Creator");
      expect(result.color).toBe("danger");
      expect(result.description).toContain("Just joined");
    });

    it("returns New Creator at score 0", () => {
      const result = getTrustLevel(0);
      expect(result.label).toBe("New Creator");
    });

    it("returns New Creator at score 19 (just below boundary)", () => {
      const result = getTrustLevel(19);
      expect(result.label).toBe("New Creator");
    });

    it("returns High Trust at score 100", () => {
      const result = getTrustLevel(100);
      expect(result.label).toBe("High Trust");
    });
  });

  // ─── applyVerificationApproval ───
  describe("applyVerificationApproval", () => {
    it("boosts email verification by 5 points", () => {
      const result = applyVerificationApproval(50, "email");
      expect(result).toBe(55);
    });

    it("boosts phone verification by 10 points", () => {
      const result = applyVerificationApproval(50, "phone");
      expect(result).toBe(60);
    });

    it("boosts id verification by 25 points", () => {
      const result = applyVerificationApproval(50, "id");
      expect(result).toBe(75);
    });

    it("boosts bank verification by 20 points", () => {
      const result = applyVerificationApproval(50, "bank");
      expect(result).toBe(70);
    });

    it("boosts business verification by 25 points", () => {
      const result = applyVerificationApproval(50, "business");
      expect(result).toBe(75);
    });

    it("boosts gst verification by 10 points", () => {
      const result = applyVerificationApproval(50, "gst");
      expect(result).toBe(60);
    });

    it("boosts selfie verification by 5 points", () => {
      const result = applyVerificationApproval(50, "selfie");
      expect(result).toBe(55);
    });

    it("boosts address verification by 5 points", () => {
      const result = applyVerificationApproval(50, "address");
      expect(result).toBe(55);
    });

    it("boosts penny_drop verification by 10 points", () => {
      const result = applyVerificationApproval(50, "penny_drop");
      expect(result).toBe(60);
    });

    it("boosts pan verification by 8 points", () => {
      const result = applyVerificationApproval(50, "pan");
      expect(result).toBe(58);
    });

    it("caps score at 100 when boost would exceed", () => {
      const result = applyVerificationApproval(95, "business");
      expect(result).toBe(100);
    });

    it("caps score at 100 at exact boundary", () => {
      const result = applyVerificationApproval(75, "business");
      expect(result).toBe(100);
    });

    it("uses default boost of 5 for unknown verification type", () => {
      const result = applyVerificationApproval(50, "unknown_type");
      expect(result).toBe(55);
    });

    it("applies boost from score of 0", () => {
      const result = applyVerificationApproval(0, "id");
      expect(result).toBe(25);
    });
  });

  // ─── applyVerificationRejection ───
  describe("applyVerificationRejection", () => {
    it("penalizes email rejection by 40% of weight (2 points)", () => {
      const result = applyVerificationRejection(50, "email");
      // penalty = -round(5 * 0.4) = -2
      expect(result).toBe(48);
    });

    it("penalizes phone rejection by 40% of weight (4 points)", () => {
      const result = applyVerificationRejection(50, "phone");
      expect(result).toBe(46);
    });

    it("penalizes id rejection by 40% of weight (10 points)", () => {
      const result = applyVerificationRejection(50, "id");
      expect(result).toBe(40);
    });

    it("penalizes bank rejection by 40% of weight (8 points)", () => {
      const result = applyVerificationRejection(50, "bank");
      expect(result).toBe(42);
    });

    it("penalizes business rejection by 40% of weight (10 points)", () => {
      const result = applyVerificationRejection(50, "business");
      expect(result).toBe(40);
    });

    it("penalizes gst rejection by 40% of weight (4 points)", () => {
      const result = applyVerificationRejection(50, "gst");
      expect(result).toBe(46);
    });

    it("penalizes penny_drop rejection by 40% of weight (4 points)", () => {
      const result = applyVerificationRejection(50, "penny_drop");
      expect(result).toBe(46);
    });

    it("penalizes pan rejection by 40% of weight (3 points)", () => {
      const result = applyVerificationRejection(50, "pan");
      // penalty = -round(8 * 0.4) = -3
      expect(result).toBe(47);
    });

    it("floors score at 0 when penalty would go below", () => {
      const result = applyVerificationRejection(2, "id");
      // penalty = -10, 2 - 10 = -8, Math.max(0, -8) = 0
      expect(result).toBe(0);
    });

    it("floors at 0 at exact boundary", () => {
      const result = applyVerificationRejection(10, "id");
      expect(result).toBe(0);
    });

    it("uses default penalty of 5 for unknown type (40% of 5 = 2)", () => {
      const result = applyVerificationRejection(50, "unknown_type");
      expect(result).toBe(48);
    });

    it("applies penalty from score of 0", () => {
      const result = applyVerificationRejection(0, "id");
      expect(result).toBe(0);
    });

    it("penalizes selfie rejection by 40% of weight (2 points)", () => {
      const result = applyVerificationRejection(50, "selfie");
      expect(result).toBe(48);
    });

    it("penalizes address rejection by 40% of weight (2 points)", () => {
      const result = applyVerificationRejection(50, "address");
      expect(result).toBe(48);
    });
  });

  // ─── calculateBusinessTrustBonus ───
  describe("calculateBusinessTrustBonus", () => {
    it("returns base bonus for partnership (multiplier 1.0)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "partnership",
      });
      expect(result).toBe(25);
    });

    it("returns higher bonus for private_limited (multiplier 1.2)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "private_limited",
      });
      expect(result).toBe(30); // round(25 * 1.2)
    });

    it("returns higher bonus for public_limited (multiplier 1.2)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "public_limited",
      });
      expect(result).toBe(30);
    });

    it("returns bonus for llp (multiplier 1.1)", () => {
      const result = calculateBusinessTrustBonus({ business_type: "llp" });
      expect(result).toBe(28); // round(25 * 1.1)
    });

    it("returns bonus for startup (multiplier 1.1)", () => {
      const result = calculateBusinessTrustBonus({ business_type: "startup" });
      expect(result).toBe(28);
    });

    it("returns lower bonus for ngo (multiplier 0.9)", () => {
      const result = calculateBusinessTrustBonus({ business_type: "ngo" });
      expect(result).toBe(23); // round(25 * 0.9)
    });

    it("returns lower bonus for trust (multiplier 0.9)", () => {
      const result = calculateBusinessTrustBonus({ business_type: "trust" });
      expect(result).toBe(23);
    });

    it("returns lower bonus for society (multiplier 0.9)", () => {
      const result = calculateBusinessTrustBonus({ business_type: "society" });
      expect(result).toBe(23);
    });

    it("returns lower bonus for sole_proprietorship (multiplier 0.9)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "sole_proprietorship",
      });
      expect(result).toBe(23);
    });

    it("returns lowest bonus for individual (multiplier 0.8)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "individual",
      });
      expect(result).toBe(20); // round(25 * 0.8)
    });

    it("returns base bonus for government (multiplier 1.0)", () => {
      const result = calculateBusinessTrustBonus({
        business_type: "government",
      });
      expect(result).toBe(25);
    });

    it("returns 0 for null input", () => {
      expect(calculateBusinessTrustBonus(null)).toBe(0);
    });

    it("returns 0 for undefined input", () => {
      expect(calculateBusinessTrustBonus(undefined)).toBe(0);
    });

    it("uses default multiplier 1.0 for unknown business type", () => {
      const result = calculateBusinessTrustBonus({ business_type: "unknown" });
      expect(result).toBe(25);
    });
  });

  // ─── calculateBankTrustBonus ───
  describe("calculateBankTrustBonus", () => {
    it("returns base bonus when penny drop is not success", () => {
      const result = calculateBankTrustBonus({
        penny_drop_status: "initiated",
      });
      expect(result).toBe(20);
    });

    it("returns base bonus when penny drop is failed", () => {
      const result = calculateBankTrustBonus({ penny_drop_status: "failed" });
      expect(result).toBe(20);
    });

    it("returns base + penny_drop bonus when penny drop is success", () => {
      const result = calculateBankTrustBonus({ penny_drop_status: "success" });
      expect(result).toBe(30); // 20 (bank) + 10 (penny_drop)
    });

    it("returns 0 for null input", () => {
      expect(calculateBankTrustBonus(null)).toBe(0);
    });

    it("returns 0 for undefined input", () => {
      expect(calculateBankTrustBonus(undefined)).toBe(0);
    });

    it("returns base bonus when penny_drop_status is missing", () => {
      const result = calculateBankTrustBonus({});
      expect(result).toBe(20);
    });

    it("returns base bonus when penny_drop_status is empty string", () => {
      const result = calculateBankTrustBonus({ penny_drop_status: "" });
      expect(result).toBe(20);
    });
  });

  // ─── VERIFICATION_WEIGHTS ───
  describe("VERIFICATION_WEIGHTS", () => {
    it("has correct email weight", () => {
      expect(VERIFICATION_WEIGHTS.email).toBe(5);
    });

    it("has correct phone weight", () => {
      expect(VERIFICATION_WEIGHTS.phone).toBe(10);
    });

    it("has correct id weight", () => {
      expect(VERIFICATION_WEIGHTS.id).toBe(25);
    });

    it("has correct bank weight", () => {
      expect(VERIFICATION_WEIGHTS.bank).toBe(20);
    });

    it("has correct business weight", () => {
      expect(VERIFICATION_WEIGHTS.business).toBe(25);
    });

    it("has correct gst weight", () => {
      expect(VERIFICATION_WEIGHTS.gst).toBe(10);
    });

    it("has correct selfie weight", () => {
      expect(VERIFICATION_WEIGHTS.selfie).toBe(5);
    });

    it("has correct address weight", () => {
      expect(VERIFICATION_WEIGHTS.address).toBe(5);
    });

    it("has correct penny_drop weight", () => {
      expect(VERIFICATION_WEIGHTS.penny_drop).toBe(10);
    });

    it("has correct pan weight", () => {
      expect(VERIFICATION_WEIGHTS.pan).toBe(8);
    });

    it("has exactly 10 verification types", () => {
      expect(Object.keys(VERIFICATION_WEIGHTS)).toHaveLength(10);
    });

    it("all weights are positive numbers", () => {
      Object.values(VERIFICATION_WEIGHTS).forEach((weight) => {
        expect(typeof weight).toBe("number");
        expect(weight).toBeGreaterThan(0);
      });
    });
  });

  // ─── BUSINESS_TYPE_MULTIPLIERS ───
  describe("BUSINESS_TYPE_MULTIPLIERS", () => {
    it("has 11 business type multipliers", () => {
      expect(Object.keys(BUSINESS_TYPE_MULTIPLIERS)).toHaveLength(11);
    });

    it("has correct private_limited multiplier", () => {
      expect(BUSINESS_TYPE_MULTIPLIERS.private_limited).toBe(1.2);
    });

    it("has correct individual multiplier", () => {
      expect(BUSINESS_TYPE_MULTIPLIERS.individual).toBe(0.8);
    });

    it("has correct partnership multiplier", () => {
      expect(BUSINESS_TYPE_MULTIPLIERS.partnership).toBe(1.0);
    });

    it("all multipliers are positive numbers", () => {
      Object.values(BUSINESS_TYPE_MULTIPLIERS).forEach((mult) => {
        expect(typeof mult).toBe("number");
        expect(mult).toBeGreaterThan(0);
      });
    });

    it("multipliers range from 0.8 to 1.2", () => {
      const values = Object.values(BUSINESS_TYPE_MULTIPLIERS);
      expect(Math.min(...values)).toBe(0.8);
      expect(Math.max(...values)).toBe(1.2);
    });
  });

  // ─── MODULE_WEIGHTS ───
  describe("MODULE_WEIGHTS", () => {
    it("weights sum to 1.0", () => {
      const total = Object.values(MODULE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 10);
    });

    it("has all 6 required modules", () => {
      expect(MODULE_WEIGHTS).toHaveProperty("identity");
      expect(MODULE_WEIGHTS).toHaveProperty("campaigns");
      expect(MODULE_WEIGHTS).toHaveProperty("community");
      expect(MODULE_WEIGHTS).toHaveProperty("payments");
      expect(MODULE_WEIGHTS).toHaveProperty("reports");
      expect(MODULE_WEIGHTS).toHaveProperty("ai");
    });

    it("has 6 module weight entries", () => {
      expect(Object.keys(MODULE_WEIGHTS)).toHaveLength(6);
    });

    it("identity has highest weight at 0.30", () => {
      expect(MODULE_WEIGHTS.identity).toBe(0.3);
    });

    it("reports and ai have lowest weights at 0.05", () => {
      expect(MODULE_WEIGHTS.reports).toBe(0.05);
      expect(MODULE_WEIGHTS.ai).toBe(0.05);
    });

    it("all weights are between 0 and 1", () => {
      Object.values(MODULE_WEIGHTS).forEach((weight) => {
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });
  });
});

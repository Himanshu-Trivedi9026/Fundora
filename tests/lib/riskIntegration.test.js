import { describe, it, expect } from "vitest";
import {
  applyDocumentRejection,
  applyRepeatedFailures,
  applyDocumentReplacement,
} from "../../lib/risk/riskEngine";

describe("Risk Integration — Document & Failure Adjustments", () => {
  describe("applyDocumentRejection", () => {
    it("increases risk score by 15", () => {
      expect(applyDocumentRejection(30)).toBe(45);
    });

    it("increases from 0", () => {
      expect(applyDocumentRejection(0)).toBe(15);
    });

    it("increases from low score", () => {
      expect(applyDocumentRejection(10)).toBe(25);
    });

    it("caps at 100 when result exceeds 100", () => {
      expect(applyDocumentRejection(90)).toBe(100);
    });

    it("caps at 100 when exactly at 85", () => {
      expect(applyDocumentRejection(85)).toBe(100);
    });

    it("does not cap when result is below 100", () => {
      expect(applyDocumentRejection(80)).toBe(95);
    });

    it("returns exact 100 when input is 85 or above", () => {
      expect(applyDocumentRejection(85)).toBe(100);
      expect(applyDocumentRejection(86)).toBe(100);
      expect(applyDocumentRejection(99)).toBe(100);
      expect(applyDocumentRejection(100)).toBe(100);
    });

    it("handles already-maxed score (100)", () => {
      expect(applyDocumentRejection(100)).toBe(100);
    });

    it("returns a number", () => {
      expect(typeof applyDocumentRejection(50)).toBe("number");
    });

    it("handles negative input gracefully", () => {
      // Math.min(100, -10 + 15) = 5
      expect(applyDocumentRejection(-10)).toBe(5);
    });
  });

  describe("applyRepeatedFailures", () => {
    // --- Basic increase ---
    it("increases by 5 per failure (1 failure → +5)", () => {
      expect(applyRepeatedFailures(30, 1)).toBe(35);
    });

    it("increases by 5 per failure (2 failures → +10)", () => {
      expect(applyRepeatedFailures(30, 2)).toBe(40);
    });

    it("increases by 5 per failure (3 failures → +15)", () => {
      expect(applyRepeatedFailures(30, 3)).toBe(45);
    });

    it("increases by 5 per failure (4 failures → +20)", () => {
      expect(applyRepeatedFailures(30, 4)).toBe(50);
    });

    it("increases by 5 per failure (5 failures → +25)", () => {
      expect(applyRepeatedFailures(30, 5)).toBe(55);
    });

    // --- Max increase cap at 30 ---
    it("caps increase at 30 for 6+ failures (6 failures → +30)", () => {
      expect(applyRepeatedFailures(30, 6)).toBe(60);
    });

    it("caps increase at 30 for 7 failures", () => {
      expect(applyRepeatedFailures(30, 7)).toBe(60);
    });

    it("caps increase at 30 for 10 failures", () => {
      expect(applyRepeatedFailures(30, 10)).toBe(60);
    });

    it("caps increase at 30 for 100 failures", () => {
      expect(applyRepeatedFailures(30, 100)).toBe(60);
    });

    // --- Score cap at 100 ---
    it("caps total score at 100 (80 + 30 = 110 → 100)", () => {
      expect(applyRepeatedFailures(80, 10)).toBe(100);
    });

    it("caps total score at 100 (95 + 15 = 110 → 100)", () => {
      expect(applyRepeatedFailures(95, 3)).toBe(100);
    });

    it("does not cap when result is exactly 100", () => {
      expect(applyRepeatedFailures(70, 6)).toBe(100);
    });

    // --- Zero failures ---
    it("increases by 0 when failureCount is 0", () => {
      expect(applyRepeatedFailures(50, 0)).toBe(50);
    });

    // --- Edge cases ---
    it("handles from score 0", () => {
      expect(applyRepeatedFailures(0, 1)).toBe(5);
    });

    it("handles already at 100", () => {
      expect(applyRepeatedFailures(100, 5)).toBe(100);
    });

    it("returns a number", () => {
      expect(typeof applyRepeatedFailures(50, 3)).toBe("number");
    });

    it("handles negative input gracefully", () => {
      // Math.min(100, -5 + 15) = 10
      expect(applyRepeatedFailures(-5, 3)).toBe(10);
    });
  });

  describe("applyDocumentReplacement", () => {
    // --- Basic increase ---
    it("increases by 3 per replacement (1 replacement → +3)", () => {
      expect(applyDocumentReplacement(30, 1)).toBe(33);
    });

    it("increases by 3 per replacement (2 replacements → +6)", () => {
      expect(applyDocumentReplacement(30, 2)).toBe(36);
    });

    it("increases by 3 per replacement (3 replacements → +9)", () => {
      expect(applyDocumentReplacement(30, 3)).toBe(39);
    });

    it("increases by 3 per replacement (4 replacements → +12)", () => {
      expect(applyDocumentReplacement(30, 4)).toBe(42);
    });

    it("increases by 3 per replacement (5 replacements → +15)", () => {
      expect(applyDocumentReplacement(30, 5)).toBe(45);
    });

    // --- Max increase cap at 15 ---
    it("caps increase at 15 for 6+ replacements", () => {
      expect(applyDocumentReplacement(30, 6)).toBe(45);
    });

    it("caps increase at 15 for 7 replacements", () => {
      expect(applyDocumentReplacement(30, 7)).toBe(45);
    });

    it("caps increase at 15 for 10 replacements", () => {
      expect(applyDocumentReplacement(30, 10)).toBe(45);
    });

    it("caps increase at 15 for 100 replacements", () => {
      expect(applyDocumentReplacement(30, 100)).toBe(45);
    });

    // --- Score cap at 100 ---
    it("caps total score at 100 (90 + 15 = 105 → 100)", () => {
      expect(applyDocumentReplacement(90, 10)).toBe(100);
    });

    it("caps total score at 100 (98 + 5 = 103 → 100)", () => {
      expect(applyDocumentReplacement(98, 2)).toBe(100);
    });

    it("does not cap when result is exactly 100", () => {
      expect(applyDocumentReplacement(85, 5)).toBe(100);
    });

    // --- Zero replacements ---
    it("increases by 0 when replacementCount is 0", () => {
      expect(applyDocumentReplacement(50, 0)).toBe(50);
    });

    // --- Edge cases ---
    it("handles from score 0", () => {
      expect(applyDocumentReplacement(0, 1)).toBe(3);
    });

    it("handles already at 100", () => {
      expect(applyDocumentReplacement(100, 5)).toBe(100);
    });

    it("returns a number", () => {
      expect(typeof applyDocumentReplacement(50, 3)).toBe("number");
    });

    it("handles negative input gracefully", () => {
      // Math.min(100, -10 + 9) = -1 → but Math.min(100, -1) = -1
      // Actually: Math.min(100, -10 + 9) = -1
      // The function doesn't floor at 0, it only caps at 100
      const result = applyDocumentReplacement(-10, 3);
      expect(result).toBe(-1);
    });
  });

  describe("combined risk adjustments", () => {
    it("document rejection + repeated failures compound", () => {
      let score = 20;
      score = applyDocumentRejection(score); // +15 → 35
      score = applyRepeatedFailures(score, 3); // +15 → 50
      expect(score).toBe(50);
    });

    it("document replacement after rejection stays under 100", () => {
      let score = 50;
      score = applyDocumentRejection(score); // +15 → 65
      score = applyDocumentReplacement(score, 5); // +15 → 80
      expect(score).toBe(80);
    });

    it("all three combined cap at 100", () => {
      let score = 70;
      score = applyDocumentRejection(score); // +15 → 85
      score = applyRepeatedFailures(score, 5); // +25 → 100 (capped at 100, but min(100, 85+25) = 100)
      score = applyDocumentReplacement(score, 5); // +15 → 100 (already at 100)
      expect(score).toBe(100);
    });

    it("moderate combined scenario stays under cap", () => {
      let score = 10;
      score = applyDocumentRejection(score); // +15 → 25
      score = applyRepeatedFailures(score, 2); // +10 → 35
      score = applyDocumentReplacement(score, 3); // +9 → 44
      expect(score).toBe(44);
    });
  });
});

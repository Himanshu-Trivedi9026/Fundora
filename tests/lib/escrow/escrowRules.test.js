/**
 * Escrow Rules Tests — Unit tests for escrow business rules.
 */

import { describe, it, expect } from "vitest";
import {
  canRelease,
  canRefund,
  canPayout,
  calculatePlatformFee,
  calculateCreatorEarning,
  validateAmount,
} from "../../../lib/escrow/escrowRules";

describe("EscrowRules", () => {
  describe("canRelease", () => {
    it("should allow release when sufficient locked balance", () => {
      const account = { locked_balance: 1000, status: "active" };
      const result = canRelease(account, 500);
      expect(result.allowed).toBe(true);
    });

    it("should reject release when insufficient locked balance", () => {
      const account = { locked_balance: 100, status: "active" };
      const result = canRelease(account, 500);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should reject release when account is frozen", () => {
      const account = { locked_balance: 1000, status: "frozen" };
      const result = canRelease(account, 500);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("frozen");
    });

    it("should reject release when account is closed", () => {
      const account = { locked_balance: 1000, status: "closed" };
      const result = canRelease(account, 500);
      expect(result.allowed).toBe(false);
    });

    it("should reject release with zero amount", () => {
      const account = { locked_balance: 1000, status: "active" };
      const result = canRelease(account, 0);
      expect(result.allowed).toBe(false);
    });
  });

  describe("canRefund", () => {
    it("should allow refund when sufficient balance", () => {
      const account = { locked_balance: 1000, status: "active" };
      const result = canRefund(account, 500);
      expect(result.allowed).toBe(true);
    });

    it("should reject refund when insufficient balance", () => {
      const account = { locked_balance: 100, status: "active" };
      const result = canRefund(account, 500);
      expect(result.allowed).toBe(false);
    });

    it("should reject refund on cancelled account", () => {
      const account = { locked_balance: 1000, status: "cancelled" };
      const result = canRefund(account, 500);
      expect(result.allowed).toBe(false);
    });
  });

  describe("canPayout", () => {
    it("should allow payout when sufficient creator earnings", () => {
      const account = { creator_earnings: 500, status: "active" };
      const result = canPayout(account, 300);
      expect(result.allowed).toBe(true);
    });

    it("should reject payout when insufficient earnings", () => {
      const account = { creator_earnings: 100, status: "active" };
      const result = canPayout(account, 500);
      expect(result.allowed).toBe(false);
    });

    it("should reject payout on frozen account", () => {
      const account = { creator_earnings: 500, status: "frozen" };
      const result = canPayout(account, 300);
      expect(result.allowed).toBe(false);
    });
  });

  describe("calculatePlatformFee", () => {
    it("should calculate fee correctly", () => {
      const result = calculatePlatformFee(1000, 5);
      expect(result.fee).toBe(50);
      expect(result.net).toBe(950);
    });

    it("should handle zero amount", () => {
      const result = calculatePlatformFee(0, 5);
      expect(result.fee).toBe(0);
      expect(result.net).toBe(0);
    });

    it("should handle zero fee percentage", () => {
      const result = calculatePlatformFee(1000, 0);
      expect(result.fee).toBe(0);
      expect(result.net).toBe(1000);
    });

    it("should round to 2 decimal places", () => {
      const result = calculatePlatformFee(1000, 3.33);
      expect(result.fee).toBeCloseTo(33.3, 1);
    });
  });

  describe("calculateCreatorEarning", () => {
    it("should calculate net earning correctly", () => {
      const result = calculateCreatorEarning(1000, 5);
      expect(result.creatorEarning).toBe(950);
      expect(result.platformFee).toBe(50);
    });

    it("should handle zero fee", () => {
      const result = calculateCreatorEarning(1000, 0);
      expect(result.creatorEarning).toBe(1000);
      expect(result.platformFee).toBe(0);
    });
  });

  describe("validateAmount", () => {
    it("should accept valid positive amount", () => {
      const result = validateAmount(100);
      expect(result.valid).toBe(true);
    });

    it("should reject zero amount", () => {
      const result = validateAmount(0);
      expect(result.valid).toBe(false);
    });

    it("should reject negative amount", () => {
      const result = validateAmount(-100);
      expect(result.valid).toBe(false);
    });

    it("should reject non-numeric amount", () => {
      const result = validateAmount("abc");
      expect(result.valid).toBe(false);
    });

    it("should reject NaN", () => {
      const result = validateAmount(NaN);
      expect(result.valid).toBe(false);
    });

    it("should reject amounts exceeding max limit", () => {
      const result = validateAmount(100000001);
      expect(result.valid).toBe(false);
    });
  });
});

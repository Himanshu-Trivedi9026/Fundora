import { describe, it, expect } from "vitest";
import {
  validateIFSC,
  maskAccountNumber,
  maskIFSC,
} from "../../lib/verification/bankVerification";

describe("Bank Verification — Validation Helpers", () => {
  // ─── validateIFSC ───
  describe("validateIFSC", () => {
    it("returns valid for a correct IFSC code (HDFC0123456)", () => {
      const result = validateIFSC("HDFC0123456");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns valid for another correct IFSC (ICIC0001234)", () => {
      const result = validateIFSC("ICIC0001234");
      expect(result.valid).toBe(true);
    });

    it("accepts lowercase IFSC and normalises to uppercase", () => {
      const result = validateIFSC("hdfc0123456");
      expect(result.valid).toBe(true);
    });

    it("accepts IFSC with leading/trailing whitespace", () => {
      const result = validateIFSC("  HDFC0123456  ");
      expect(result.valid).toBe(true);
    });

    it("returns error for null input", () => {
      const result = validateIFSC(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code is required");
    });

    it("returns error for undefined input", () => {
      const result = validateIFSC(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code is required");
    });

    it("returns error for empty string", () => {
      const result = validateIFSC("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code is required");
    });

    it("returns error for non-string input (number)", () => {
      const result = validateIFSC(12345678901);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code is required");
    });

    it("returns error for non-string input (object)", () => {
      const result = validateIFSC({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code is required");
    });

    it("returns error for wrong length — too short (10 chars)", () => {
      const result = validateIFSC("HDFC012345");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code must be 11 characters");
    });

    it("returns error for wrong length — too long (12 chars)", () => {
      const result = validateIFSC("HDFC01234567");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code must be 11 characters");
    });

    it("returns error for invalid format — no zero at position 5 (wrong length)", () => {
      // 12 chars → length check fails first
      const result = validateIFSC("HDFC10123456");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code must be 11 characters");
    });

    it("returns error for invalid format — starts with digits", () => {
      const result = validateIFSC("12340ABCDEF");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid IFSC code format");
    });

    it("returns error for invalid format — no 0 at position 5 and fails relaxed check", () => {
      // Doesn't start with 4 alpha + 0
      const result = validateIFSC("ABCD1EFGHIJ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid IFSC code format");
    });

    it("accepts IFSC passing relaxed validation (starts with 4 alpha + 0)", () => {
      // Relaxed: starts with 4 alpha + 0 but rest doesn't match strict regex
      const result = validateIFSC("HDFC0ABCDE1");
      expect(result.valid).toBe(true);
    });

    it("returns error for all-alpha 11 chars without zero at position 5", () => {
      const result = validateIFSC("ABCDEFGHIJK");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid IFSC code format");
    });

    it("returns valid for IFSC with correct strict regex match", () => {
      // 4 alpha + 0 + 2 alpha + 4 digit (strict match)
      const result = validateIFSC("SBIN0000123");
      expect(result.valid).toBe(true);
    });

    it("returns error for single character input", () => {
      const result = validateIFSC("H");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("IFSC code must be 11 characters");
    });
  });
});

describe("Bank Verification — Masking Helpers", () => {
  // ─── maskAccountNumber ───
  describe("maskAccountNumber", () => {
    it("masks a normal account number — shows only last 4 digits", () => {
      const result = maskAccountNumber("1234567890123456");
      expect(result).toBe("************3456");
    });

    it("masks a 10-digit account number", () => {
      const result = maskAccountNumber("1234567890");
      expect(result).toBe("******7890");
    });

    it("masks a 12-digit account number", () => {
      const result = maskAccountNumber("987654321098");
      expect(result).toBe("********1098");
    });

    it("returns '****' for null input", () => {
      expect(maskAccountNumber(null)).toBe("****");
    });

    it("returns '****' for undefined input", () => {
      expect(maskAccountNumber(undefined)).toBe("****");
    });

    it("returns '****' for empty string", () => {
      expect(maskAccountNumber("")).toBe("****");
    });

    it("returns '****' for non-string input (number)", () => {
      expect(maskAccountNumber(1234567890)).toBe("****");
    });

    it("returns '****' for short account number (4 chars or fewer)", () => {
      expect(maskAccountNumber("1234")).toBe("****");
      expect(maskAccountNumber("123")).toBe("****");
      expect(maskAccountNumber("1")).toBe("****");
    });

    it("masks account number of exactly 5 chars (just above threshold)", () => {
      const result = maskAccountNumber("12345");
      expect(result).toBe("*2345");
    });

    it("masks a very long account number", () => {
      const long = "1".repeat(20) + "5678";
      const result = maskAccountNumber(long);
      expect(result.endsWith("5678")).toBe(true);
      expect(result.length).toBe(20 + 4);
    });

    it("preserves original digits in masked output", () => {
      const result = maskAccountNumber("998877665544");
      // 12 chars → 8 asterisks + last 4
      expect(result).toBe("********5544");
    });
  });

  // ─── maskIFSC ───
  describe("maskIFSC", () => {
    it("masks a valid IFSC — shows first 4 chars + masks rest", () => {
      const result = maskIFSC("HDFC0123456");
      expect(result).toBe("HDFC*******");
    });

    it("masks IFSC with different bank code", () => {
      const result = maskIFSC("ICIC0001234");
      expect(result).toBe("ICIC*******");
    });

    it("returns '****' for null input", () => {
      expect(maskIFSC(null)).toBe("****");
    });

    it("returns '****' for undefined input", () => {
      expect(maskIFSC(undefined)).toBe("****");
    });

    it("returns '****' for empty string", () => {
      expect(maskIFSC("")).toBe("****");
    });

    it("returns '****' for non-string input (boolean)", () => {
      expect(maskIFSC(true)).toBe("****");
    });

    it("returns '****' for short IFSC (4 chars or fewer)", () => {
      expect(maskIFSC("HDFC")).toBe("****");
      expect(maskIFSC("HD")).toBe("****");
      expect(maskIFSC("A")).toBe("****");
    });

    it("masks IFSC of exactly 5 chars (just above threshold)", () => {
      const result = maskIFSC("HDFC0");
      expect(result).toBe("HDFC*");
    });

    it("preserves original casing in masked output", () => {
      const result = maskIFSC("hdfc0123456");
      expect(result).toBe("hdfc*******");
    });

    it("masks a 7-char partial IFSC", () => {
      const result = maskIFSC("HDFC012");
      expect(result).toBe("HDFC***");
    });
  });
});

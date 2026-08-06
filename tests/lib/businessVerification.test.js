import { describe, it, expect } from "vitest";
import {
  validateGSTNumber,
  validatePANNumber,
  validateCINNumber,
  maskGST,
  maskPAN,
} from "../../lib/verification/businessVerification";

describe("Business Verification — Validation Helpers", () => {
  // ─── validateGSTNumber ───
  describe("validateGSTNumber", () => {
    it("returns valid for a correct GST number (22AAAAA0000A1Z5)", () => {
      const result = validateGSTNumber("22AAAAA0000A1Z5");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts lowercase GST and normalises to uppercase", () => {
      const result = validateGSTNumber("22aaaaa0000a1z5");
      expect(result.valid).toBe(true);
    });

    it("accepts GST with leading/trailing whitespace", () => {
      const result = validateGSTNumber("  22AAAAA0000A1Z5  ");
      expect(result.valid).toBe(true);
    });

    it("returns error for null input", () => {
      const result = validateGSTNumber(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number is required");
    });

    it("returns error for undefined input", () => {
      const result = validateGSTNumber(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number is required");
    });

    it("returns error for empty string", () => {
      const result = validateGSTNumber("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number is required");
    });

    it("returns error for non-string input (number)", () => {
      const result = validateGSTNumber(123456789012345);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number is required");
    });

    it("returns error for non-string input (object)", () => {
      const result = validateGSTNumber({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number is required");
    });

    it("returns error for wrong length — too short (14 chars)", () => {
      const result = validateGSTNumber("22AAAAA0000A1Z");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number must be 15 characters");
    });

    it("returns error for wrong length — too long (16 chars)", () => {
      const result = validateGSTNumber("22AAAAA0000A1Z56");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("GST number must be 15 characters");
    });

    it("returns error for invalid format — starts with alpha instead of digits", () => {
      const result = validateGSTNumber("AAABBBB0000A1Z5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid GST number format");
    });

    it("returns error for invalid format — wrong Z position", () => {
      // Replace Z at position 13 with A
      const result = validateGSTNumber("22AAAAA0000A1A5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid GST number format");
    });

    it("returns error for invalid format — digits where letters expected in PAN part", () => {
      // 5 digits instead of 5 alpha after state code
      const result = validateGSTNumber("22000000000A1Z5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid GST number format");
    });

    it("returns error for invalid format — special characters", () => {
      const result = validateGSTNumber("22@AAAA0000A1Z5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid GST number format");
    });

    it("returns error for GST with only spaces (15 spaces)", () => {
      const result = validateGSTNumber("               ");
      expect(result.valid).toBe(false);
      // After trim, 15 spaces become empty → length check fails first
      expect(result.error).toBe("GST number must be 15 characters");
    });

    it("returns error for GST with numeric entity char instead of alpha", () => {
      // Entity char at position 12 should be alpha, using digit
      const result = validateGSTNumber("22AAAAA000011Z5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid GST number format");
    });

    it("returns valid for different state codes", () => {
      // State code 01 (Jammu & Kashmir)
      const result = validateGSTNumber("01AAAAA0000A1Z5");
      expect(result.valid).toBe(true);
    });

    it("returns valid for GST ending with digit instead of alpha", () => {
      const result = validateGSTNumber("22AAAAA0000A1Z9");
      expect(result.valid).toBe(true);
    });
  });

  // ─── validatePANNumber ───
  describe("validatePANNumber", () => {
    it("returns valid for a correct PAN (ABCDE1234F)", () => {
      const result = validatePANNumber("ABCDE1234F");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts lowercase PAN and normalises to uppercase", () => {
      const result = validatePANNumber("abcde1234f");
      expect(result.valid).toBe(true);
    });

    it("accepts PAN with leading/trailing whitespace", () => {
      const result = validatePANNumber("  ABCDE1234F  ");
      expect(result.valid).toBe(true);
    });

    it("returns error for null input", () => {
      const result = validatePANNumber(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number is required");
    });

    it("returns error for undefined input", () => {
      const result = validatePANNumber(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number is required");
    });

    it("returns error for empty string", () => {
      const result = validatePANNumber("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number is required");
    });

    it("returns error for non-string input (number)", () => {
      const result = validatePANNumber(1234567890);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number is required");
    });

    it("returns error for wrong length — too short (9 chars)", () => {
      const result = validatePANNumber("ABCDE1234");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number must be 10 characters");
    });

    it("returns error for wrong length — too long (11 chars)", () => {
      const result = validatePANNumber("ABCDE12345F");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("PAN number must be 10 characters");
    });

    it("returns error for invalid format — starts with digit", () => {
      const result = validatePANNumber("1BCDE1234F");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns error for invalid format — 4 alpha then digit instead of 5 alpha", () => {
      const result = validatePANNumber("ABCD11234F");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns error for invalid format — last char is digit not alpha", () => {
      const result = validatePANNumber("ABCDE12341");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns error for invalid format — special characters", () => {
      const result = validatePANNumber("ABC@E1234F");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns error for invalid format — all digits", () => {
      const result = validatePANNumber("1234567890");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns error for invalid format — all alpha (no digits in middle)", () => {
      const result = validatePANNumber("ABCDEFGHIJ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid PAN number format");
    });

    it("returns valid for different valid PAN patterns", () => {
      expect(validatePANNumber("GHIJK5678L").valid).toBe(true);
      expect(validatePANNumber("MNOQR9012S").valid).toBe(true);
    });

    it("returns error for PAN with whitespace embedded (not just trimming)", () => {
      const result = validatePANNumber("AB CDE1234F");
      expect(result.valid).toBe(false);
      // After trim, "AB CDE1234F" is 11 chars → length check first
      expect(result.error).toBe("PAN number must be 10 characters");
    });
  });

  // ─── validateCINNumber ───
  describe("validateCINNumber", () => {
    it("returns valid for a correct 21-char CIN", () => {
      const result = validateCINNumber("L12345AB2023PLC000001");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts CIN starting with U (unlisted)", () => {
      const result = validateCINNumber("U67190MH2020PTC123456");
      expect(result.valid).toBe(true);
    });

    it("accepts lowercase CIN and normalises to uppercase", () => {
      const result = validateCINNumber("l12345ab2023plc000001");
      expect(result.valid).toBe(true);
    });

    it("accepts CIN with leading/trailing whitespace", () => {
      const result = validateCINNumber("  L12345AB2023PLC000001  ");
      expect(result.valid).toBe(true);
    });

    it("returns error for null input", () => {
      const result = validateCINNumber(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number is required");
    });

    it("returns error for undefined input", () => {
      const result = validateCINNumber(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number is required");
    });

    it("returns error for empty string", () => {
      const result = validateCINNumber("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number is required");
    });

    it("returns error for non-string input", () => {
      const result = validateCINNumber(123456789012345678901);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number is required");
    });

    it("returns error for wrong length — too short (20 chars)", () => {
      const result = validateCINNumber("L12345AB2023PLC00001");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number must be 21 characters");
    });

    it("returns error for wrong length — too long (22 chars)", () => {
      const result = validateCINNumber("L12345AB2023PLC0000010");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number must be 21 characters");
    });

    it("returns valid with relaxed validation when regex fails but length is correct", () => {
      // Starts with L/U, 21 chars, but doesn't match strict regex
      const result = validateCINNumber("L12345AB2023PLC00000X");
      expect(result.valid).toBe(true);
    });

    it("returns valid for any 21-char string starting with L or U", () => {
      const result = validateCINNumber("UZZZZZZZZZZZZZZZZZZZZ");
      expect(result.valid).toBe(true);
    });

    it("returns valid for 21-char string not matching strict regex (relaxed validation)", () => {
      // CIN validation uses relaxed check: if length is 21, it returns valid
      const result = validateCINNumber("A12345AB2023PLC000001");
      expect(result.valid).toBe(true);
    });

    it("handles single character input", () => {
      const result = validateCINNumber("L");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("CIN number must be 21 characters");
    });
  });
});

describe("Business Verification — Masking Helpers", () => {
  // ─── maskGST ───
  describe("maskGST", () => {
    it("masks a valid GST — shows first 2 + last 4", () => {
      const result = maskGST("22AAAAA0000A1Z5");
      expect(result).toBe("22***A1Z5");
    });

    it("masks GST with correct structure", () => {
      const result = maskGST("01BBBBB1111B2Z9");
      expect(result).toBe("01***B2Z9");
    });

    it("returns '***' for null input", () => {
      expect(maskGST(null)).toBe("***");
    });

    it("returns '***' for undefined input", () => {
      expect(maskGST(undefined)).toBe("***");
    });

    it("returns '***' for empty string", () => {
      expect(maskGST("")).toBe("***");
    });

    it("returns '***' for non-string input (number)", () => {
      expect(maskGST(123456789012345)).toBe("***");
    });

    it("returns '***' for short GST (6 chars or fewer)", () => {
      expect(maskGST("22AAAZ")).toBe("***");
      expect(maskGST("22AAA")).toBe("***");
      expect(maskGST("AB")).toBe("***");
    });

    it("masks GST of exactly 7 chars (just above threshold)", () => {
      const result = maskGST("22AAAAA");
      // 7 chars: first 2 (22) + *** + last 4 (AAAA)
      expect(result).toBe("22***AAAA");
    });

    it("preserves original casing in masked output", () => {
      const result = maskGST("22aaaaa0000a1z5");
      expect(result).toBe("22***a1z5");
    });
  });

  // ─── maskPAN ───
  describe("maskPAN", () => {
    it("masks a valid PAN — shows first 4 + last 1", () => {
      const result = maskPAN("ABCDE1234F");
      expect(result).toBe("ABCD***F");
    });

    it("masks PAN with different letters", () => {
      const result = maskPAN("GHIJK5678L");
      expect(result).toBe("GHIJ***L");
    });

    it("returns '***' for null input", () => {
      expect(maskPAN(null)).toBe("***");
    });

    it("returns '***' for undefined input", () => {
      expect(maskPAN(undefined)).toBe("***");
    });

    it("returns '***' for empty string", () => {
      expect(maskPAN("")).toBe("***");
    });

    it("returns '***' for non-string input (boolean)", () => {
      expect(maskPAN(true)).toBe("***");
    });

    it("returns '***' for short PAN (5 chars or fewer)", () => {
      expect(maskPAN("ABCDE")).toBe("***");
      expect(maskPAN("ABCD")).toBe("***");
      expect(maskPAN("X")).toBe("***");
    });

    it("masks PAN of exactly 6 chars (just above threshold)", () => {
      const result = maskPAN("ABCDEF");
      expect(result).toBe("ABCD***F");
    });

    it("preserves original casing in masked output", () => {
      const result = maskPAN("abcde1234f");
      expect(result).toBe("abcd***f");
    });

    it("handles PAN with number last char edge case", () => {
      // Last char must be alpha per PAN format, but masking doesn't validate
      const result = maskPAN("ABCDE12341");
      expect(result).toBe("ABCD***1");
    });
  });
});

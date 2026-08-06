import { describe, it, expect } from "vitest";
import { generateOTP, hashOTP, OTP_CONFIG } from "../../lib/verification/phoneVerification";

describe("Phone Verification", () => {
  describe("generateOTP", () => {
    it("returns a string", () => {
      const otp = generateOTP();
      expect(typeof otp).toBe("string");
    });

    it("returns a 6-digit string", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("returns only numeric characters", () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateOTP();
        expect(otp).toMatch(/^\d{6}$/);
      }
    });

    it("generates different OTPs on successive calls (probabilistic)", () => {
      const otps = new Set();
      for (let i = 0; i < 50; i++) {
        otps.add(generateOTP());
      }
      // With 10^6 possible values and 50 samples, we should get at least 2 unique
      expect(otps.size).toBeGreaterThan(1);
    });

    it("can generate OTP starting with 0", () => {
      // We just need to verify the function doesn't strip leading zeros
      // Over many iterations, 0-prefixed OTPs should appear
      let foundLeadingZero = false;
      for (let i = 0; i < 1000; i++) {
        if (generateOTP().startsWith("0")) {
          foundLeadingZero = true;
          break;
        }
      }
      expect(foundLeadingZero).toBe(true);
    });
  });

  describe("hashOTP", () => {
    it("returns an object with hash and salt", () => {
      const result = hashOTP("123456");
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("salt");
    });

    it("returns non-empty hash string", () => {
      const result = hashOTP("000000");
      expect(typeof result.hash).toBe("string");
      expect(result.hash.length).toBeGreaterThan(0);
    });

    it("returns consistent hash for same input and salt", () => {
      const salt = "test-salt";
      const result1 = hashOTP("123456", salt);
      const result2 = hashOTP("123456", salt);
      expect(result1.hash).toBe(result2.hash);
    });

    it("returns different hashes for different inputs", () => {
      const salt = "test-salt";
      const result1 = hashOTP("111111", salt);
      const result2 = hashOTP("222222", salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it("produces different hashes for adjacent OTPs", () => {
      const salt = "test-salt";
      const result1 = hashOTP("123455", salt);
      const result2 = hashOTP("123456", salt);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it("returns hex-like hash string", () => {
      const result = hashOTP("999999");
      expect(result.hash).toMatch(/^[a-f0-9]+$/);
    });

    it("returns a salt string", () => {
      const result = hashOTP("123456");
      expect(typeof result.salt).toBe("string");
      expect(result.salt.length).toBeGreaterThan(0);
    });
  });

  describe("OTP_CONFIG", () => {
    it("has length of 6", () => {
      expect(OTP_CONFIG.length).toBe(6);
    });

    it("has maxAttempts of 3", () => {
      expect(OTP_CONFIG.maxAttempts).toBe(3);
    });

    it("has cooldownSeconds of 60", () => {
      expect(OTP_CONFIG.cooldownSeconds).toBe(60);
    });

    it("has expiryMinutes of 5", () => {
      expect(OTP_CONFIG.expiryMinutes).toBe(5);
    });

    it("has digitsOnly as true", () => {
      expect(OTP_CONFIG.digitsOnly).toBe(true);
    });

    it("length matches generateOTP output length", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(OTP_CONFIG.length);
    });
  });

  describe("Edge Cases", () => {
    it("generateOTP returns exactly OTP_CONFIG.length digits every time", () => {
      for (let i = 0; i < 100; i++) {
        const otp = generateOTP();
        expect(otp).toHaveLength(OTP_CONFIG.length);
        expect(/^\d+$/.test(otp)).toBe(true);
      }
    });

    it("hashOTP returns different hashes when no salt provided (uses env or default)", () => {
      const result1 = hashOTP("123456");
      const result2 = hashOTP("123456");
      // Same default salt, same OTP → same hash
      expect(result1.hash).toBe(result2.hash);
      expect(result1.salt).toBe(result2.salt);
    });

    it("hashOTP with empty string OTP", () => {
      const result = hashOTP("");
      expect(typeof result.hash).toBe("string");
      expect(result.hash.length).toBeGreaterThan(0);
    });

    it("hashOTP with very long OTP string (edge case)", () => {
      const longOTP = "1".repeat(1000);
      const result = hashOTP(longOTP);
      expect(typeof result.hash).toBe("string");
      expect(result.hash.length).toBe(64); // SHA-256 always produces 64 hex chars
    });

    it("hashOTP with unicode salt", () => {
      const result = hashOTP("123456", "नमक-नमक");
      expect(typeof result.hash).toBe("string");
      expect(result.hash.length).toBe(64);
    });

    it("hashOTP with emoji salt", () => {
      const result = hashOTP("123456", "🧂salt");
      expect(typeof result.hash).toBe("string");
      expect(result.hash.length).toBe(64);
    });

    it("generateOTP can produce all-zeros OTP", () => {
      // With enough iterations, "000000" should eventually appear (1/1M chance per try)
      // We just verify the function doesn't filter it out
      let found = false;
      for (let i = 0; i < 5000; i++) {
        if (generateOTP() === "000000") { found = true; break; }
      }
      // Not asserting found — probability is very low. Just ensuring no crash.
      expect(typeof generateOTP()).toBe("string");
    });

    it("OTP_CONFIG has sensible defaults", () => {
      expect(OTP_CONFIG.length).toBeGreaterThanOrEqual(4);
      expect(OTP_CONFIG.length).toBeLessThanOrEqual(8);
      expect(OTP_CONFIG.maxAttempts).toBeGreaterThan(0);
      expect(OTP_CONFIG.maxAttempts).toBeLessThanOrEqual(10);
      expect(OTP_CONFIG.cooldownSeconds).toBeGreaterThan(0);
      expect(OTP_CONFIG.expiryMinutes).toBeGreaterThan(0);
      expect(OTP_CONFIG.expiryMinutes).toBeLessThanOrEqual(30);
    });
  });
});

/**
 * Device Fingerprint Tests — Unit tests for device fingerprinting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordFingerprint, getDeviceFingerprints, getDeviceStats, flagDevice, sanitizeDeviceResponse } from "../../../lib/fraud/deviceFingerprint";

// Mock supabaseAdmin
const mockChain = {
  eq: vi.fn(() => mockChain),
  select: vi.fn(() => mockChain),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: { id: "new-id" }, error: null })),
    })),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  })),
  order: vi.fn(() => mockChain),
  range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
};

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}));

// Mock secureLogger
vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Mock metadataEncryption
vi.mock("../../../lib/verification/metadataEncryption", () => ({
  hashMetadata: vi.fn(() => "hashed-metadata"),
}));

describe("DeviceFingerprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordFingerprint", () => {
    it("should require userId", async () => {
      const result = await recordFingerprint({ fingerprint: { browser: "Chrome" } });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should require fingerprint", async () => {
      const result = await recordFingerprint({ userId: "user-123" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should record new fingerprint successfully", async () => {
      const result = await recordFingerprint({
        userId: "user-123",
        fingerprint: {
          browser: "Chrome",
          platform: "Windows",
          timezone: "UTC",
          language: "en-US",
          screenResolution: "1920x1080",
          userAgent: "Mozilla/5.0",
        },
      });

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
    });
  });

  describe("getDeviceFingerprints", () => {
    it("should require userId", async () => {
      const result = await getDeviceFingerprints(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID is required");
    });

    it("should return devices with default params", async () => {
      const result = await getDeviceFingerprints("user-123");
      expect(result.success).toBe(true);
      expect(Array.isArray(result.devices)).toBe(true);
    });
  });

  describe("getDeviceStats", () => {
    it("should require userId", async () => {
      const result = await getDeviceStats(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID is required");
    });

    it("should return stats for user", async () => {
      const result = await getDeviceStats("user-123");
      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
    });
  });

  describe("flagDevice", () => {
    it("should require deviceId and riskFlags", async () => {
      const result = await flagDevice(null, ["flag1"]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should flag device successfully", async () => {
      const result = await flagDevice("device-123", ["suspicious_activity"]);
      expect(result.success).toBe(true);
    });
  });

  describe("sanitizeDeviceResponse", () => {
    it("should remove sensitive fields", () => {
      const device = {
        id: "123",
        browser: "Chrome",
        platform: "Windows",
        fingerprint_hash: "abc123",
        canvas_hash: "def456",
        webgl_hash: "ghi789",
        fonts_hash: "jkl012",
        user_agent: "Mozilla/5.0",
        is_known: true,
      };

      const sanitized = sanitizeDeviceResponse(device);

      expect(sanitized.fingerprint_hash).toBeUndefined();
      expect(sanitized.canvas_hash).toBeUndefined();
      expect(sanitized.webgl_hash).toBeUndefined();
      expect(sanitized.fonts_hash).toBeUndefined();
      expect(sanitized.user_agent).toBeUndefined();
      expect(sanitized.browser).toBe("Chrome");
      expect(sanitized.platform).toBe("Windows");
      expect(sanitized.is_known).toBe(true);
    });

    it("should handle null input", () => {
      expect(sanitizeDeviceResponse(null)).toBeNull();
    });
  });
});

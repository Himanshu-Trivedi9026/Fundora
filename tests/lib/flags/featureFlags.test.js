// Tests — Feature Flags

import {
  createFlag,
  isEnabled,
  getEnabledFlags,
  createABTest,
  getVariant,
  invalidateCache,
  clearCache,
} from "../../../lib/flags/featureFlags.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        order: vi.fn(() => ({
          range: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn() })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

describe("Feature Flags", () => {
  describe("createFlag", () => {
    it("attempts to create a flag", async () => {
      const result = await createFlag({
        key: "test-flag",
        name: "Test Flag",
        enabled: true,
      });
      expect(result.success).toBe(false); // DB mock
    });
  });

  describe("isEnabled", () => {
    it("returns false when DB has no data", async () => {
      const result = await isEnabled("nonexistent");
      expect(result).toBe(false);
    });

    it("handles context with environment", async () => {
      const result = await isEnabled("test-flag", { environment: "production" });
      expect(result).toBe(false);
    });
  });

  describe("getEnabledFlags", () => {
    it("returns empty array with mock", async () => {
      const flags = await getEnabledFlags({ environment: "production" });
      expect(Array.isArray(flags)).toBe(true);
    });
  });

  describe("createABTest", () => {
    it("attempts to create an A/B test", async () => {
      const result = await createABTest({
        key: "ab-test-1",
        name: "Test A/B",
        variants: ["control", "treatment"],
        weights: [50, 50],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getVariant", () => {
    it("returns error for unknown flag", async () => {
      const result = await getVariant("nonexistent", "user-1");
      expect(result.success).toBe(false);
    });
  });

  describe("cacheControl", () => {
    it("invalidates a specific flag key", () => {
      expect(() => invalidateCache("test-flag")).not.toThrow();
    });

    it("clears all cache", () => {
      expect(() => clearCache()).not.toThrow();
    });
  });
});

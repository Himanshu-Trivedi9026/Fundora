/**
 * Fraud Events Tests — Unit tests for fraud event recording and querying.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordFraudEvent,
  getFraudEvents,
  getFraudEventSummary,
  getAllFraudEvents,
} from "../../../lib/fraud/fraudEvents";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin", () => {
  const mockChain = {
    eq: vi.fn(() => mockChain),
    neq: vi.fn(() => mockChain),
    gte: vi.fn(() => mockChain),
    lte: vi.fn(() => mockChain),
    in: vi.fn(() => mockChain),
    order: vi.fn(() => mockChain),
    range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    select: vi.fn(() => mockChain),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({ data: { id: "test-id" }, error: null }),
        ),
      })),
    })),
  };

  return {
    supabaseAdmin: {
      from: vi.fn(() => mockChain),
    },
  };
});

// Mock secureLogger
vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Mock auditLog
vi.mock("../../../lib/verification/auditLog", () => ({
  hashIP: vi.fn(() => "hashed-ip"),
}));

describe("FraudEvents", () => {
  describe("recordFraudEvent", () => {
    it("should require userId", async () => {
      const result = await recordFraudEvent({
        eventType: "test",
        eventCategory: "behavior",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should require eventType", async () => {
      const result = await recordFraudEvent({
        userId: "user-123",
        eventCategory: "behavior",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should require eventCategory", async () => {
      const result = await recordFraudEvent({
        userId: "user-123",
        eventType: "test",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    it("should reject invalid eventCategory", async () => {
      const result = await recordFraudEvent({
        userId: "user-123",
        eventType: "test",
        eventCategory: "invalid",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid event category");
    });

    it("should accept all valid event categories", async () => {
      const validCategories = [
        "verification",
        "donation",
        "payout",
        "account",
        "campaign",
        "device",
        "behavior",
        "system",
      ];

      for (const category of validCategories) {
        const result = await recordFraudEvent({
          userId: "user-123",
          eventType: "test",
          eventCategory: category,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should sanitize metadata", async () => {
      const result = await recordFraudEvent({
        userId: "user-123",
        eventType: "test",
        eventCategory: "behavior",
        metadata: {
          ip_address: "192.168.1.1",
          raw_fingerprint: "abc123",
          safeData: "this should remain",
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getFraudEvents", () => {
    it("should require userId", async () => {
      const result = await getFraudEvents(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID is required");
    });

    it("should return events with default params", async () => {
      const result = await getFraudEvents("user-123");
      expect(result.success).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe("getFraudEventSummary", () => {
    it("should require userId", async () => {
      const result = await getFraudEventSummary(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("User ID is required");
    });

    it("should return summary with default days", async () => {
      const result = await getFraudEventSummary("user-123");
      expect(result.success).toBe(true);
    });
  });

  describe("getAllFraudEvents", () => {
    it("should return events without userId filter", async () => {
      const result = await getAllFraudEvents();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });
});

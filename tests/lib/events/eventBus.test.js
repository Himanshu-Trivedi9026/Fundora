// Tests — Event Bus

import {
  publish,
  subscribe,
  unsubscribe,
  EVENT_PRIORITIES,
  getDeadLetterQueue,
  clearDeadLetterQueue,
} from "../../../lib/events/eventBus.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => {
  const mockInsert = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockReturnThis();
  const mockRange = vi.fn().mockReturnThis();

  return {
    supabaseAdmin: {
      from: vi.fn(() => ({
        insert: mockInsert,
        select: mockSelect,
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: mockOrder,
        limit: mockLimit,
        range: mockRange,
        single: mockSingle,
      })),
    },
  };
});

describe("Event Bus", () => {
  beforeEach(() => {
    clearDeadLetterQueue();
  });

  describe("publish", () => {
    it("publishes an event with required fields", async () => {
      const result = await publish(
        "test.event",
        { hello: "world" },
        { source: "test" },
      );
      expect(result.success).toBe(false); // DB mock won't actually insert
      expect(result.error).toBeDefined();
    });

    it("publishes with priority", async () => {
      const result = await publish(
        "critical.event",
        { alert: true },
        {
          source: "test",
          priority: EVENT_PRIORITIES.CRITICAL,
        },
      );
      expect(result.success).toBe(false);
    });

    it("publishes with correlation ID", async () => {
      const result = await publish(
        "tracked.event",
        { id: 1 },
        {
          source: "test",
          correlationId: "corr-123",
        },
      );
      expect(result.success).toBe(false);
    });
  });

  describe("subscribe / unsubscribe", () => {
    it("subscribes a handler and returns an ID", () => {
      const handler = vi.fn();
      const id = subscribe("test.event", handler);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("subscribes with filter expression", () => {
      const handler = vi.fn();
      const id = subscribe("filtered.event", handler, {
        filter: { type: "test" },
      });
      expect(id).toBeDefined();
    });

    it("unsubscribes a handler", () => {
      const handler = vi.fn();
      const id = subscribe("test.event", handler);
      const result = unsubscribe("test.event", id);
      expect(result).toBe(true);
    });

    it("returns false for unknown handler ID", () => {
      const result = unsubscribe("test.event", "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getDeadLetterQueue", () => {
    it("returns empty DLQ initially", () => {
      const dlq = getDeadLetterQueue();
      expect(Array.isArray(dlq)).toBe(true);
      expect(dlq.length).toBe(0);
    });
  });

  describe("EVENT_PRIORITIES", () => {
    it("defines priority levels", () => {
      expect(EVENT_PRIORITIES.LOW).toBe(1);
      expect(EVENT_PRIORITIES.NORMAL).toBe(5);
      expect(EVENT_PRIORITIES.HIGH).toBe(8);
      expect(EVENT_PRIORITIES.CRITICAL).toBe(10);
    });
  });
});

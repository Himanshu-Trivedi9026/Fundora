// Job Queue — Unit Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueue,
  registerHandler,
  unregisterHandler,
  listHandlers,
  getActiveJobCount,
  createSchedule,
} from "../../../lib/jobs/jobQueue.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: "job-1", job_type: "test", status: "pending" },
              error: null,
            }),
          ),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: "job-1", job_type: "test", status: "pending" },
              error: null,
            }),
          ),
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: "job-1",
                    job_type: "test",
                    status: "pending",
                    queue_name: "default",
                    priority: 5,
                    retry_count: 0,
                    max_retries: 3,
                    payload: {},
                    created_at: new Date().toISOString(),
                    scheduled_at: null,
                  },
                ],
                error: null,
              }),
            ),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  secureLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("../../../lib/cache/index.js", () => ({
  checkRateLimit: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { limit: 60, remaining: 59, resetAt: Date.now() + 60000 },
    }),
  ),
}));

describe("Job Queue", () => {
  beforeEach(() => {
    // Clean up handlers
    for (const handler of listHandlers()) {
      unregisterHandler(handler);
    }
  });

  describe("Handler Registration", () => {
    it("should register and unregister handlers", () => {
      const handler = vi.fn();
      const result = registerHandler("email.send", handler);
      expect(result.success).toBe(true);
      expect(listHandlers()).toContain("email.send");

      const dupResult = registerHandler("email.send", handler);
      expect(dupResult.success).toBe(false);

      const removed = unregisterHandler("email.send");
      expect(removed.success).toBe(true);
      expect(listHandlers()).not.toContain("email.send");
    });

    it("should list registered handlers", () => {
      registerHandler("job.a", vi.fn());
      registerHandler("job.b", vi.fn());
      registerHandler("job.c", vi.fn());

      const handlers = listHandlers();
      expect(handlers).toHaveLength(3);
      expect(handlers).toEqual(
        expect.arrayContaining(["job.a", "job.b", "job.c"]),
      );
    });

    it("should track active jobs count", () => {
      expect(getActiveJobCount()).toBe(0);
    });
  });

  describe("Enqueue", () => {
    // Re-mock supabaseAdmin to return predictable enqueue results
    beforeEach(() => {
      vi.resetModules();
    });

    it("should enqueue a job successfully", async () => {
      // The mock at the top level returns: { id: "job-1", job_type: "test", ... }
      // for insert().select().single() calls
      const result = await enqueue("test.job", { data: "hello" });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should accept priority as string", async () => {
      const result = await enqueue("priority.job", {}, { priority: "high" });
      expect(result.success).toBe(true);
    });
  });

  describe("Scheduled Jobs", () => {
    it("should create a schedule", async () => {
      const result = await createSchedule({
        name: "Weekly cleanup",
        jobType: "cleanup",
        scheduleCron: "0 0 * * 0",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("job-1");
      }
    });
  });
});

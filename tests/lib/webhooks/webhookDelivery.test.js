/**
 * Webhook Delivery Tests — Unit tests for webhook delivery and retry.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  deliverWebhook,
  retryDelivery,
  getWebhookDeliveries,
  getPendingRetries,
} from "../../../lib/webhooks/webhookDelivery";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("WebhookDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("deliverWebhook", () => {
    it("should deliver successfully", async () => {
      supabaseAdmin.from
        // Fetch delivery with webhook
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "del-1",
                  attempt_count: 0,
                  max_attempts: 5,
                  payload: { event: "test" },
                  webhooks: {
                    id: "wh-1",
                    url: "https://example.com/hook",
                    secret: "whsec_abc",
                    status: "active",
                  },
                },
                error: null,
              }),
            }),
          }),
        })
        // Update delivery to delivered
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Update webhook last_success_at
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      const result = await deliverWebhook("del-1");
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("delivered");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should retry on non-2xx response", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "del-1",
                  attempt_count: 0,
                  max_attempts: 5,
                  payload: { event: "test" },
                  webhooks: {
                    id: "wh-1",
                    url: "https://example.com/hook",
                    secret: "whsec_abc",
                    status: "active",
                  },
                },
                error: null,
              }),
            }),
          }),
        })
        // Update delivery to retrying
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      });

      const result = await deliverWebhook("del-1");
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("retrying");
    });

    it("should fail after max attempts", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "del-1",
                  attempt_count: 4, // Already at 4, this will be attempt 5 = max
                  max_attempts: 5,
                  payload: { event: "test" },
                  webhooks: {
                    id: "wh-1",
                    url: "https://example.com/hook",
                    secret: "whsec_abc",
                    status: "active",
                  },
                },
                error: null,
              }),
            }),
          }),
        })
        // Update delivery to failed
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Get webhook failure_count
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { failure_count: 5 }, error: null }),
            }),
          }),
        })
        // Update webhook failure_count
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      });

      const result = await deliverWebhook("del-1");
      expect(result.success).toBe(false);
    });

    it("should not deliver if webhook is inactive", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "del-1",
                attempt_count: 0,
                max_attempts: 5,
                payload: {},
                webhooks: {
                  id: "wh-1",
                  url: "https://example.com",
                  secret: "s",
                  status: "failed",
                },
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await deliverWebhook("del-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not active");
    });
  });

  describe("retryDelivery", () => {
    it("should reset and redeliver a failed delivery", async () => {
      // Reset to pending
      supabaseAdmin.from
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "del-1", status: "pending" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        // deliverWebhook: fetch delivery
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "del-1",
                  attempt_count: 0,
                  max_attempts: 5,
                  payload: { event: "test" },
                  webhooks: {
                    id: "wh-1",
                    url: "https://example.com/hook",
                    secret: "whsec_abc",
                    status: "active",
                  },
                },
                error: null,
              }),
            }),
          }),
        })
        // Update to delivered
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Update webhook
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      });

      const result = await retryDelivery("del-1");
      expect(result.success).toBe(true);
    });
  });
});

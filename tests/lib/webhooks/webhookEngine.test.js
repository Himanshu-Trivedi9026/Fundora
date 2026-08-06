/**
 * Webhook Engine Tests — Unit tests for webhook management and triggering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhooks,
  triggerWebhook,
  testWebhook,
  signPayload,
  verifySignature,
  WEBHOOK_EVENTS,
} from "../../../lib/webhooks/webhookEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("WebhookEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWebhook", () => {
    it("should create a webhook and return secret", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "wh-1", url: "https://example.com/hook", secret: "whsec_abc" },
              error: null,
            }),
          }),
        }),
      });

      const result = await createWebhook({
        userId: "user-1",
        url: "https://example.com/hook",
        events: ["donation.received"],
      });

      expect(result.success).toBe(true);
      expect(result.data.secret).toBeDefined();
      expect(result.data.secret.startsWith("whsec_")).toBe(true);
    });

    it("should fail without required fields", async () => {
      const result = await createWebhook({ url: "https://example.com" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid events", async () => {
      const result = await createWebhook({
        userId: "user-1",
        url: "https://example.com",
        events: ["invalid.event"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid events");
    });
  });

  describe("deleteWebhook", () => {
    it("should delete own webhook", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await deleteWebhook("wh-1", "user-1");
      expect(result.success).toBe(true);
    });

    it("should reject deleting other user's webhook", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { user_id: "other-user" }, error: null }),
          }),
        }),
      });

      const result = await deleteWebhook("wh-1", "user-1");
      expect(result.success).toBe(false);
    });
  });

  describe("triggerWebhook", () => {
    it("should create delivery records for matching webhooks", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "wh-1", secret: "whsec_abc", events: ["donation.received"] },
                  { id: "wh-2", secret: "whsec_def", events: ["donation.received", "campaign.created"] },
                ],
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: "del-1" }, { id: "del-2" }],
              error: null,
            }),
          }),
        })
        // Update last_triggered_at for wh-1
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Update last_triggered_at for wh-2
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const result = await triggerWebhook({
        organizationId: "org-1",
        eventType: "donation.received",
        payload: { amount: 100 },
      });

      expect(result.success).toBe(true);
      expect(result.data.delivered).toBe(2);
    });

    it("should return 0 when no matching webhooks", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await triggerWebhook({
        eventType: "donation.received",
        payload: {},
      });

      expect(result.success).toBe(true);
      expect(result.data.delivered).toBe(0);
    });
  });

  describe("signPayload / verifySignature", () => {
    it("should sign and verify a payload", () => {
      const payload = { event: "test", data: { id: 1 } };
      const secret = "test-secret";

      const signature = signPayload(payload, secret);
      expect(signature).toHaveLength(64); // HMAC-SHA256 hex

      const valid = verifySignature(payload, signature, secret);
      expect(valid).toBe(true);

      const invalid = verifySignature(payload, "wrong-sig", secret);
      expect(invalid).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have valid webhook events", () => {
      expect(WEBHOOK_EVENTS.DONATION_RECEIVED).toBe("donation.received");
      expect(WEBHOOK_EVENTS.ESCROW_FUNDED).toBe("escrow.funded");
      expect(WEBHOOK_EVENTS.MILESTONE_APPROVED).toBe("milestone.approved");
    });
  });
});

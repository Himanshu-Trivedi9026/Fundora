/**
 * Webhook Engine — Register, manage, and trigger webhooks.
 *
 * Webhooks deliver signed payloads to external endpoints when events occur.
 * Uses HMAC-SHA256 for payload signing. Failed deliveries retry with
 * exponential backoff (1min, 5min, 30min, 2hr, 12hr).
 */

import { createHmac, randomBytes } from "crypto";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Constants ──────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = {
  VERIFICATION_COMPLETED: "verification.completed",
  VERIFICATION_FAILED: "verification.failed",
  DONATION_RECEIVED: "donation.received",
  DONATION_FAILED: "donation.failed",
  ESCROW_FUNDED: "escrow.funded",
  ESCROW_RELEASED: "escrow.released",
  ESCROW_REFUNDED: "escrow.refunded",
  MILESTONE_SUBMITTED: "milestone.submitted",
  MILESTONE_APPROVED: "milestone.approved",
  MILESTONE_REJECTED: "milestone.rejected",
  FRAUD_ALERT: "fraud.alert",
  COMPLIANCE_ALERT: "compliance.alert",
  CAMPAIGN_CREATED: "campaign.created",
  CAMPAIGN_FUNDED: "campaign.funded",
  CAMPAIGN_COMPLETED: "campaign.completed",
  PAYOUT_COMPLETED: "payout.completed",
  MEMBER_ADDED: "member.added",
  MEMBER_REMOVED: "member.removed",
};

export const WEBHOOK_STATUSES = ["active", "inactive", "failed"];

export const DELIVERY_STATUSES = ["pending", "delivered", "failed", "retrying"];

// Exponential backoff delays in milliseconds
const RETRY_DELAYS = [
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  12 * 60 * 60 * 1000, // 12 hours
];

// ─── Signing ────────────────────────────────────────────────────────

/**
 * Sign a payload using HMAC-SHA256.
 */
export function signPayload(payload, secret) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Verify an HMAC-SHA256 signature.
 */
export function verifySignature(payload, signature, secret) {
  const expected = signPayload(payload, secret);
  return expected === signature;
}

// ─── Helpers ────────────────────────────────────────────────────────

function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Create a new webhook. Secret is returned only on creation.
 */
export async function createWebhook({
  userId,
  organizationId,
  url,
  events = [],
  description,
}) {
  try {
    if (!userId || !url) {
      return { success: false, error: "userId and url are required" };
    }

    // Validate events
    const allEvents = Object.values(WEBHOOK_EVENTS);
    const invalidEvents = events.filter((e) => !allEvents.includes(e));
    if (invalidEvents.length > 0) {
      return {
        success: false,
        error: `Invalid events: ${invalidEvents.join(", ")}`,
      };
    }

    const secret = generateWebhookSecret();

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .insert({
        user_id: userId,
        organization_id: organizationId || null,
        url,
        secret,
        events,
        description,
      })
      .select()
      .single();

    if (error) {
      logError("Webhook", "createWebhook insert error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "webhook_created",
      entityType: "webhook",
      entityId: data.id,
      userId,
      details: { url, events },
    });

    logInfo("Webhook", "Webhook created", { webhookId: data.id, url, userId });

    return { success: true, data: { ...data, secret } };
  } catch (err) {
    logError("Webhook", "createWebhook unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Update a webhook.
 */
export async function updateWebhook(webhookId, updates, userId) {
  try {
    if (!webhookId || !updates || !userId) {
      return {
        success: false,
        error: "webhookId, updates, and userId are required",
      };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("webhooks")
      .select("user_id")
      .eq("id", webhookId)
      .single();

    if (!existing || existing.user_id !== userId) {
      return {
        success: false,
        error: "Webhook not found or not owned by user",
      };
    }

    // Validate events if provided
    if (updates.events) {
      const allEvents = Object.values(WEBHOOK_EVENTS);
      const invalidEvents = updates.events.filter(
        (e) => !allEvents.includes(e),
      );
      if (invalidEvents.length > 0) {
        return {
          success: false,
          error: `Invalid events: ${invalidEvents.join(", ")}`,
        };
      }
    }

    const allowedFields = ["url", "events", "description", "status"];
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .update(sanitized)
      .eq("id", webhookId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Webhook", "updateWebhook unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Delete a webhook.
 */
export async function deleteWebhook(webhookId, userId) {
  try {
    if (!webhookId || !userId) {
      return { success: false, error: "webhookId and userId are required" };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("webhooks")
      .select("user_id")
      .eq("id", webhookId)
      .single();

    if (!existing || existing.user_id !== userId) {
      return {
        success: false,
        error: "Webhook not found or not owned by user",
      };
    }

    const { error } = await supabaseAdmin
      .from("webhooks")
      .delete()
      .eq("id", webhookId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logError("Webhook", "deleteWebhook unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List webhooks for an organization or user.
 */
export async function getWebhooks({
  organizationId,
  userId,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("webhooks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (organizationId) query = query.eq("organization_id", organizationId);
    if (userId) query = query.eq("user_id", userId);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("Webhook", "getWebhooks unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Trigger webhooks for a specific event type.
 * Creates pending deliveries for all matching active webhooks.
 */
export async function triggerWebhook({ organizationId, eventType, payload }) {
  try {
    if (!eventType) {
      return { success: false, error: "eventType is required" };
    }

    // Query matching active webhooks
    let query = supabaseAdmin
      .from("webhooks")
      .select("id, secret, events")
      .eq("status", "active");

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data: webhooks, error: queryErr } = await query;

    if (queryErr) {
      logError("Webhook", "triggerWebhook query error", {
        error: queryErr.message,
      });
      return { success: false, error: queryErr.message };
    }

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = (webhooks || []).filter(
      (wh) => wh.events && wh.events.includes(eventType),
    );

    if (matchingWebhooks.length === 0) {
      return { success: true, data: { delivered: 0 } };
    }

    // Create delivery records
    const deliveries = matchingWebhooks.map((wh) => ({
      webhook_id: wh.id,
      event_type: eventType,
      payload,
      status: "pending",
      attempt_count: 0,
      max_attempts: 5,
    }));

    const { data: deliveryData, error: insertErr } = await supabaseAdmin
      .from("webhook_deliveries")
      .insert(deliveries)
      .select();

    if (insertErr) {
      logError("Webhook", "triggerWebhook insert error", {
        error: insertErr.message,
      });
      return { success: false, error: insertErr.message };
    }

    // Update webhooks' last_triggered_at
    for (const wh of matchingWebhooks) {
      await supabaseAdmin
        .from("webhooks")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", wh.id);
    }

    logInfo("Webhook", "Webhooks triggered", {
      eventType,
      webhookCount: matchingWebhooks.length,
      deliveryCount: deliveryData?.length || 0,
    });

    return {
      success: true,
      data: {
        delivered: deliveryData?.length || 0,
        deliveryIds: (deliveryData || []).map((d) => d.id),
      },
    };
  } catch (err) {
    logError("Webhook", "triggerWebhook unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Send a test ping event to a webhook.
 */
export async function testWebhook(webhookId, userId) {
  try {
    if (!webhookId || !userId) {
      return { success: false, error: "webhookId and userId are required" };
    }

    // Get the webhook
    const { data: webhook, error: fetchErr } = await supabaseAdmin
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .eq("user_id", userId)
      .single();

    if (fetchErr || !webhook) {
      return { success: false, error: "Webhook not found" };
    }

    // Create a test delivery
    const testPayload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook delivery" },
    };

    const { data: delivery, error: insertErr } = await supabaseAdmin
      .from("webhook_deliveries")
      .insert({
        webhook_id: webhookId,
        event_type: "test.ping",
        payload: testPayload,
        status: "pending",
        attempt_count: 0,
        max_attempts: 1,
      })
      .select()
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    // Deliver it
    const result = await deliverWebhook(delivery.id);

    return result;
  } catch (err) {
    logError("Webhook", "testWebhook unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

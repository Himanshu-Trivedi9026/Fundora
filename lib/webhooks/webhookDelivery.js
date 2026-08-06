/**
 * Webhook Delivery Engine — Execute, retry, and manage webhook deliveries.
 *
 * Deliveries are retried with exponential backoff:
 * 1min → 5min → 30min → 2hr → 12hr
 * After max_attempts, the delivery is marked failed and the webhook's
 * failure_count is incremented. If failure_count >= 10, the webhook is disabled.
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { signPayload } from "./webhookEngine.js";

const RETRY_DELAYS_MS = [
  60 * 1000,          // 1 minute
  5 * 60 * 1000,      // 5 minutes
  30 * 60 * 1000,     // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  12 * 60 * 60 * 1000, // 12 hours
];

const MAX_WEBHOOK_FAILURES = 10;
const DELIVERY_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Deliver a single webhook delivery.
 * Signs the payload, POSTs to the webhook URL, and updates delivery status.
 */
export async function deliverWebhook(deliveryId) {
  try {
    if (!deliveryId) {
      return { success: false, error: "deliveryId is required" };
    }

    // Fetch delivery with webhook info
    const { data: delivery, error: fetchErr } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("*, webhooks!inner(id, url, secret, status)")
      .eq("id", deliveryId)
      .single();

    if (fetchErr || !delivery) {
      logError("WebhookDelivery", "deliverWebhook fetch error", {
        error: fetchErr?.message || "Delivery not found",
      });
      return { success: false, error: "Delivery not found" };
    }

    const webhook = delivery.webhooks;

    // Don't deliver if webhook is inactive/failed
    if (webhook.status !== "active") {
      return { success: false, error: "Webhook is not active" };
    }

    // Sign the payload
    const signature = signPayload(delivery.payload, webhook.secret);

    // Update attempt count
    const newAttemptCount = delivery.attempt_count + 1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fundora-Signature": signature,
          "X-Fundora-Event": delivery.event_type,
          "X-Fundora-Delivery-Id": deliveryId,
          "User-Agent": "Fundora-Webhook/1.0",
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
        // Success
        await supabaseAdmin
          .from("webhook_deliveries")
          .update({
            status: "delivered",
            attempt_count: newAttemptCount,
            response_status: response.status,
            response_body: responseBody.substring(0, 1000),
            delivered_at: new Date().toISOString(),
          })
          .eq("id", deliveryId);

        // Update webhook success timestamp
        await supabaseAdmin
          .from("webhooks")
          .update({ last_success_at: new Date().toISOString() })
          .eq("id", webhook.id);

        logInfo("WebhookDelivery", "Delivery successful", {
          deliveryId,
          webhookId: webhook.id,
          status: response.status,
        });

        return { success: true, data: { status: "delivered", statusCode: response.status } };
      }

      // Non-2xx response — schedule retry
      throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
    } catch (fetchError) {
      // Delivery failed — handle retry
      const errorMessage = fetchError.message || "Unknown error";

      if (newAttemptCount >= delivery.max_attempts) {
        // Max attempts reached — mark as failed
        await supabaseAdmin
          .from("webhook_deliveries")
          .update({
            status: "failed",
            attempt_count: newAttemptCount,
            error_message: errorMessage,
          })
          .eq("id", deliveryId);

        // Increment webhook failure count
        const { data: wh } = await supabaseAdmin
          .from("webhooks")
          .select("failure_count")
          .eq("id", webhook.id)
          .single();

        const newFailureCount = (wh?.failure_count || 0) + 1;

        await supabaseAdmin
          .from("webhooks")
          .update({
            failure_count: newFailureCount,
            last_error: errorMessage,
            status: newFailureCount >= MAX_WEBHOOK_FAILURES ? "failed" : webhook.status,
          })
          .eq("id", webhook.id);

        if (newFailureCount >= MAX_WEBHOOK_FAILURES) {
          logWarn("WebhookDelivery", "Webhook disabled due to excessive failures", {
            webhookId: webhook.id,
            failureCount: newFailureCount,
          });
        }

        logWarn("WebhookDelivery", "Delivery failed after max attempts", {
          deliveryId,
          attempts: newAttemptCount,
          error: errorMessage,
        });

        return { success: false, error: errorMessage };
      }

      // Schedule retry with exponential backoff
      const retryDelay = RETRY_DELAYS_MS[Math.min(newAttemptCount, RETRY_DELAYS_MS.length - 1)];
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

      await supabaseAdmin
        .from("webhook_deliveries")
        .update({
          status: "retrying",
          attempt_count: newAttemptCount,
          error_message: errorMessage,
          next_retry_at: nextRetryAt,
        })
        .eq("id", deliveryId);

      logInfo("WebhookDelivery", "Delivery scheduled for retry", {
        deliveryId,
        attempt: newAttemptCount,
        nextRetryAt,
      });

      return { success: true, data: { status: "retrying", nextRetryAt } };
    }
  } catch (err) {
    logError("WebhookDelivery", "deliverWebhook unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Retry a failed delivery.
 */
export async function retryDelivery(deliveryId) {
  try {
    if (!deliveryId) {
      return { success: false, error: "deliveryId is required" };
    }

    // Reset the delivery to pending
    const { data, error } = await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        status: "pending",
        error_message: null,
        next_retry_at: null,
      })
      .eq("id", deliveryId)
      .eq("status", "failed")
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: "Delivery not found or not in failed state" };
    }

    // Deliver it
    return await deliverWebhook(deliveryId);
  } catch (err) {
    logError("WebhookDelivery", "retryDelivery unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get deliveries for a webhook.
 */
export async function getWebhookDeliveries(webhookId, { status, limit = 50, offset = 0 } = {}) {
  try {
    if (!webhookId) {
      return { success: false, error: "webhookId is required" };
    }

    let query = supabaseAdmin
      .from("webhook_deliveries")
      .select("*", { count: "exact" })
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("WebhookDelivery", "getWebhookDeliveries unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get all pending deliveries that need retry.
 */
export async function getPendingRetries() {
  try {
    const { data, error } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("id")
      .eq("status", "retrying")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("WebhookDelivery", "getPendingRetries unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

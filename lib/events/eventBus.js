// Event Bus — central publish/subscribe event system
// Supports priorities, retry, dead-letter queue, correlation IDs

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logError } from "../verification/secureLogger.js";

const _handlers = new Map();
const _dlq = [];
const PRIORITY_LEVELS = { LOW: 1, NORMAL: 5, HIGH: 8, CRITICAL: 10 };

export async function publish(eventType, payload, options = {}) {
  try {
    const event = {
      event_type: eventType,
      source: options.source || "fundora",
      source_id: options.sourceId || null,
      payload,
      priority: options.priority || PRIORITY_LEVELS.NORMAL,
      correlation_id: options.correlationId || null,
      causation_id: options.causationId || null,
      organization_id: options.organizationId || null,
      metadata: options.metadata || {},
      scheduled_at: options.scheduledAt || null,
      produced_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("event_bus")
      .insert(event)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Process inline handlers
    await processEventHandlers(data);

    return { success: true, data: { eventId: data.id, eventType } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function publishBulk(events) {
  const results = await Promise.all(
    events.map((e) => publish(e.eventType, e.payload, e.options || {})),
  );

  return {
    success: results.every((r) => r.success),
    data: results.map((r) => r.data || r.error),
  };
}

export function subscribe(eventType, handler, options = {}) {
  if (!_handlers.has(eventType)) {
    _handlers.set(eventType, []);
  }

  const handlerId = `handler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  _handlers.get(eventType).push({
    id: handlerId,
    handler,
    filterExpression: options.filter || null,
    priority: options.priority || 0,
  });

  return handlerId;
}

export function unsubscribe(eventType, handlerId) {
  if (!_handlers.has(eventType)) return false;
  const handlers = _handlers.get(eventType);
  const index = handlers.findIndex((h) => h.id === handlerId);
  if (index === -1) return false;
  handlers.splice(index, 1);
  return true;
}

async function processEventHandlers(event) {
  const handlers = _handlers.get(event.event_type) || [];

  // Sort by priority (highest first)
  handlers.sort((a, b) => b.priority - a.priority);

  for (const { handler, filterExpression } of handlers) {
    try {
      // Apply filter
      if (filterExpression) {
        const matches = evaluateFilter(filterExpression, event.payload);
        if (!matches) continue;
      }

      await handler(event);
    } catch (err) {
      logError("Event handler failed", {
        eventType: event.event_type,
        error: err.message,
      });

      // Send to DLQ
      _dlq.push({
        event,
        handlerError: err.message,
        timestamp: new Date().toISOString(),
      });

      // Update DB
      await handleFailedEvent(event.id, err.message);
    }
  }
}

function evaluateFilter(expression, payload) {
  try {
    for (const [key, value] of Object.entries(expression)) {
      const keys = key.split(".");
      let current = payload;
      for (const k of keys) {
        current = current?.[k];
      }
      if (current !== value) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function handleFailedEvent(eventId, errorMessage) {
  try {
    const { data: event } = await supabaseAdmin
      .from("event_bus")
      .select("retry_count, max_retries")
      .eq("id", eventId)
      .single();

    if (event) {
      const retryCount = (event.retry_count || 0) + 1;
      const maxRetries = event.max_retries || 3;

      if (retryCount >= maxRetries) {
        await supabaseAdmin
          .from("event_bus")
          .update({
            status: "dead_letter",
            retry_count: retryCount,
            last_error: errorMessage,
            processed_at: new Date().toISOString(),
          })
          .eq("id", eventId);
      } else {
        // Schedule retry with backoff
        const backoffMs = Math.pow(2, retryCount) * 1000;
        await supabaseAdmin
          .from("event_bus")
          .update({
            status: "pending",
            retry_count: retryCount,
            last_error: errorMessage,
            scheduled_at: new Date(Date.now() + backoffMs).toISOString(),
          })
          .eq("id", eventId);
      }
    }
  } catch (err) {
    logError("Failed to update event status", { eventId, error: err.message });
  }
}

export async function processDeadLetterQueue() {
  try {
    const { data: events } = await supabaseAdmin
      .from("event_bus")
      .select("*")
      .eq("status", "dead_letter")
      .limit(50);

    for (const event of events || []) {
      // Retry with backoff
      await supabaseAdmin
        .from("event_bus")
        .update({
          status: "pending",
          retry_count: 0,
          last_error: null,
          scheduled_at: new Date(Date.now() + 60000).toISOString(),
        })
        .eq("id", event.id);
    }

    return { success: true, data: { requeued: (events || []).length } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function processScheduledEvents() {
  try {
    const now = new Date().toISOString();

    const { data: events, error } = await supabaseAdmin
      .from("event_bus")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("priority", { ascending: false })
      .limit(100);

    if (error) return { success: false, error: error.message };

    for (const event of events || []) {
      await supabaseAdmin
        .from("event_bus")
        .update({ status: "processing" })
        .eq("id", event.id);

      await processEventHandlers(event);

      await supabaseAdmin
        .from("event_bus")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
    }

    return { success: true, data: { processed: (events || []).length } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function queryEvents(options = {}) {
  try {
    let query = supabaseAdmin.from("event_bus").select("*", { count: "exact" });

    if (options.eventType) query = query.eq("event_type", options.eventType);
    if (options.status) query = query.eq("status", options.status);
    if (options.correlationId)
      query = query.eq("correlation_id", options.correlationId);

    query = query.order("produced_at", { ascending: false });

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createSubscription(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("event_subscriptions")
      .insert({
        name: options.name,
        description: options.description || "",
        event_types: options.eventTypes || [],
        target_url: options.targetUrl || null,
        target_type: options.targetType || "internal",
        filter_expression: options.filter || {},
        retry_policy: options.retryPolicy || { maxRetries: 3, backoffMs: 1000 },
        created_by: options.createdBy || null,
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listSubscriptions(options = {}) {
  try {
    let query = supabaseAdmin
      .from("event_subscriptions")
      .select("*", { count: "exact" });
    if (options.organizationId)
      query = query.eq("organization_id", options.organizationId);
    query = query.order("created_at", { ascending: false });

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getDeadLetterQueue() {
  return [..._dlq];
}

export function clearDeadLetterQueue() {
  _dlq.length = 0;
  return { success: true };
}

export const EVENT_PRIORITIES = PRIORITY_LEVELS;

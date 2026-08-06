/**
 * Escrow Events — Records and queries escrow-related audit events.
 *
 * Every significant escrow operation is recorded to escrow_events table
 * for full auditability. Events are append-only.
 *
 * Event types:
 *   - account.created, account.status_changed, account.frozen, account.unfrozen, account.closed
 *   - fund.deposited, fund.released, fund.refunded, fund.scheduled
 *   - milestone.submitted, milestone.approved, milestone.rejected
 *   - payout.requested, payout.processed, payout.completed, payout.failed
 *   - settlement.batch_created, settlement.batch_processed
 *   - emergency.freeze, emergency.cancel
 *
 * Security:
 *   - All events are immutable after creation
 *   - Uses secureLogger for all logging
 *   - Sensitive details are sanitized before storage
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";

// ─── Core Functions ───

/**
 * Record an escrow event.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.campaignId — Campaign ID
 * @param {string} [params.userId] — User ID performing the action
 * @param {string} params.eventType — Event type (e.g., 'fund.released', 'account.frozen')
 * @param {string} [params.entityType] — Related entity type (e.g., 'milestone', 'donation', 'payout_request')
 * @param {string} [params.entityId] — Related entity ID
 * @param {string} [params.oldStatus] — Previous status (if status changed)
 * @param {string} [params.newStatus] — New status (if status changed)
 * @param {Object} [params.details] — Event details (sanitized before storage)
 * @param {string} [params.performedBy] — User ID of the actor
 * @param {string} [params.performedByType] — Actor type: 'user' | 'system' | 'admin'
 * @returns {Promise<{success: boolean, event?: Object, error?: string}>}
 */
export async function recordEscrowEvent({
  escrowAccountId,
  campaignId,
  userId,
  eventType,
  entityType = null,
  entityId = null,
  oldStatus = null,
  newStatus = null,
  details = {},
  performedBy = null,
  performedByType = "user",
}) {
  try {
    if (!escrowAccountId || !campaignId || !eventType) {
      return {
        success: false,
        error: "escrowAccountId, campaignId, and eventType are required",
      };
    }

    // Sanitize details
    const sanitizedDetails = sanitizeDetails(details);

    const { data, error } = await supabaseAdmin
      .from("escrow_events")
      .insert({
        escrow_account_id: escrowAccountId,
        campaign_id: campaignId,
        user_id: userId || null,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        old_status: oldStatus,
        new_status: newStatus,
        details: sanitizedDetails,
        performed_by: performedBy,
        performed_by_type: performedByType,
      })
      .select()
      .single();

    if (error) {
      logError("EscrowEvents", "Record error", {
        error: error.message,
        escrowAccountId,
      });
      return { success: false, error: "Failed to record escrow event" };
    }

    logInfo("EscrowEvents", "Event recorded", {
      eventId: data.id,
      escrowAccountId,
      eventType,
      oldStatus,
      newStatus,
    });

    return { success: true, event: data };
  } catch (err) {
    logError("EscrowEvents", "Record error", { error: err.message });
    return { success: false, error: "Failed to record escrow event" };
  }
}

/**
 * Query escrow events with filters.
 *
 * @param {Object} params
 * @param {string} [params.escrowAccountId] — Filter by escrow account
 * @param {string} [params.campaignId] — Filter by campaign
 * @param {string} [params.entityType] — Filter by entity type
 * @param {string} [params.eventType] — Filter by event type
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @param {string} [params.startDate] — Filter events after this date
 * @param {string} [params.endDate] — Filter events before this date
 * @returns {Promise<{success: boolean, events?: Object[], total?: number, error?: string}>}
 */
export async function getEscrowEvents({
  escrowAccountId,
  campaignId,
  entityType,
  eventType,
  limit = 50,
  offset = 0,
  startDate,
  endDate,
} = {}) {
  try {
    if (!escrowAccountId && !campaignId) {
      return {
        success: false,
        error: "At least one of escrowAccountId or campaignId is required",
      };
    }

    let query = supabaseAdmin
      .from("escrow_events")
      .select("*", { count: "exact" });

    if (escrowAccountId) {
      query = query.eq("escrow_account_id", escrowAccountId);
    }

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("EscrowEvents", "Query error", { error: error.message });
      return { success: false, error: "Failed to query escrow events" };
    }

    return {
      success: true,
      events: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("EscrowEvents", "Query error", { error: err.message });
    return { success: false, error: "Failed to query escrow events" };
  }
}

/**
 * Get aggregated event stats for a campaign.
 *
 * @param {string} campaignId — Campaign ID
 * @param {number} [days=30] — Number of days to look back
 * @returns {Promise<{success: boolean, summary?: Object, error?: string}>}
 */
export async function getEscrowEventSummary(campaignId, days = 30) {
  try {
    if (!campaignId) {
      return { success: false, error: "Campaign ID is required" };
    }

    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("escrow_events")
      .select("event_type, entity_type, performed_by_type, created_at")
      .eq("campaign_id", campaignId)
      .gte("created_at", startDate);

    if (error) {
      logError("EscrowEvents", "Summary query error", {
        error: error.message,
        campaignId,
      });
      return { success: false, error: "Failed to fetch event summary" };
    }

    const events = data || [];
    const summary = {
      totalEvents: events.length,
      byEventType: {},
      byEntityType: {},
      byActorType: {},
      recentEventTypes: {},
    };

    events.forEach((event) => {
      // By event type
      summary.byEventType[event.event_type] =
        (summary.byEventType[event.event_type] || 0) + 1;

      // By entity type
      if (event.entity_type) {
        summary.byEntityType[event.entity_type] =
          (summary.byEntityType[event.entity_type] || 0) + 1;
      }

      // By actor type
      if (event.performed_by_type) {
        summary.byActorType[event.performed_by_type] =
          (summary.byActorType[event.performed_by_type] || 0) + 1;
      }
    });

    // Sort byEventType by count descending, take top 10
    summary.recentEventTypes = Object.entries(summary.byEventType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

    return { success: true, summary };
  } catch (err) {
    logError("EscrowEvents", "Summary error", { error: err.message });
    return { success: false, error: "Failed to fetch event summary" };
  }
}

// ─── Helpers ───

/**
 * Sanitize details before storage — remove sensitive fields.
 * @param {Object} details
 * @returns {Object}
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== "object") return {};

  const safe = { ...details };
  delete safe.ip_address;
  delete safe.session_token;
  delete safe.encryption_key;
  delete safe.api_key;
  delete safe.secret;
  delete safe.password;
  delete safe.raw_response;
  delete safe.provider_reference;

  return safe;
}

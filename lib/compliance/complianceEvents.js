/**
 * Compliance Events — Audit trail for compliance actions.
 *
 * Records every compliance-related action for full auditability.
 * Events are append-only: no UPDATE, no DELETE by application.
 *
 * Security:
 *   - All IPs are hashed via hashIP before storage
 *   - Uses secureLogger for all logging
 *   - Sensitive details are sanitized before storage
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { hashIP } from "../verification/auditLog";

// ─── Constants ───

/**
 * Valid compliance event types.
 * @type {string[]}
 */
export const COMPLIANCE_EVENT_TYPES = [
  "case.created",
  "case.updated",
  "case.status_changed",
  "case.assigned",
  "case.reassigned",
  "case.resolved",
  "case.reopened",
  "case.escalated",
  "case.closed",
  "evidence.added",
  "evidence.removed",
  "note.added",
  "review.submitted",
  "review.completed",
  "action.taken",
  "flag.raised",
  "flag.cleared",
];

// ─── Helpers ───

/**
 * Sanitize details before storage — remove sensitive fields.
 *
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
  delete safe.otp;
  delete safe.otp_hash;

  return safe;
}

// ─── Core Functions ───

/**
 * Record a compliance event.
 *
 * @param {Object} params
 * @param {string} params.complianceCaseId — Compliance case ID
 * @param {string} params.eventType — Event type from COMPLIANCE_EVENT_TYPES
 * @param {string} [params.entityType] — Related entity type (e.g., 'user', 'campaign', 'document')
 * @param {string} [params.entityId] — Related entity ID
 * @param {string} [params.userId] — User ID being acted upon
 * @param {string} params.action — Granular action name
 * @param {string} [params.oldStatus] — Previous status (if status changed)
 * @param {string} [params.newStatus] — New status (if status changed)
 * @param {Object} [params.details] — Event details (sanitized before storage)
 * @param {string} [params.performedBy] — User ID of the actor
 * @param {string} [params.performedByType='admin'] — Actor type: 'user' | 'system' | 'admin'
 * @param {string} [params.ipAddress] — Raw IP address (hashed before storage)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function recordComplianceEvent({
  complianceCaseId,
  eventType,
  entityType,
  entityId,
  userId,
  action,
  oldStatus,
  newStatus,
  details = {},
  performedBy,
  performedByType = "admin",
  ipAddress,
}) {
  try {
    if (!complianceCaseId || !eventType || !action) {
      return {
        success: false,
        error: "complianceCaseId, eventType, and action are required",
      };
    }

    // Hash IP address
    const ipAddressHash = ipAddress ? hashIP(ipAddress) : null;

    // Sanitize details
    const sanitizedDetails = sanitizeDetails(details);

    const { data, error } = await supabaseAdmin
      .from("compliance_events")
      .insert({
        compliance_case_id: complianceCaseId,
        event_type: eventType,
        entity_type: entityType || null,
        entity_id: entityId || null,
        user_id: userId || null,
        action,
        old_status: oldStatus || null,
        new_status: newStatus || null,
        details: sanitizedDetails,
        performed_by: performedBy || null,
        performed_by_type: performedByType,
        ip_address_hash: ipAddressHash,
      })
      .select()
      .single();

    if (error) {
      logError("ComplianceEvents", "Record error", { error: error.message, complianceCaseId });
      return { success: false, error: "Failed to record compliance event" };
    }

    logInfo("ComplianceEvents", "Event recorded", {
      eventId: data.id,
      complianceCaseId,
      eventType,
      action,
      oldStatus,
      newStatus,
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEvents", "Record error", { error: err.message });
    return { success: false, error: "Failed to record compliance event" };
  }
}

/**
 * Query compliance events with filters.
 *
 * @param {Object} params
 * @param {string} [params.complianceCaseId] — Filter by compliance case
 * @param {string} [params.entityType] — Filter by entity type
 * @param {string} [params.entityId] — Filter by entity ID
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, data?: Object[], total?: number, error?: string}>}
 */
export async function getComplianceEvents({
  complianceCaseId,
  entityType,
  entityId,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("compliance_events")
      .select("*", { count: "exact" });

    if (complianceCaseId) {
      query = query.eq("compliance_case_id", complianceCaseId);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ComplianceEvents", "Query error", { error: error.message });
      return { success: false, error: "Failed to query compliance events" };
    }

    return {
      success: true,
      data: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("ComplianceEvents", "Query error", { error: err.message });
    return { success: false, error: "Failed to query compliance events" };
  }
}

/**
 * Get aggregated event stats for a compliance case.
 *
 * @param {string} complianceCaseId — Compliance case ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getComplianceEventSummary(complianceCaseId) {
  try {
    if (!complianceCaseId) {
      return { success: false, error: "complianceCaseId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_events")
      .select("event_type, action, entity_type, performed_by_type, created_at")
      .eq("compliance_case_id", complianceCaseId);

    if (error) {
      logError("ComplianceEvents", "Summary query error", { error: error.message, complianceCaseId });
      return { success: false, error: "Failed to fetch event summary" };
    }

    const events = data || [];
    const summary = {
      totalEvents: events.length,
      byEventType: {},
      byAction: {},
      byEntityType: {},
      byActorType: {},
    };

    events.forEach((event) => {
      // By event type
      summary.byEventType[event.event_type] = (summary.byEventType[event.event_type] || 0) + 1;

      // By action
      if (event.action) {
        summary.byAction[event.action] = (summary.byAction[event.action] || 0) + 1;
      }

      // By entity type
      if (event.entity_type) {
        summary.byEntityType[event.entity_type] = (summary.byEntityType[event.entity_type] || 0) + 1;
      }

      // By actor type
      if (event.performed_by_type) {
        summary.byActorType[event.performed_by_type] = (summary.byActorType[event.performed_by_type] || 0) + 1;
      }
    });

    return { success: true, data: summary };
  } catch (err) {
    logError("ComplianceEvents", "Summary error", { error: err.message });
    return { success: false, error: "Failed to fetch event summary" };
  }
}

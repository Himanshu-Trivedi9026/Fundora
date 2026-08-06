/**
 * Verification Audit Log — Comprehensive action logging.
 *
 * Logs every verification action to verification_audit_log table.
 * Append-only: no UPDATE, no DELETE by application.
 *
 * Security:
 *   - Never log raw IPs (only SHA-256 hashed)
 *   - Never log raw document data
 *   - Details are sanitized before storage
 *   - Uses structured logging with automatic redaction
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError } from "./secureLogger";

const crypto = require("crypto");

// ─── Core Functions ───

/**
 * Log an audit event.
 *
 * @param {Object} params
 * @param {string} params.eventType — Event type (e.g., 'verification.submitted')
 * @param {string} params.entityType — Entity type ('verification_request', 'document', 'session', 'otp', 'creator_verification')
 * @param {string} params.entityId — Entity ID
 * @param {string} [params.userId] — User ID
 * @param {string} params.action — Granular action name
 * @param {Object} [params.details] — Sanitized action details
 * @param {string} [params.ipAddressHash] — Hashed IP address
 * @param {string} [params.userAgent] — User agent string
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function logAuditEvent({
  eventType,
  entityType,
  entityId,
  userId,
  action,
  details = {},
  ipAddressHash,
  userAgent,
}) {
  try {
    if (!eventType || !entityType || !entityId || !action) {
      logError("AuditLog", "Missing required fields", {
        eventType,
        entityType,
        entityId,
        action,
      });
      return { success: false, error: "Missing required fields" };
    }

    // Sanitize details — remove sensitive fields
    const sanitizedDetails = sanitizeDetails(details);

    const { data, error } = await supabaseAdmin
      .from("verification_audit_log")
      .insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId || null,
        action,
        details: sanitizedDetails,
        ip_address_hash: ipAddressHash || null,
        user_agent: userAgent || null,
      })
      .select("id")
      .single();

    if (error) {
      logError("AuditLog", "Insert error", { error: error.message });
      return { success: false, error: "Failed to log audit event" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    logError("AuditLog", "Error", { error: err.message });
    return { success: false, error: "Audit logging failed" };
  }
}

/**
 * Query audit log entries with filters.
 * Non-admin users can only query their own entries.
 *
 * @param {Object} params
 * @param {string} [params.entityType] — Filter by entity type
 * @param {string} [params.entityId] — Filter by entity ID
 * @param {string} [params.userId] — Filter by user ID
 * @param {string} [params.action] — Filter by action
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @param {string} [params.requesterId] — ID of the user making the request (enforced)
 * @returns {Promise<{success: boolean, entries?: Object[], total?: number, error?: string}>}
 */
export async function getAuditLog({
  entityType,
  entityId,
  userId,
  action,
  limit = 50,
  offset = 0,
  requesterId,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("verification_audit_log")
      .select("*", { count: "exact" });

    // Enforce ownership: non-admin users can only see their own entries
    if (requesterId) {
      query = query.eq("user_id", requesterId);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);
    if (action) query = query.eq("action", action);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("AuditLog", "Query error", { error: error.message });
      return { success: false, error: "Failed to query audit log" };
    }

    return {
      success: true,
      entries: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("AuditLog", "Query error", { error: err.message });
    return { success: false, error: "Failed to query audit log" };
  }
}

/**
 * Get aggregated audit stats for a user (admin use).
 *
 * @param {string} userId
 * @param {string} [requesterId] — ID of the requester (enforced for non-admins)
 * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
 */
export async function getAuditSummary(userId, requesterId = null) {
  try {
    // Enforce ownership
    const queryUserId = requesterId || userId;

    const { data, error } = await supabaseAdmin
      .from("verification_audit_log")
      .select("action, entity_type")
      .eq("user_id", queryUserId);

    if (error) {
      logError("AuditLog", "Summary error", { error: error.message });
      return { success: false, error: "Failed to get audit summary" };
    }

    // Aggregate by action
    const actionCounts = {};
    const entityCounts = {};

    (data || []).forEach((entry) => {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      entityCounts[entry.entity_type] =
        (entityCounts[entry.entity_type] || 0) + 1;
    });

    return {
      success: true,
      stats: {
        totalEvents: data?.length || 0,
        actionCounts,
        entityCounts,
      },
    };
  } catch (err) {
    logError("AuditLog", "Summary error", { error: err.message });
    return { success: false, error: "Failed to get audit summary" };
  }
}

// ─── Helpers ───

/**
 * Sanitize details object — remove sensitive fields.
 * @param {Object} details
 * @returns {Object}
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== "object") return {};

  const safe = { ...details };
  delete safe.provider_reference;
  delete safe.storage_path;
  delete safe.ip_address;
  delete safe.raw_document;
  delete safe.otp;
  delete safe.otp_hash;
  delete safe.encryption_key;
  delete safe.session_token;
  return safe;
}

/**
 * Hash an IP address using SHA-256 with a salt.
 * @param {string} ip
 * @returns {string} Truncated hex hash (16 chars)
 */
export function hashIP(ip) {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || "fundora-ip-salt-default";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

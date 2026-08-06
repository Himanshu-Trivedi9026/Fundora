/**
 * Fraud Events — Records and queries fraud-related events.
 *
 * Event categories:
 *   - verification, donation, payout, account, campaign, device, behavior, system
 *
 * Security:
 *   - Never exposes raw device fingerprints or provider responses
 *   - All events are audit-logged
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError } from "../verification/secureLogger";
import { hashIP } from "../verification/auditLog";

// ─── Core Functions ───

/**
 * Record a fraud event.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.eventType
 * @param {string} params.eventCategory — 'verification' | 'donation' | 'payout' | 'account' | 'campaign' | 'device' | 'behavior' | 'system'
 * @param {string} [params.severity='info'] — 'info' | 'warning' | 'critical'
 * @param {string} [params.signalName]
 * @param {Object} [params.signalValue]
 * @param {number} [params.riskContribution=0]
 * @param {string[]} [params.ruleIds]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {Object} [params.metadata]
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function recordFraudEvent({
  userId,
  eventType,
  eventCategory,
  severity = "info",
  signalName = null,
  signalValue = {},
  riskContribution = 0,
  ruleIds = [],
  ipAddress,
  userAgent,
  metadata = {},
}) {
  try {
    if (!userId || !eventType || !eventCategory) {
      return { success: false, error: "Missing required fields" };
    }

    const validCategories = ["verification", "donation", "payout", "account", "campaign", "device", "behavior", "system"];
    if (!validCategories.includes(eventCategory)) {
      return { success: false, error: `Invalid event category. Must be: ${validCategories.join(", ")}` };
    }

    const { data, error } = await supabaseAdmin
      .from("fraud_events")
      .insert({
        user_id: userId,
        event_type: eventType,
        event_category: eventCategory,
        severity,
        signal_name: signalName,
        signal_value: signalValue,
        risk_contribution: Math.min(100, Math.max(0, riskContribution)),
        rule_ids: ruleIds,
        ip_address_hash: hashIP(ipAddress),
        user_agent: userAgent || null,
        metadata: sanitizeMetadata(metadata),
      })
      .select("id")
      .single();

    if (error) {
      logError("FraudEvents", "Record error", { error: error.message });
      return { success: false, error: "Failed to record event" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    logError("FraudEvents", "Record error", { error: err.message });
    return { success: false, error: "Failed to record event" };
  }
}

/**
 * Get fraud events for a user.
 *
 * @param {string} userId
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} [params.category]
 * @param {string} [params.severity]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {Promise<{success: boolean, events?: Object[], total?: number, error?: string}>}
 */
export async function getFraudEvents(
  userId,
  { limit = 50, offset = 0, category, severity, startDate, endDate } = {}
) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    let query = supabaseAdmin
      .from("fraud_events")
      .select(
        "id, event_type, event_category, severity, signal_name, risk_contribution, created_at",
        { count: "exact" }
      )
      .eq("user_id", userId);

    if (category) query = query.eq("event_category", category);
    if (severity) query = query.eq("severity", severity);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("FraudEvents", "Query error", { error: error.message });
      return { success: false, error: "Failed to fetch events" };
    }

    return {
      success: true,
      events: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("FraudEvents", "Query error", { error: err.message });
    return { success: false, error: "Failed to fetch events" };
  }
}

/**
 * Get fraud event summary for a user.
 *
 * @param {string} userId
 * @param {number} [days=30]
 * @returns {Promise<{success: boolean, summary?: Object, error?: string}>}
 */
export async function getFraudEventSummary(userId, days = 30) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("fraud_events")
      .select("event_type, event_category, severity, risk_contribution, created_at")
      .eq("user_id", userId)
      .gte("created_at", startDate);

    if (error) {
      logError("FraudEvents", "Summary query error", { error: error.message });
      return { success: false, error: "Failed to fetch summary" };
    }

    const events = data || [];
    const summary = {
      totalEvents: events.length,
      byCategory: {},
      bySeverity: {},
      totalRiskContribution: 0,
      topEventTypes: {},
    };

    events.forEach((event) => {
      summary.byCategory[event.event_category] = (summary.byCategory[event.event_category] || 0) + 1;
      summary.bySeverity[event.severity] = (summary.bySeverity[event.severity] || 0) + 1;
      summary.totalRiskContribution += event.risk_contribution || 0;
      summary.topEventTypes[event.event_type] = (summary.topEventTypes[event.event_type] || 0) + 1;
    });

    // Sort top event types
    summary.topEventTypes = Object.entries(summary.topEventTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

    return { success: true, summary };
  } catch (err) {
    logError("FraudEvents", "Summary error", { error: err.message });
    return { success: false, error: "Failed to fetch summary" };
  }
}

/**
 * Get all fraud events for admin (across all users).
 *
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} [params.category]
 * @param {string} [params.severity]
 * @param {string} [params.userId]
 * @returns {Promise<{success: boolean, events?: Object[], total?: number, error?: string}>}
 */
export async function getAllFraudEvents({ limit = 50, offset = 0, category, severity, userId } = {}) {
  try {
    let query = supabaseAdmin
      .from("fraud_events")
      .select(
        "id, user_id, event_type, event_category, severity, signal_name, risk_contribution, created_at",
        { count: "exact" }
      );

    if (category) query = query.eq("event_category", category);
    if (severity) query = query.eq("severity", severity);
    if (userId) query = query.eq("user_id", userId);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("FraudEvents", "Admin query error", { error: error.message });
      return { success: false, error: "Failed to fetch events" };
    }

    return {
      success: true,
      events: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("FraudEvents", "Admin query error", { error: err.message });
    return { success: false, error: "Failed to fetch events" };
  }
}

// ─── Helpers ───

/**
 * Sanitize metadata before storage — remove sensitive fields.
 * @param {Object} metadata
 * @returns {Object}
 */
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};

  const safe = { ...metadata };
  delete safe.ip_address;
  delete safe.raw_fingerprint;
  delete safe.provider_response;
  delete safe.session_token;
  delete safe.encryption_key;

  return safe;
}

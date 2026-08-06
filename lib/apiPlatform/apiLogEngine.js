/**
 * API Log Engine — Log and query API requests made with API keys.
 *
 * Append-only logging for audit trail and usage analytics.
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logError } from "../verification/secureLogger.js";
import { hashIP } from "../verification/auditLog.js";

/**
 * Log an API request.
 */
export async function logApiRequest({
  apiKeyId,
  userId,
  organizationId,
  method,
  path,
  queryParams,
  requestBodyHash,
  responseStatus,
  responseTimeMs,
  ipAddress,
  userAgent,
  scopeUsed,
  errorMessage,
}) {
  try {
    const { error } = await supabaseAdmin.from("api_logs").insert({
      api_key_id: apiKeyId || null,
      user_id: userId || null,
      organization_id: organizationId || null,
      method: method || "GET",
      path: path || "/",
      query_params: queryParams || {},
      request_body_hash: requestBodyHash || null,
      response_status: responseStatus || 200,
      response_time_ms: responseTimeMs || 0,
      ip_address_hash: ipAddress ? hashIP(ipAddress) : null,
      user_agent: userAgent || null,
      scope_used: scopeUsed || null,
      error_message: errorMessage || null,
    });

    if (error) {
      logError("APILog", "logApiRequest insert error", {
        error: error.message,
      });
    }
  } catch (err) {
    logError("APILog", "logApiRequest unexpected error", {
      error: err.message,
    });
  }
}

/**
 * Query API logs with filters.
 */
export async function getApiLogs({
  apiKeyId,
  userId,
  organizationId,
  method,
  responseStatus,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("api_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (apiKeyId) query = query.eq("api_key_id", apiKeyId);
    if (userId) query = query.eq("user_id", userId);
    if (organizationId) query = query.eq("organization_id", organizationId);
    if (method) query = query.eq("method", method);
    if (responseStatus) query = query.eq("response_status", responseStatus);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("APILog", "getApiLogs unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get API usage summary (counts by day).
 */
export async function getApiUsageSummary({
  apiKeyId,
  organizationId,
  startDate,
  endDate,
  limit = 30,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("api_logs")
      .select("created_at, response_status")
      .order("created_at", { ascending: false })
      .limit(limit * 100); // Fetch enough data for aggregation

    if (apiKeyId) query = query.eq("api_key_id", apiKeyId);
    if (organizationId) query = query.eq("organization_id", organizationId);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // Aggregate by day
    const byDay = {};
    for (const log of data || []) {
      const day = log.created_at.substring(0, 10);
      if (!byDay[day]) {
        byDay[day] = { total: 0, success: 0, errors: 0 };
      }
      byDay[day].total++;
      if (log.response_status >= 200 && log.response_status < 400) {
        byDay[day].success++;
      } else {
        byDay[day].errors++;
      }
    }

    return {
      success: true,
      data: Object.entries(byDay)
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  } catch (err) {
    logError("APILog", "getApiUsageSummary unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

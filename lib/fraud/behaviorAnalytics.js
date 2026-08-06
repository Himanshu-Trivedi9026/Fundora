/**
 * Behavior Analytics — Tracks and analyzes user behavior patterns.
 *
 * Tracks:
 *   - Login patterns (frequency, time of day, device)
 *   - Verification attempts (frequency, success rate)
 *   - Campaign creation (frequency, patterns)
 *   - Donation behavior (frequency, amounts, recipients)
 *   - Document uploads (frequency, types, rejection rate)
 *   - Bank account changes (frequency, patterns)
 *
 * Security:
 *   - Never exposes raw behavior data to frontend
 *   - All analytics are computed server-side
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError, logInfo } from "../verification/secureLogger";
import { hashIP } from "../verification/auditLog";

// ─── Core Functions ───

/**
 * Record a behavior event.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.eventType — Specific event (e.g., 'login', 'donation')
 * @param {string} params.eventCategory — Category ('login' | 'verification' | 'campaign' | 'donation' | 'document' | 'account' | 'profile' | 'session')
 * @param {Object} [params.eventData] — Additional event data
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {string} [params.deviceFingerprintId]
 * @param {string} [params.sessionId]
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function recordBehaviorEvent({
  userId,
  eventType,
  eventCategory,
  eventData = {},
  ipAddress,
  userAgent,
  deviceFingerprintId,
  sessionId,
}) {
  try {
    if (!userId || !eventType || !eventCategory) {
      return { success: false, error: "Missing required fields" };
    }

    const validCategories = ["login", "verification", "campaign", "donation", "document", "account", "profile", "session"];
    if (!validCategories.includes(eventCategory)) {
      return { success: false, error: `Invalid event category. Must be: ${validCategories.join(", ")}` };
    }

    // Calculate initial risk score for the event
    const riskScore = calculateEventRiskScore(eventType, eventCategory, eventData);

    const { data, error } = await supabaseAdmin
      .from("behavior_events")
      .insert({
        user_id: userId,
        event_type: eventType,
        event_category: eventCategory,
        event_data: eventData,
        ip_address_hash: hashIP(ipAddress),
        user_agent: userAgent || null,
        device_fingerprint_id: deviceFingerprintId || null,
        session_id: sessionId || null,
        risk_score: riskScore,
      })
      .select("id")
      .single();

    if (error) {
      logError("BehaviorAnalytics", "Record error", { error: error.message });
      return { success: false, error: "Failed to record event" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    logError("BehaviorAnalytics", "Record error", { error: err.message });
    return { success: false, error: "Failed to record event" };
  }
}

/**
 * Get behavior events for a user.
 *
 * @param {string} userId
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} [params.category]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {Promise<{success: boolean, events?: Object[], total?: number, error?: string}>}
 */
export async function getBehaviorEvents(userId, { limit = 50, offset = 0, category, startDate, endDate } = {}) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    let query = supabaseAdmin
      .from("behavior_events")
      .select(
        "id, event_type, event_category, event_data, risk_score, session_id, created_at",
        { count: "exact" }
      )
      .eq("user_id", userId);

    if (category) query = query.eq("event_category", category);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("BehaviorAnalytics", "Query error", { error: error.message });
      return { success: false, error: "Failed to fetch events" };
    }

    return {
      success: true,
      events: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("BehaviorAnalytics", "Query error", { error: err.message });
    return { success: false, error: "Failed to fetch events" };
  }
}

/**
 * Get behavior summary for a user.
 *
 * @param {string} userId
 * @param {number} [days=30]
 * @returns {Promise<{success: boolean, summary?: Object, error?: string}>}
 */
export async function getBehaviorSummary(userId, days = 30) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("behavior_events")
      .select("event_type, event_category, risk_score, created_at")
      .eq("user_id", userId)
      .gte("created_at", startDate);

    if (error) {
      logError("BehaviorAnalytics", "Summary query error", { error: error.message });
      return { success: false, error: "Failed to fetch summary" };
    }

    const events = data || [];
    const summary = {
      totalEvents: events.length,
      byCategory: {},
      byType: {},
      avgRiskScore: 0,
      highRiskEvents: 0,
      timeline: [],
    };

    let totalRisk = 0;
    events.forEach((event) => {
      summary.byCategory[event.event_category] = (summary.byCategory[event.event_category] || 0) + 1;
      summary.byType[event.event_type] = (summary.byType[event.event_type] || 0) + 1;
      totalRisk += event.risk_score || 0;
      if ((event.risk_score || 0) > 50) summary.highRiskEvents++;
    });

    summary.avgRiskScore = events.length ? Math.round(totalRisk / events.length) : 0;

    // Build daily timeline
    const dailyData = {};
    events.forEach((event) => {
      const date = event.created_at.split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, count: 0, riskSum: 0 };
      }
      dailyData[date].count++;
      dailyData[date].riskSum += event.risk_score || 0;
    });

    summary.timeline = Object.values(dailyData)
      .map((day) => ({
        date: day.date,
        eventCount: day.count,
        avgRiskScore: Math.round(day.riskSum / day.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, summary };
  } catch (err) {
    logError("BehaviorAnalytics", "Summary error", { error: err.message });
    return { success: false, error: "Failed to fetch summary" };
  }
}

/**
 * Detect behavioral anomalies for a user.
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, anomalies?: Object[], error?: string}>}
 */
export async function detectBehaviorAnomalies(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const anomalies = [];

    // Check for unusual login times
    const loginAnomaly = await checkLoginAnomaly(userId);
    if (loginAnomaly) anomalies.push(loginAnomaly);

    // Check for rapid activity
    const activityAnomaly = await checkRapidActivity(userId);
    if (activityAnomaly) anomalies.push(activityAnomaly);

    // Check for verification spam
    const verificationAnomaly = await checkVerificationSpam(userId);
    if (verificationAnomaly) anomalies.push(verificationAnomaly);

    // Check for bank change pattern
    const bankAnomaly = await checkBankChangePattern(userId);
    if (bankAnomaly) anomalies.push(bankAnomaly);

    return { success: true, anomalies };
  } catch (err) {
    logError("BehaviorAnalytics", "Anomaly detection error", { error: err.message });
    return { success: false, error: "Failed to detect anomalies" };
  }
}

/**
 * Get login pattern analysis for a user.
 *
 * @param {string} userId
 * @param {number} [days=30]
 * @returns {Promise<{success: boolean, patterns?: Object, error?: string}>}
 */
export async function getLoginPatterns(userId, days = 30) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("behavior_events")
      .select("event_data, created_at")
      .eq("user_id", userId)
      .eq("event_type", "login")
      .gte("created_at", startDate)
      .order("created_at", { ascending: true });

    if (error) {
      logError("BehaviorAnalytics", "Login patterns query error", { error: error.message });
      return { success: false, error: "Failed to fetch login patterns" };
    }

    const logins = data || [];
    const hourlyDistribution = new Array(24).fill(0);
    const dailyDistribution = new Array(7).fill(0);
    const uniqueDays = new Set();

    logins.forEach((login) => {
      const date = new Date(login.created_at);
      hourlyDistribution[date.getHours()]++;
      dailyDistribution[date.getDay()]++;
      uniqueDays.add(date.toISOString().split("T")[0]);
    });

    // Find peak hours
    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    const peakDay = dailyDistribution.indexOf(Math.max(...dailyDistribution));

    return {
      success: true,
      patterns: {
        totalLogins: logins.length,
        uniqueDays: uniqueDays.size,
        avgLoginsPerDay: uniqueDays.size ? Math.round(logins.length / uniqueDays.size) : 0,
        hourlyDistribution,
        dailyDistribution,
        peakHour,
        peakDay,
        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
    };
  } catch (err) {
    logError("BehaviorAnalytics", "Login patterns error", { error: err.message });
    return { success: false, error: "Failed to fetch login patterns" };
  }
}

// ─── Anomaly Detection Helpers ───

async function checkLoginAnomaly(userId) {
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "login")
      .gte("created_at", hourAgo);

    if (count > 10) {
      return {
        type: "login_frequency",
        description: `Unusual login frequency: ${count} logins in the last hour`,
        severity: "high",
        eventCount: count,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function checkRapidActivity(userId) {
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo);

    if (count > 30) {
      return {
        type: "rapid_activity",
        description: `Abnormally high activity: ${count} events in the last hour`,
        severity: "medium",
        eventCount: count,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function checkVerificationSpam(userId) {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "verification_failed")
      .gte("created_at", dayAgo);

    if (count >= 3) {
      return {
        type: "verification_spam",
        description: `Multiple failed verification attempts: ${count} in the last 24 hours`,
        severity: "high",
        eventCount: count,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function checkBankChangePattern(userId) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("event_type", ["bank_account_added", "bank_account_changed"])
      .gte("created_at", thirtyDaysAgo);

    if (count >= 3) {
      return {
        type: "bank_change_pattern",
        description: `Frequent bank account changes: ${count} in the last 30 days`,
        severity: "high",
        eventCount: count,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Risk Score Calculation ───

/**
 * Calculate a risk score for a behavior event.
 * @param {string} eventType
 * @param {string} eventCategory
 * @param {Object} eventData
 * @returns {number} 0-100
 */
function calculateEventRiskScore(eventType, eventCategory, eventData) {
  let score = 0;

  // Category-based base score
  switch (eventCategory) {
    case "login":
      score = 10;
      break;
    case "verification":
      score = 15;
      break;
    case "donation":
      score = 20;
      break;
    case "account":
      score = 25;
      break;
    case "document":
      score = 15;
      break;
    case "campaign":
      score = 10;
      break;
    case "profile":
      score = 5;
      break;
    case "session":
      score = 5;
      break;
  }

  // Event type adjustments
  if (eventType.includes("failed")) score += 20;
  if (eventType.includes("rejected")) score += 25;
  if (eventType.includes("password_reset")) score += 15;
  if (eventType.includes("bank_account")) score += 10;

  return Math.min(100, score);
}

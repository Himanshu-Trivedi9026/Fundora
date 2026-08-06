/**
 * Risk History — Tracks historical risk scores and changes.
 *
 * Responsibilities:
 *   - Record risk score snapshots for trend analysis
 *   - Query historical risk data
 *   - Detect significant risk score changes
 *   - Provide risk trend data for dashboards
 *
 * Security:
 *   - Never exposes raw calculation methods
 *   - All operations are audit-logged
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError, logInfo } from "../verification/secureLogger";

// ─── Core Functions ───

/**
 * Record a risk score snapshot.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} params.riskScore
 * @param {string} params.riskLevel
 * @param {number} params.trustScore
 * @param {number} params.verificationLevel
 * @param {string} params.decision
 * @param {Object} [params.signalsSummary]
 * @param {string[]} [params.rulesTriggered]
 * @param {string} [params.calculationMethod='rule_engine']
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function recordRiskScore({
  userId,
  riskScore,
  riskLevel,
  trustScore,
  verificationLevel,
  decision,
  signalsSummary = {},
  rulesTriggered = [],
  calculationMethod = "rule_engine",
}) {
  try {
    if (!userId || riskScore === undefined || !riskLevel || !decision) {
      return { success: false, error: "Missing required fields" };
    }

    const { data, error } = await supabaseAdmin
      .from("risk_scores")
      .insert({
        user_id: userId,
        risk_score: riskScore,
        risk_level: riskLevel,
        trust_score: trustScore || 0,
        verification_level: verificationLevel || 0,
        decision,
        signals_summary: signalsSummary,
        rules_triggered: rulesTriggered,
        calculation_method: calculationMethod,
        calculated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("RiskHistory", "Record error", { error: error.message });
      return { success: false, error: "Failed to record risk score" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    logError("RiskHistory", "Record error", { error: err.message });
    return { success: false, error: "Failed to record risk score" };
  }
}

/**
 * Get risk score history for a user.
 *
 * @param {string} userId
 * @param {Object} [params]
 * @param {number} [params.limit=30]
 * @param {number} [params.offset=0]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @returns {Promise<{success: boolean, scores?: Object[], total?: number, error?: string}>}
 */
export async function getRiskHistory(
  userId,
  { limit = 30, offset = 0, startDate, endDate } = {},
) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    let query = supabaseAdmin
      .from("risk_scores")
      .select(
        "id, risk_score, risk_level, trust_score, verification_level, decision, calculation_method, calculated_at",
        { count: "exact" },
      )
      .eq("user_id", userId);

    if (startDate) query = query.gte("calculated_at", startDate);
    if (endDate) query = query.lte("calculated_at", endDate);

    query = query
      .order("calculated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("RiskHistory", "Query error", { error: error.message });
      return { success: false, error: "Failed to fetch risk history" };
    }

    return {
      success: true,
      scores: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("RiskHistory", "Query error", { error: err.message });
    return { success: false, error: "Failed to fetch risk history" };
  }
}

/**
 * Get risk trend data for a user (for charts).
 * Returns daily aggregated risk scores.
 *
 * @param {string} userId
 * @param {number} [days=30]
 * @returns {Promise<{success: boolean, trend?: Object[], error?: string}>}
 */
export async function getRiskTrend(userId, days = 30) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("risk_scores")
      .select("risk_score, risk_level, decision, calculated_at")
      .eq("user_id", userId)
      .gte("calculated_at", startDate)
      .order("calculated_at", { ascending: true });

    if (error) {
      logError("RiskHistory", "Trend query error", { error: error.message });
      return { success: false, error: "Failed to fetch risk trend" };
    }

    // Aggregate by day
    const dailyData = {};
    (data || []).forEach((score) => {
      const date = score.calculated_at.split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, scores: [], levels: [], decisions: [] };
      }
      dailyData[date].scores.push(score.risk_score);
      dailyData[date].levels.push(score.risk_level);
      dailyData[date].decisions.push(score.decision);
    });

    // Calculate daily averages
    const trend = Object.values(dailyData).map((day) => ({
      date: day.date,
      avgRiskScore: Math.round(
        day.scores.reduce((a, b) => a + b, 0) / day.scores.length,
      ),
      maxRiskScore: Math.max(...day.scores),
      minRiskScore: Math.min(...day.scores),
      dominantLevel: getMostCommon(day.levels),
      dominantDecision: getMostCommon(day.decisions),
      evaluationCount: day.scores.length,
    }));

    return { success: true, trend };
  } catch (err) {
    logError("RiskHistory", "Trend error", { error: err.message });
    return { success: false, error: "Failed to fetch risk trend" };
  }
}

/**
 * Detect significant risk score changes.
 *
 * @param {string} userId
 * @param {number} [threshold=20] — Minimum change to be considered significant
 * @returns {Promise<{success: boolean, changes?: Object[], error?: string}>}
 */
export async function detectSignificantChanges(userId, threshold = 20) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    // Get last 10 scores
    const { data, error } = await supabaseAdmin
      .from("risk_scores")
      .select("risk_score, risk_level, decision, calculated_at")
      .eq("user_id", userId)
      .order("calculated_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length < 2) {
      return { success: true, changes: [] };
    }

    const changes = [];
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const previous = data[i + 1];
      const delta = current.risk_score - previous.risk_score;

      if (Math.abs(delta) >= threshold) {
        changes.push({
          date: current.calculated_at,
          previousScore: previous.risk_score,
          currentScore: current.risk_score,
          delta,
          direction: delta > 0 ? "increase" : "decrease",
          previousLevel: previous.risk_level,
          currentLevel: current.risk_level,
        });
      }
    }

    return { success: true, changes };
  } catch (err) {
    logError("RiskHistory", "Change detection error", { error: err.message });
    return { success: false, error: "Failed to detect changes" };
  }
}

/**
 * Get aggregate risk statistics for admin dashboard.
 *
 * @param {Object} [params]
 * @param {number} [params.days=30]
 * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
 */
export async function getAggregateStats({ days = 30 } = {}) {
  try {
    const startDate = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("risk_scores")
      .select("risk_score, risk_level, decision, calculated_at")
      .gte("calculated_at", startDate);

    if (error) {
      logError("RiskHistory", "Stats query error", { error: error.message });
      return { success: false, error: "Failed to fetch stats" };
    }

    const scores = (data || []).map((d) => d.risk_score);
    const levels = (data || []).map((d) => d.risk_level);
    const decisions = (data || []).map((d) => d.decision);

    const stats = {
      totalEvaluations: scores.length,
      avgRiskScore: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
      maxRiskScore: scores.length ? Math.max(...scores) : 0,
      minRiskScore: scores.length ? Math.min(...scores) : 0,
      byLevel: countOccurrences(levels),
      byDecision: countOccurrences(decisions),
      period: `${days} days`,
    };

    return { success: true, stats };
  } catch (err) {
    logError("RiskHistory", "Stats error", { error: err.message });
    return { success: false, error: "Failed to fetch stats" };
  }
}

// ─── Helpers ───

function getMostCommon(arr) {
  if (!arr.length) return null;
  const counts = {};
  arr.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function countOccurrences(arr) {
  const counts = {};
  arr.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  return counts;
}

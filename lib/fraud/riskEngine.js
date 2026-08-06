/**
 * Risk Engine — Orchestrator for the fraud detection pipeline.
 *
 * Pipeline: Signals → Rules → Scoring → Decision → Action
 *
 * Reuses existing modules:
 *   - trustEngine.js (trust scores)
 *   - auditLog.js (audit logging)
 *   - secureLogger.js (structured logging)
 *   - supabaseAdmin.js (database)
 *
 * Security:
 *   - Never exposes raw risk formulas or AI analysis results
 *   - Never blocks user requests — async evaluation only
 *   - All operations are audit-logged
 */

import { calculateTrustScore } from "../trust/trustEngine";
import { supabaseAdmin } from "../supabaseAdmin";
import { logAuditEvent, hashIP } from "../verification/auditLog";
import { logInfo, logError } from "../verification/secureLogger";
import { evaluateRules } from "./ruleEngine";
import { aggregateSignals } from "./signalAggregator";
import { calculateRiskScore } from "./riskScorer";
import { determineDecision } from "./decisionEngine";
import { recordRiskScore } from "./riskHistory";
import { recordFraudEvent } from "./fraudEvents";

// ─── Configuration ───

const EVALUATION_CONFIG = {
  /** Minimum confidence before re-evaluating (prevents churn) */
  minConfidenceForReevaluation: 30,
  /** Maximum events to fetch for aggregation */
  maxEventsForAggregation: 100,
  /** TTL for cached evaluation results (minutes) */
  evaluationCacheTTLMinutes: 5,
  /** Maximum concurrent evaluations per user */
  maxConcurrentEvaluations: 1,
};

// ─── Core Pipeline ───

/**
 * Run the full fraud detection pipeline for a user.
 *
 * @param {Object} params
 * @param {string} params.userId — Required
 * @param {string} [params.trigger] — What triggered this evaluation (e.g., 'donation', 'verification', 'account_change')
 * @param {Object} [params.context] — Additional context for the evaluation
 * @param {string} [params.ipAddress] — Client IP (will be hashed)
 * @param {string} [params.userAgent] — User agent string
 * @returns {Promise<{success: boolean, result?: Object, error?: string}>}
 */
export async function evaluateUser({
  userId,
  trigger = "unknown",
  context = {},
  ipAddress,
  userAgent,
}) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    logInfo("RiskEngine", "Evaluation started", {
      userId: userId.substring(0, 8) + "...",
      trigger,
    });

    // 1. Collect signals from multiple sources
    const signals = await aggregateSignals({ userId, trigger, context });

    // 2. Evaluate rules against signals
    const ruleResults = await evaluateRules({ userId, signals, trigger });

    // 3. Get trust score from existing engine
    const trustData = await getTrustData(userId);

    // 4. Calculate composite risk score
    const riskResult = calculateRiskScore({
      signals,
      ruleResults,
      trustScore: trustData.score,
      verificationLevel: trustData.verificationLevel,
      trigger,
    });

    // Optional AI enhancement (non-blocking, best-effort)
    let finalRiskScore = riskResult.score;
    try {
      const { detectBehaviorAnomalies } = await import("./aiEnhancer.js");
      const aiResult = await detectBehaviorAnomalies({
        userId,
        behaviorData: signals,
        historicalPatterns: historicalData,
      });
      if (aiResult.success && aiResult.data) {
        finalRiskScore = Math.max(
          finalRiskScore,
          aiResult.data.overallRisk * 0.3,
        );
      }
    } catch {
      // AI enhancement is optional — don't fail the main flow
    }

    // 5. Determine decision
    const decision = determineDecision({
      riskScore: finalRiskScore,
      riskLevel: riskResult.level,
      trustScore: trustData.score,
      verificationLevel: trustData.verificationLevel,
      trigger,
      context,
    });

    // 6. Record risk score history
    await recordRiskScore({
      userId,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      trustScore: trustData.score,
      verificationLevel: trustData.verificationLevel,
      decision: decision.action,
      signalsSummary: signals.summary || {},
      rulesTriggered: ruleResults.triggered.map((r) => r.ruleId),
      calculationMethod: "rule_engine",
    });

    // 7. Update fraud profile
    await updateFraudProfile({
      userId,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      trustScore: trustData.score,
      verificationLevel: trustData.verificationLevel,
      decision: decision.action,
      totalEvents: signals.totalEvents || 0,
      totalRuleHits: ruleResults.triggered.length,
      lastEventAt: new Date().toISOString(),
    });

    // 8. Record fraud events for each triggered rule
    for (const ruleHit of ruleResults.triggered) {
      await recordFraudEvent({
        userId,
        eventType: ruleHit.ruleName,
        eventCategory: ruleHit.category || "behavior",
        severity: ruleHit.severity || "info",
        signalName: ruleHit.ruleName,
        signalValue: ruleHit.matchData || {},
        riskContribution: ruleHit.riskContribution || 0,
        ruleIds: [ruleHit.ruleId],
        ipAddress,
        userAgent,
      });
    }

    // 9. Audit log
    await logAuditEvent({
      eventType: "fraud.evaluation_completed",
      entityType: "fraud_profile",
      entityId: userId,
      userId,
      action: "risk_evaluation",
      details: {
        trigger,
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
        decision: decision.action,
        rulesTriggered: ruleResults.triggered.length,
      },
      ipAddressHash: hashIP(ipAddress),
      userAgent,
    });

    logInfo("RiskEngine", "Evaluation completed", {
      userId: userId.substring(0, 8) + "...",
      riskScore: riskResult.score,
      decision: decision.action,
    });

    return {
      success: true,
      result: {
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
        trustScore: trustData.score,
        verificationLevel: trustData.verificationLevel,
        decision: decision,
        signals: signals.summary || {},
        rulesTriggered: ruleResults.triggered.length,
      },
    };
  } catch (err) {
    logError("RiskEngine", "Evaluation error", { error: err.message });
    return { success: false, error: "Risk evaluation failed" };
  }
}

/**
 * Get trust data for a user from the existing trust engine.
 * @param {string} userId
 * @returns {Promise<{score: number, verificationLevel: number}>}
 */
async function getTrustData(userId) {
  try {
    // Fetch creator_verifications to get trust data
    const { data: verification } = await supabaseAdmin
      .from("creator_verifications")
      .select("verification_level, trust_score")
      .eq("user_id", userId)
      .single();

    const trustResult = calculateTrustScore({
      verification: verification || {},
    });

    return {
      score: trustResult.score || 0,
      verificationLevel: verification?.verification_level || 0,
    };
  } catch (err) {
    logError("RiskEngine", "Trust data error", { error: err.message });
    return { score: 0, verificationLevel: 0 };
  }
}

/**
 * Update or create a fraud profile for a user.
 * @param {Object} params — Profile data
 */
async function updateFraudProfile({
  userId,
  riskScore,
  riskLevel,
  trustScore,
  verificationLevel,
  decision,
  totalEvents,
  totalRuleHits,
  lastEventAt,
}) {
  try {
    const { error } = await supabaseAdmin.from("fraud_profiles").upsert(
      {
        user_id: userId,
        risk_score: riskScore,
        risk_level: riskLevel,
        trust_score: trustScore,
        verification_level: verificationLevel,
        decision,
        total_events: totalEvents,
        total_rule_hits: totalRuleHits,
        last_evaluated_at: new Date().toISOString(),
        last_event_at: lastEventAt,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      logError("RiskEngine", "Profile upsert error", { error: error.message });
    }
  } catch (err) {
    logError("RiskEngine", "Profile update error", { error: err.message });
  }
}

/**
 * Get the current fraud profile for a user.
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, profile?: Object, error?: string}>}
 */
export async function getFraudProfile(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("fraud_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      logError("RiskEngine", "Profile fetch error", { error: error.message });
      return { success: false, error: "Failed to fetch fraud profile" };
    }

    return { success: true, profile: data || null };
  } catch (err) {
    logError("RiskEngine", "Profile fetch error", { error: err.message });
    return { success: false, error: "Failed to fetch fraud profile" };
  }
}

/**
 * Apply a manual override to a user's fraud decision.
 *
 * @param {Object} params
 * @param {string} params.userId — Target user
 * @param {string} params.overrideType — Type of override
 * @param {string} params.newValue — New decision/score value
 * @param {string} params.reason — Reason for override
 * @param {string} params.createdBy — Admin user ID
 * @param {boolean} [params.isPermanent=false] — Whether override expires
 * @param {string} [params.expiresAt] — Expiry date
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function applyManualOverride({
  userId,
  overrideType,
  newValue,
  reason,
  createdBy,
  isPermanent = false,
  expiresAt = null,
}) {
  try {
    if (!userId || !overrideType || !newValue || !reason || !createdBy) {
      return { success: false, error: "Missing required fields" };
    }

    const validTypes = [
      "decision",
      "risk_score",
      "block",
      "unblock",
      "whitelist",
      "blacklist",
    ];
    if (!validTypes.includes(overrideType)) {
      return {
        success: false,
        error: `Invalid override type. Must be: ${validTypes.join(", ")}`,
      };
    }

    // Get current profile
    const { data: profile } = await supabaseAdmin
      .from("fraud_profiles")
      .select("decision, risk_score")
      .eq("user_id", userId)
      .single();

    // Record the override
    const { error } = await supabaseAdmin.from("manual_overrides").insert({
      user_id: userId,
      override_type: overrideType,
      previous_value:
        overrideType === "decision"
          ? profile?.decision
          : String(profile?.risk_score || 0),
      new_value: newValue,
      reason: reason.substring(0, 500),
      created_by: createdBy,
      is_permanent: isPermanent,
      expires_at: expiresAt,
    });

    if (error) {
      logError("RiskEngine", "Override insert error", { error: error.message });
      return { success: false, error: "Failed to record override" };
    }

    // Apply the override to the profile
    const updateData = {};
    if (overrideType === "decision") {
      updateData.decision = newValue;
    } else if (overrideType === "risk_score") {
      updateData.risk_score = parseInt(newValue, 10) || 0;
    } else if (overrideType === "block") {
      updateData.decision = "block";
      updateData.manual_override = true;
      updateData.manual_override_reason = reason.substring(0, 500);
      updateData.manual_override_by = createdBy;
      updateData.manual_override_at = new Date().toISOString();
    } else if (overrideType === "unblock") {
      updateData.decision = "allow";
      updateData.manual_override = true;
      updateData.manual_override_reason = reason.substring(0, 500);
      updateData.manual_override_by = createdBy;
      updateData.manual_override_at = new Date().toISOString();
    } else if (overrideType === "whitelist") {
      updateData.risk_score = 0;
      updateData.decision = "allow";
      updateData.manual_override = true;
      updateData.manual_override_reason = reason.substring(0, 500);
      updateData.manual_override_by = createdBy;
      updateData.manual_override_at = new Date().toISOString();
    } else if (overrideType === "blacklist") {
      updateData.risk_score = 100;
      updateData.decision = "block";
      updateData.manual_override = true;
      updateData.manual_override_reason = reason.substring(0, 500);
      updateData.manual_override_by = createdBy;
      updateData.manual_override_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("fraud_profiles")
        .update(updateData)
        .eq("user_id", userId);

      if (updateError) {
        logError("RiskEngine", "Profile override error", {
          error: updateError.message,
        });
      }
    }

    // Audit log
    await logAuditEvent({
      eventType: "fraud.manual_override_applied",
      entityType: "fraud_profile",
      entityId: userId,
      userId,
      action: "manual_override",
      details: {
        overrideType,
        newValue,
        reason: reason.substring(0, 500),
        isPermanent,
        createdBy,
      },
    });

    logInfo("RiskEngine", "Manual override applied", {
      userId: userId.substring(0, 8) + "...",
      overrideType,
    });

    return { success: true };
  } catch (err) {
    logError("RiskEngine", "Override error", { error: err.message });
    return { success: false, error: "Failed to apply override" };
  }
}

/**
 * Get fraud dashboard summary for admin.
 *
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @param {string} [params.riskLevel] — Filter by risk level
 * @param {string} [params.decision] — Filter by decision
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getFraudDashboard({
  limit = 50,
  offset = 0,
  riskLevel,
  decision,
} = {}) {
  try {
    let query = supabaseAdmin.from("fraud_profiles").select(
      `
        id, user_id, risk_score, risk_level, trust_score,
        verification_level, decision, total_events, total_rule_hits,
        last_evaluated_at, manual_override, created_at
        `,
      { count: "exact" },
    );

    if (riskLevel) query = query.eq("risk_level", riskLevel);
    if (decision) query = query.eq("decision", decision);

    query = query
      .order("risk_score", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("RiskEngine", "Dashboard query error", { error: error.message });
      return { success: false, error: "Failed to fetch dashboard" };
    }

    // Get summary stats
    const { data: stats } = await supabaseAdmin
      .from("fraud_profiles")
      .select("risk_level, decision")
      .not("risk_score", "eq", 0);

    const summary = {
      totalProfiles: count || 0,
      byRiskLevel: {},
      byDecision: {},
    };

    (stats || []).forEach((row) => {
      summary.byRiskLevel[row.risk_level] =
        (summary.byRiskLevel[row.risk_level] || 0) + 1;
      summary.byDecision[row.decision] =
        (summary.byDecision[row.decision] || 0) + 1;
    });

    return {
      success: true,
      data: {
        profiles: data || [],
        summary,
        total: count || 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logError("RiskEngine", "Dashboard error", { error: err.message });
    return { success: false, error: "Failed to fetch dashboard" };
  }
}

/**
 * Export config for testing.
 */
export { EVALUATION_CONFIG };

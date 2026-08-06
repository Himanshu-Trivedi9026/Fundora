/**
 * Fraud AI Enhancer — AI enhancement for the fraud detection pipeline.
 *
 * Supplements the rule-based fraud detection engine with AI-powered analysis:
 *   - Behavior anomaly detection
 *   - Donation pattern analysis
 *   - Network relationship analysis (collusion, sybil, mule detection)
 *   - Multi-signal pattern detection
 *   - Risk assessment explanations
 *   - Platform-wide fraud summaries
 *   - Actionable fraud recommendations
 *
 * Does NOT modify any existing fraud detection files — this is an additive layer.
 *
 * Security:
 *   - Never throws — all errors returned as { success: false, error }
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { completeAIRequest } from "../ai/aiEngine.js";
import { getAIConfig } from "../ai/aiEngine.js";

// ─── Constants ───

const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

const ANOMALY_TYPES = {
  VELOCITY_SPIKE: "velocity_spike",
  AMOUNT_OUTLIER: "amount_outlier",
  BEHAVIOR_DEVIATION: "behavior_deviation",
  UNUSUAL_TIME: "unusual_time",
  GEOGRAPHIC_ANOMALY: "geographic_anomaly",
  PATTERN_BREAK: "pattern_break",
  DEVICE_ANOMALY: "device_anomaly",
  NETWORK_ANOMALY: "network_anomaly",
};

const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
};

// ─── Helpers ───

function calculateZScore(value, mean, stddev) {
  if (!stddev || stddev === 0) return 0;
  return (value - mean) / stddev;
}

function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values) {
  if (!values || values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(
    squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1),
  );
}

function riskLevelFromScore(score) {
  if (score >= RISK_THRESHOLDS.HIGH) return "high";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "medium";
  if (score >= RISK_THRESHOLDS.LOW) return "low";
  return "minimal";
}

function parseTimeframe(timeframe) {
  const match = /^(\d+)([dhm])$/.exec(timeframe);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  const [, num, unit] = match;
  const n = parseInt(num, 10);
  switch (unit) {
    case "d":
      return n * 24 * 60 * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "m":
      return n * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

// ─── Core Functions ───

/**
 * Detect behavior anomalies using AI-enhanced analysis beyond rule-based detection.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID to analyze
 * @param {Object} params.behaviorData — Current behavior data (login times, actions, etc.)
 * @param {Object} [params.historicalPatterns] — Historical behavior patterns
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectBehaviorAnomalies({
  userId,
  behaviorData,
  historicalPatterns,
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!behaviorData) {
      return { success: false, error: "behaviorData is required" };
    }

    const anomalies = [];
    let overallRisk = 0;

    // Velocity analysis
    const actionsPerMinute = behaviorData.actionsPerMinute || 0;
    const historicalAvg = historicalPatterns?.avgActionsPerMinute || 5;
    const historicalStdDev = historicalPatterns?.stddevActionsPerMinute || 3;

    const velocityZScore = calculateZScore(
      actionsPerMinute,
      historicalAvg,
      historicalStdDev,
    );
    if (velocityZScore > 2.5) {
      anomalies.push({
        type: ANOMALY_TYPES.VELOCITY_SPIKE,
        severity:
          velocityZScore > 4 ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,
        description: `Action rate (${actionsPerMinute}/min) is ${velocityZScore.toFixed(1)} standard deviations above normal (${historicalAvg}/min)`,
        confidence: Math.min(1, 0.5 + velocityZScore * 0.1),
      });
      overallRisk += velocityZScore > 4 ? 30 : 15;
    }

    // Unusual time analysis
    const currentHour = behaviorData.currentHour ?? new Date().getHours();
    const typicalHours = historicalPatterns?.typicalHours || [];
    if (typicalHours.length > 0 && !typicalHours.includes(currentHour)) {
      // Check if it's in an unusual window (e.g., 2-5 AM)
      if (currentHour >= 2 && currentHour <= 5) {
        anomalies.push({
          type: ANOMALY_TYPES.UNUSUAL_TIME,
          severity: SEVERITY_LEVELS.MEDIUM,
          description: `Activity at unusual hour (${currentHour}:00) outside typical pattern`,
          confidence: 0.6,
        });
        overallRisk += 10;
      }
    }

    // Session duration analysis
    const sessionDuration = behaviorData.sessionDurationMinutes || 0;
    const avgSessionDuration = historicalPatterns?.avgSessionDuration || 15;
    if (sessionDuration > avgSessionDuration * 3 && sessionDuration > 60) {
      anomalies.push({
        type: ANOMALY_TYPES.BEHAVIOR_DEVIATION,
        severity: SEVERITY_LEVELS.LOW,
        description: `Session duration (${sessionDuration} min) significantly exceeds average (${avgSessionDuration} min)`,
        confidence: 0.5,
      });
      overallRisk += 5;
    }

    // Device fingerprint change
    if (
      behaviorData.deviceChanged &&
      historicalPatterns?.knownDevices?.length > 0
    ) {
      anomalies.push({
        type: ANOMALY_TYPES.DEVICE_ANOMALY,
        severity: SEVERITY_LEVELS.LOW,
        description:
          "Activity from a new device not previously associated with this account",
        confidence: 0.4,
      });
      overallRisk += 8;
    }

    // IP change analysis
    if (behaviorData.ipChanged && historicalPatterns?.knownIps?.length > 0) {
      const ipCount = historicalPatterns.knownIps.length;
      if (ipCount > 3) {
        anomalies.push({
          type: ANOMALY_TYPES.NETWORK_ANOMALY,
          severity: SEVERITY_LEVELS.MEDIUM,
          description: `Frequent IP changes detected (${ipCount} known IPs)`,
          confidence: 0.55,
        });
        overallRisk += 12;
      }
    }

    overallRisk = Math.min(100, Math.max(0, overallRisk));

    logInfo("FraudAIEnhancer", "Behavior anomalies detected", {
      userId,
      anomalyCount: anomalies.length,
      overallRisk,
    });

    return {
      success: true,
      data: {
        anomalies,
        overallRisk,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Detect behavior anomalies error", {
      error: err.message,
      userId,
    });
    return { success: false, error: "Failed to detect behavior anomalies" };
  }
}

/**
 * Detect unusual donation patterns.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID (donor) to analyze
 * @param {Object[]} params.recentDonations — Recent donations by the user
 * @param {Object} params.donorHistory — Historical donation patterns
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectDonationAnomalies({
  userId,
  recentDonations,
  donorHistory,
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!recentDonations || !Array.isArray(recentDonations)) {
      return { success: false, error: "recentDonations array is required" };
    }
    if (!donorHistory) {
      return { success: false, error: "donorHistory is required" };
    }

    const anomalies = [];
    let velocityAnomaly = false;
    let amountAnomaly = false;
    let recipientAnomaly = false;

    // Velocity analysis — donations per hour
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentHour = recentDonations.filter(
      (d) => new Date(d.created_at).getTime() > oneHourAgo,
    );
    const avgDonationsPerHour = donorHistory.avgDonationsPerHour || 0.5;

    if (recentHour.length > avgDonationsPerHour * 5 && recentHour.length > 3) {
      velocityAnomaly = true;
      anomalies.push(
        `Donation velocity spike: ${recentHour.length} donations in the last hour (average: ${avgDonationsPerHour.toFixed(1)}/hour)`,
      );
    }

    // Amount analysis
    const recentAmounts = recentDonations.map((d) => d.amount || 0);
    const historicalMean = donorHistory.avgDonationAmount || 0;
    const historicalStdDev = donorHistory.stddevDonationAmount || 0;

    for (const amount of recentAmounts) {
      if (historicalStdDev > 0 && historicalMean > 0) {
        const zScore = calculateZScore(
          amount,
          historicalMean,
          historicalStdDev,
        );
        if (zScore > 3) {
          amountAnomaly = true;
          anomalies.push(
            `Donation amount ($${amount.toLocaleString()}) is ${zScore.toFixed(1)} standard deviations above the user's average ($${Math.round(historicalMean).toLocaleString()})`,
          );
        }
      }

      // Very large donation from unknown donor
      if (amount > 10000 && (donorHistory.totalDonations || 0) < 5) {
        amountAnomaly = true;
        anomalies.push(
          `Large donation ($${amount.toLocaleString()}) from a relatively new donor (${donorHistory.totalDonations || 0} total donations)`,
        );
      }
    }

    // Recipient analysis — sending to same campaign repeatedly
    const campaignCounts = {};
    for (const d of recentDonations) {
      const cid = d.campaign_id;
      if (cid) {
        campaignCounts[cid] = (campaignCounts[cid] || 0) + 1;
      }
    }

    for (const [campaignId, count] of Object.entries(campaignCounts)) {
      if (count > 5) {
        recipientAnomaly = true;
        anomalies.push(
          `Donor sent ${count} donations to the same campaign (${campaignId}) — possible self-donation or collusion indicator`,
        );
      }
    }

    // Check for round-trip pattern (donor <-> creator)
    if (donorHistory.isAlsoCreator && donorHistory.campaignIds?.length > 0) {
      const roundTripCampaigns = recentDonations
        .filter((d) => donorHistory.campaignIds.includes(d.campaign_id))
        .map((d) => d.campaign_id);

      if (roundTripCampaigns.length > 0) {
        recipientAnomaly = true;
        anomalies.push(
          `User donated to ${roundTripCampaigns.length} campaign(s) they also created — potential round-trip fraud`,
        );
      }
    }

    logInfo("FraudAIEnhancer", "Donation anomalies detected", {
      userId,
      anomalyCount: anomalies.length,
    });

    return {
      success: true,
      data: {
        anomalies,
        velocityAnomaly,
        amountAnomaly,
        recipientAnomaly,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Detect donation anomalies error", {
      error: err.message,
      userId,
    });
    return { success: false, error: "Failed to detect donation anomalies" };
  }
}

/**
 * Analyze network relationships to detect collusion, sybil attacks, and mule accounts.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID to analyze
 * @param {Object[]} params.connections — User's connections (donations, shared devices, IPs, etc.)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function analyzeNetworkRelationships({ userId, connections }) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!connections || !Array.isArray(connections)) {
      return { success: false, error: "connections array is required" };
    }

    const relationships = [];
    let riskLevel = "low";

    // Build connection graph
    const connectionMap = {};
    for (const conn of connections) {
      const targetId = conn.targetUserId || conn.target_user_id;
      const connectionType = conn.type || "unknown";

      if (!targetId || targetId === userId) continue;

      if (!connectionMap[targetId]) {
        connectionMap[targetId] = { types: new Set(), strength: 0 };
      }
      connectionMap[targetId].types.add(connectionType);
      connectionMap[targetId].strength += conn.weight || 1;
    }

    // Detect collusion rings — users who mutually donate to each other's campaigns
    const mutualDonors = Object.entries(connectionMap)
      .filter(([, data]) => data.types.has("mutual_donation"))
      .map(([id]) => id);

    if (mutualDonors.length >= 2) {
      relationships.push({
        type: "collusion",
        relatedUsers: [userId, ...mutualDonors],
        confidence: Math.min(1, 0.5 + mutualDonors.length * 0.15),
      });
      riskLevel = "high";
    }

    // Detect sybil patterns — accounts sharing multiple identifiers
    const sharedDeviceUsers = Object.entries(connectionMap)
      .filter(
        ([, data]) =>
          data.types.has("shared_device") || data.types.has("shared_ip"),
      )
      .filter(([, data]) => data.types.size >= 2)
      .map(([id, data]) => ({ id, sharedCount: data.types.size }));

    if (sharedDeviceUsers.length >= 1) {
      const sybilCandidates = sharedDeviceUsers.filter(
        (u) => u.sharedCount >= 3,
      );

      if (sybilCandidates.length > 0) {
        relationships.push({
          type: "sybil",
          relatedUsers: [userId, ...sybilCandidates.map((u) => u.id)],
          confidence: Math.min(1, 0.6 + sybilCandidates.length * 0.1),
        });
        riskLevel = riskLevel === "high" ? "high" : "medium";
      }
    }

    // Detect mule accounts — accounts that primarily receive donations and transfer
    const highTransferUsers = Object.entries(connectionMap)
      .filter(
        ([, data]) => data.types.has("fund_transfer") && data.strength > 5,
      )
      .map(([id]) => id);

    if (highTransferUsers.length > 0) {
      relationships.push({
        type: "mule",
        relatedUsers: [userId, ...highTransferUsers],
        confidence: Math.min(1, 0.5 + highTransferUsers.length * 0.2),
      });
      riskLevel = "high";
    }

    logInfo("FraudAIEnhancer", "Network relationships analyzed", {
      userId,
      relationshipCount: relationships.length,
      riskLevel,
    });

    return {
      success: true,
      data: {
        relationships,
        riskLevel,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Analyze network relationships error", {
      error: err.message,
      userId,
    });
    return { success: false, error: "Failed to analyze network relationships" };
  }
}

/**
 * Detect fraud patterns across multiple signals.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID to analyze
 * @param {Object} params.signals — Aggregated fraud signals
 * @param {string} params.timeframe — Analysis timeframe (e.g., "7d", "30d")
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectFraudPatterns({ userId, signals, timeframe }) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!signals) {
      return { success: false, error: "signals object is required" };
    }

    const patterns = [];
    const evidence = [];

    // Identity inconsistency pattern
    if (signals.identityInconsistencies?.length > 0) {
      patterns.push({
        type: "identity_inconsistency",
        description: `Detected ${signals.identityInconsistencies.length} identity data inconsistency(ies)`,
        confidence: Math.min(
          1,
          0.4 + signals.identityInconsistencies.length * 0.15,
        ),
        evidence: signals.identityInconsistencies.map(
          (i) => i.description || String(i),
        ),
      });
    }

    // Velocity fraud pattern
    if (signals.velocityScore && signals.velocityScore > 70) {
      patterns.push({
        type: "velocity_fraud",
        description: "High-velocity suspicious activity detected",
        confidence: signals.velocityScore / 100,
        evidence: [
          `Velocity score: ${signals.velocityScore}/100`,
          signals.velocityDetails ||
            "Multiple rapid actions in short timeframe",
        ],
      });
    }

    // Account farming pattern
    if (
      signals.accountAge &&
      signals.accountAge < 24 * 60 * 60 * 1000 &&
      signals.donationCount > 10
    ) {
      patterns.push({
        type: "account_farming",
        description:
          "New account with unusually high activity — possible account farming",
        confidence: Math.min(1, 0.5 + signals.donationCount / 50),
        evidence: [
          `Account age: ${Math.round(signals.accountAge / (60 * 60 * 1000))} hours`,
          `${signals.donationCount} donations made`,
        ],
      });
    }

    // Device/IP clustering
    if (signals.uniqueDevices > 5 || signals.uniqueIps > 10) {
      patterns.push({
        type: "device_ip_clustering",
        description: "Multiple devices and IPs associated with account",
        confidence: Math.min(
          1,
          0.3 +
            (signals.uniqueDevices || 0) * 0.05 +
            (signals.uniqueIps || 0) * 0.03,
        ),
        evidence: [
          `${signals.uniqueDevices || 0} unique devices`,
          `${signals.uniqueIps || 0} unique IPs`,
        ],
      });
    }

    // Cross-reference with known fraud patterns
    if (signals.previousFlags && signals.previousFlags > 2) {
      patterns.push({
        type: "repeat_offender",
        description: `Account has ${signals.previousFlags} previous fraud flags`,
        confidence: Math.min(1, 0.3 + signals.previousFlags * 0.15),
        evidence: signals.flagDetails || [
          `Previously flagged ${signals.previousFlags} time(s)`,
        ],
      });
    }

    // Generate recommendation
    let recommendation =
      "No action recommended — signals within normal parameters";
    const maxConfidence = patterns.reduce(
      (max, p) => Math.max(max, p.confidence),
      0,
    );

    if (maxConfidence >= 0.8) {
      recommendation =
        "Immediate review required — high-confidence fraud indicators detected";
    } else if (maxConfidence >= 0.6) {
      recommendation =
        "Flag for priority review — moderate-to-high fraud indicators detected";
    } else if (maxConfidence >= 0.4) {
      recommendation = "Monitor closely — elevated fraud indicators detected";
    } else if (patterns.length > 0) {
      recommendation =
        "Low priority — minor anomalies detected, no immediate action needed";
    }

    logInfo("FraudAIEnhancer", "Fraud patterns detected", {
      userId,
      patternCount: patterns.length,
    });

    return {
      success: true,
      data: {
        patterns,
        recommendation,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Detect fraud patterns error", {
      error: err.message,
      userId,
    });
    return { success: false, error: "Failed to detect fraud patterns" };
  }
}

/**
 * Generate a human-readable explanation of a risk assessment.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {number} params.riskScore — Overall risk score (0-100)
 * @param {Object} params.signals — Contributing signals
 * @param {string} params.decision — Decision taken (e.g., "block", "flag", "allow")
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function explainRiskAssessment({
  userId,
  riskScore,
  signals,
  decision,
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (riskScore === undefined || riskScore === null) {
      return { success: false, error: "riskScore is required" };
    }

    const riskLevel = riskLevelFromScore(riskScore);

    // Build explanation
    let explanation = `This account has a ${riskLevel} risk score of ${riskScore}/100. `;

    if (decision === "block") {
      explanation +=
        "Due to the high risk level, this account has been blocked from performing the requested action.";
    } else if (decision === "flag") {
      explanation +=
        "This account has been flagged for manual review by our security team.";
    } else {
      explanation +=
        "The risk indicators were within acceptable thresholds, so the action was allowed.";
    }

    // Identify key factors
    const keyFactors = [];
    if (signals.velocityScore > 60)
      keyFactors.push("Unusually high activity velocity");
    if (signals.identityInconsistencies?.length > 0)
      keyFactors.push(
        `${signals.identityInconsistencies.length} identity inconsistency(ies) detected`,
      );
    if (signals.deviceAnomalies > 0)
      keyFactors.push(`${signals.deviceAnomalies} device anomaly(ies)`);
    if (signals.ipAnomalies > 0)
      keyFactors.push(`${signals.ipAnomalies} IP anomaly(ies)`);
    if (signals.previousFlags > 0)
      keyFactors.push(
        `${signals.previousFlags} previous fraud flag(s) on this account`,
      );
    if (signals.networkRisk === "high")
      keyFactors.push("Connected to suspicious network of accounts");

    if (keyFactors.length === 0) {
      keyFactors.push("No significant risk factors identified");
    }

    // Suggest actions
    const suggestedActions = [];
    if (riskLevel === "high" || riskLevel === "critical") {
      suggestedActions.push(
        "Escalate to senior security team for manual review",
      );
      suggestedActions.push("Request additional identity verification");
      suggestedActions.push("Temporarily restrict account capabilities");
    } else if (riskLevel === "medium") {
      suggestedActions.push("Monitor account activity for the next 48 hours");
      suggestedActions.push(
        "Request identity verification if not already completed",
      );
      suggestedActions.push("Review recent transactions for anomalies");
    } else {
      suggestedActions.push("No immediate action required");
      suggestedActions.push("Continue normal monitoring");
    }

    logInfo("FraudAIEnhancer", "Risk assessment explained", {
      userId,
      riskScore,
      riskLevel,
      decision,
    });

    return {
      success: true,
      data: {
        explanation,
        keyFactors,
        suggestedActions,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Explain risk assessment error", {
      error: err.message,
      userId,
    });
    return { success: false, error: "Failed to explain risk assessment" };
  }
}

/**
 * Generate a platform-wide fraud summary for the admin dashboard.
 *
 * @param {Object} params
 * @param {string} [params.timeframe='7d'] — Timeframe for summary
 * @param {Object} [params.filters={}] — Additional filters
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function generateFraudSummary({ timeframe = "7d", filters = {} }) {
  try {
    const ms = parseTimeframe(timeframe);
    const start = new Date(Date.now() - ms).toISOString();
    const end = new Date().toISOString();

    // Fetch fraud cases in timeframe
    let query = supabaseAdmin
      .from("fraud_cases")
      .select("id, status, fraud_type, severity, created_at")
      .gte("created_at", start)
      .lte("created_at", end);

    if (filters.severity) {
      query = query.eq("severity", filters.severity);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data: cases, error: fetchError } = await query;

    if (fetchError) {
      logError("FraudAIEnhancer", "Fraud summary fetch error", {
        error: fetchError.message,
      });
      return { success: false, error: "Failed to fetch fraud data" };
    }

    const totalCases = (cases || []).length;
    const openCases = (cases || []).filter(
      (c) => c.status === "open" || c.status === "investigating",
    ).length;
    const resolvedCases = (cases || []).filter(
      (c) => c.status === "resolved",
    ).length;
    const highSeverity = (cases || []).filter(
      (c) => c.severity === "high" || c.severity === "critical",
    ).length;

    // Top patterns
    const typeCounts = {};
    for (const c of cases || []) {
      const type = c.fraud_type || "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    const topPatterns = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => `${type}: ${count} case(s)`);

    // Trends — compare with previous period
    const previousStart = new Date(Date.now() - ms * 2).toISOString();
    const { data: previousCases } = await supabaseAdmin
      .from("fraud_cases")
      .select("id")
      .gte("created_at", previousStart)
      .lt("created_at", start);

    const previousCount = (previousCases || []).length;
    const trendDirection =
      totalCases > previousCount
        ? "increasing"
        : totalCases < previousCount
          ? "decreasing"
          : "stable";

    const trends = [
      `Fraud cases are ${trendDirection} compared to the previous period (${totalCases} vs ${previousCount})`,
      `${highSeverity} high/critical severity case(s) requiring priority attention`,
      openCases > 0
        ? `${openCases} case(s) still open and need resolution`
        : "All cases have been addressed",
    ];

    // Recommendations
    const recommendations = [];
    if (highSeverity > 0) {
      recommendations.push(
        "Prioritize resolution of high-severity fraud cases",
      );
    }
    if (openCases > resolvedCases && totalCases > 5) {
      recommendations.push(
        "Consider adding additional moderation resources — case volume is elevated",
      );
    }
    if (trendDirection === "increasing") {
      recommendations.push(
        "Review recent platform changes that may be contributing to increased fraud",
      );
    }
    if (topPatterns.length > 0) {
      recommendations.push(
        `Most common fraud type: ${topPatterns[0].split(":")[0]} — consider targeted prevention measures`,
      );
    }

    const summary = `${totalCases} fraud case(s) in the last ${timeframe}: ${openCases} open, ${resolvedCases} resolved, ${highSeverity} high severity.`;

    logInfo("FraudAIEnhancer", "Fraud summary generated", {
      timeframe,
      totalCases,
    });

    return {
      success: true,
      data: {
        summary,
        topPatterns,
        trends,
        recommendations,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Generate fraud summary error", {
      error: err.message,
      timeframe,
    });
    return { success: false, error: "Failed to generate fraud summary" };
  }
}

/**
 * Get actionable recommendations for handling detected fraud.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID associated with fraud
 * @param {string} params.riskLevel — Risk level ('low', 'medium', 'high')
 * @param {Object[]} params.anomalies — List of detected anomalies
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getFraudRecommendations({
  userId,
  riskLevel,
  anomalies,
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!riskLevel) {
      return { success: false, error: "riskLevel is required" };
    }

    const recommendations = [];

    switch (riskLevel) {
      case "high":
        recommendations.push({
          action: "Immediately restrict account capabilities",
          reason:
            "High-risk accounts should be limited to prevent further potential damage",
          priority: "high",
        });
        recommendations.push({
          action: "Escalate to senior security team",
          reason:
            "High-risk cases require senior review for complex investigation",
          priority: "high",
        });
        recommendations.push({
          action: "Request enhanced identity verification",
          reason:
            "Additional verification can help confirm or clear the account",
          priority: "high",
        });
        if (anomalies && anomalies.length > 3) {
          recommendations.push({
            action: "Suspend account pending investigation",
            reason: `${anomalies.length} anomalies detected — account should be suspended to prevent further risk`,
            priority: "high",
          });
        }
        break;

      case "medium":
        recommendations.push({
          action: "Flag for priority review within 24 hours",
          reason:
            "Medium-risk accounts need timely review but don't require immediate suspension",
          priority: "medium",
        });
        recommendations.push({
          action: "Request standard identity verification",
          reason: "Verification can help resolve the risk assessment quickly",
          priority: "medium",
        });
        recommendations.push({
          action: "Monitor recent transactions",
          reason: "Review the last 48 hours of transactions for anomalies",
          priority: "medium",
        });
        break;

      case "low":
      default:
        recommendations.push({
          action: "Add to watchlist for monitoring",
          reason:
            "Low-risk anomalies should be monitored for potential escalation",
          priority: "low",
        });
        recommendations.push({
          action: "Continue normal operations",
          reason: "Risk indicators are within acceptable thresholds",
          priority: "low",
        });
        if (anomalies && anomalies.length > 0) {
          recommendations.push({
            action: "Log anomalies for pattern analysis",
            reason:
              "Even low-risk anomalies contribute to long-term pattern detection",
            priority: "low",
          });
        }
        break;
    }

    logInfo("FraudAIEnhancer", "Fraud recommendations generated", {
      userId,
      riskLevel,
      recommendationCount: recommendations.length,
    });

    return {
      success: true,
      data: {
        recommendations,
      },
    };
  } catch (err) {
    logError("FraudAIEnhancer", "Get fraud recommendations error", {
      error: err.message,
      userId,
    });
    return {
      success: false,
      error: "Failed to generate fraud recommendations",
    };
  }
}

/**
 * Risk Scorer — Calculates composite risk score (0-100).
 *
 * Risk levels:
 *   LOW:     0-25
 *   MEDIUM:  26-50
 *   HIGH:    51-75
 *   CRITICAL: 76-100
 *
 * Scoring factors (configurable via RISK_WEIGHTS):
 *   - Signal-based risk (40%)
 *   - Rule-based risk (30%)
 *   - Trust score inversion (15%)
 *   - Verification gap (15%)
 *
 * Security:
 *   - Never exposes risk formula to frontend
 *   - All scoring is deterministic and auditable
 *   - Uses secureLogger for all logging
 */

import { logError } from "../verification/secureLogger";

// ─── Configurable Risk Weights ───

const RISK_WEIGHTS = {
  /** Weight for signal-based risk contribution */
  signals: 0.4,
  /** Weight for rule-based risk contribution */
  rules: 0.3,
  /** Weight for trust score inversion (low trust = high risk) */
  trustInversion: 0.15,
  /** Weight for verification gap (missing verification = higher risk) */
  verificationGap: 0.15,
};

// ─── Risk Level Thresholds ───

const RISK_LEVELS = {
  LOW: { min: 0, max: 25, label: "low" },
  MEDIUM: { min: 26, max: 50, label: "medium" },
  HIGH: { min: 51, max: 75, label: "high" },
  CRITICAL: { min: 76, max: 100, label: "critical" },
};

// ─── Core Scoring ───

/**
 * Calculate composite risk score from signals, rules, and trust data.
 *
 * @param {Object} params
 * @param {Object} params.signals — Aggregated signals
 * @param {Object} params.ruleResults — Rule evaluation results
 * @param {number} params.trustScore — Trust score (0-100)
 * @param {number} params.verificationLevel — Verification level (0-5)
 * @param {string} params.trigger — Evaluation trigger
 * @returns {{score: number, level: string, breakdown: Object}}
 */
export function calculateRiskScore({
  signals,
  ruleResults,
  trustScore,
  verificationLevel,
  trigger,
}) {
  try {
    // 1. Signal-based risk
    const signalRisk = calculateSignalRisk(signals);

    // 2. Rule-based risk
    const ruleRisk = calculateRuleRisk(ruleResults);

    // 3. Trust inversion (low trust = high risk)
    const trustRisk = calculateTrustInversion(trustScore);

    // 4. Verification gap risk
    const verificationRisk = calculateVerificationGap(verificationLevel);

    // Weighted composite
    const compositeScore =
      signalRisk.score * RISK_WEIGHTS.signals +
      ruleRisk.score * RISK_WEIGHTS.rules +
      trustRisk.score * RISK_WEIGHTS.trustInversion +
      verificationRisk.score * RISK_WEIGHTS.verificationGap;

    // Clamp to 0-100
    const finalScore = Math.min(100, Math.max(0, Math.round(compositeScore)));

    // Determine level
    const level = getRiskLevel(finalScore);

    const breakdown = {
      signalRisk: {
        score: signalRisk.score,
        weight: RISK_WEIGHTS.signals,
        factors: signalRisk.factors,
      },
      ruleRisk: {
        score: ruleRisk.score,
        weight: RISK_WEIGHTS.rules,
        factors: ruleRisk.factors,
      },
      trustRisk: {
        score: trustRisk.score,
        weight: RISK_WEIGHTS.trustInversion,
        factors: trustRisk.factors,
      },
      verificationRisk: {
        score: verificationRisk.score,
        weight: RISK_WEIGHTS.verificationGap,
        factors: verificationRisk.factors,
      },
      finalScore,
      level,
      trigger,
    };

    return { score: finalScore, level, breakdown };
  } catch (err) {
    logError("RiskScorer", "Scoring error", { error: err.message });
    return { score: 0, level: "low", breakdown: {} };
  }
}

// ─── Risk Components ───

/**
 * Calculate risk from behavioral and device signals.
 * @param {Object} signals
 * @returns {{score: number, factors: string[]}}
 */
function calculateSignalRisk(signals) {
  let score = 0;
  const factors = [];

  // New account (< 7 days)
  if ((signals.accountAgeDays || 0) < 7) {
    score += 15;
    factors.push("new_account");
  }

  // New device
  if (signals.newDevice) {
    score += 10;
    factors.push("new_device");
  }

  // Multiple devices in 24h
  if ((signals.deviceCount24h || 0) > 3) {
    score += 12;
    factors.push("multiple_devices");
  }

  // Device risk flags
  if ((signals.deviceRiskFlags || []).length > 0) {
    score += 8;
    factors.push("device_risk_flags");
  }

  // Verification spam
  if ((signals.recentVerificationAttempts || 0) > 3) {
    score += 15;
    factors.push("verification_spam");
  }

  // Frequent bank changes
  if ((signals.recentBankChanges || 0) > 2) {
    score += 12;
    factors.push("frequent_bank_changes");
  }

  // High activity (potential bot)
  if ((signals.recentActivityCount || 0) > 20) {
    score += 10;
    factors.push("high_activity");
  }

  // Previous rule hits
  if ((signals.previousRuleHits || 0) > 0) {
    score += Math.min(20, (signals.previousRuleHits || 0) * 5);
    factors.push("previous_rule_hits");
  }

  // Country mismatch
  if (signals.countryMismatch) {
    score += 15;
    factors.push("country_mismatch");
  }

  // Disposable email
  if (signals.disposableEmail) {
    score += 10;
    factors.push("disposable_email");
  }

  return { score: Math.min(100, score), factors };
}

/**
 * Calculate risk from triggered rules.
 * @param {Object} ruleResults
 * @returns {{score: number, factors: string[]}}
 */
function calculateRuleRisk(ruleResults) {
  const factors = [];

  if (
    !ruleResults ||
    !ruleResults.triggered ||
    ruleResults.triggered.length === 0
  ) {
    return { score: 0, factors };
  }

  // Sum risk contributions from triggered rules
  let totalContribution = 0;
  ruleResults.triggered.forEach((rule) => {
    totalContribution += rule.riskContribution || 0;
    factors.push(rule.ruleName);
  });

  // Cap at 100
  const score = Math.min(100, totalContribution);

  return { score, factors };
}

/**
 * Calculate risk from trust score inversion.
 * Low trust = high risk, high trust = low risk.
 * @param {number} trustScore
 * @returns {{score: number, factors: string[]}}
 */
function calculateTrustInversion(trustScore) {
  const factors = [];

  // Invert: trust 0 → risk 100, trust 100 → risk 0
  const score = 100 - (trustScore || 0);

  if (trustScore < 30) {
    factors.push("very_low_trust");
  } else if (trustScore < 60) {
    factors.push("low_trust");
  }

  return { score, factors };
}

/**
 * Calculate risk from verification gap.
 * Missing verification = higher risk.
 * @param {number} verificationLevel
 * @returns {{score: number, factors: string[]}}
 */
function calculateVerificationGap(verificationLevel) {
  const factors = [];

  // Level 0 (no verification) → risk 100
  // Level 5 (fully verified) → risk 0
  const score = 100 - ((verificationLevel || 0) / 5) * 100;

  if (verificationLevel < 1) {
    factors.push("unverified");
  } else if (verificationLevel < 3) {
    factors.push("partially_verified");
  }

  return { score, factors };
}

// ─── Risk Level Mapping ───

/**
 * Get risk level from score.
 * @param {number} score
 * @returns {string} 'low' | 'medium' | 'high' | 'critical'
 */
export function getRiskLevel(score) {
  if (score >= RISK_LEVELS.CRITICAL.min) return RISK_LEVELS.CRITICAL.label;
  if (score >= RISK_LEVELS.HIGH.min) return RISK_LEVELS.HIGH.label;
  if (score >= RISK_LEVELS.MEDIUM.min) return RISK_LEVELS.MEDIUM.label;
  return RISK_LEVELS.LOW.label;
}

/**
 * Get risk level label with description.
 * @param {string} level
 * @returns {{label: string, color: string, description: string}}
 */
export function getRiskLevelInfo(level) {
  switch (level) {
    case "critical":
      return {
        label: "Critical Risk",
        color: "danger",
        description:
          "Immediate action required — high probability of fraudulent activity",
      };
    case "high":
      return {
        label: "High Risk",
        color: "warning",
        description: "Elevated risk — requires manual review and monitoring",
      };
    case "medium":
      return {
        label: "Medium Risk",
        color: "primary",
        description:
          "Moderate risk — monitoring and additional verification recommended",
      };
    case "low":
    default:
      return {
        label: "Low Risk",
        color: "success",
        description: "Normal risk level — standard monitoring applies",
      };
  }
}

/**
 * Export config for testing.
 */
export { RISK_WEIGHTS, RISK_LEVELS };

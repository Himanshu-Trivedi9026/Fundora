/**
 * Decision Engine — Maps risk score + trust score + verification level to actions.
 *
 * Decision actions:
 *   - ALLOW: No restrictions
 *   - MONITOR: Silent monitoring, no user-facing changes
 *   - MANUAL_REVIEW: Queue for admin review
 *   - LIMIT: Restrict certain actions
 *   - BLOCK: Block all actions
 *   - ESCALATE: Immediate escalation to admin
 *
 * Decision matrix (configurable via DECISION_MATRIX):
 *   risk_level + trust_level + verification_level → action
 *
 * Security:
 *   - Never exposes decision logic to frontend
 *   - All decisions are audit-logged
 *   - Manual overrides always take precedence
 */

import { logError, logInfo } from "../verification/secureLogger";

// ─── Configurable Decision Matrix ───

/**
 * Decision matrix: risk_level → trust_level → action
 * trust_level: low (<30), medium (30-60), high (>60)
 */
const DECISION_MATRIX = {
  critical: {
    low: "block",
    medium: "block",
    high: "manual_review",
  },
  high: {
    low: "manual_review",
    medium: "manual_review",
    high: "limit",
  },
  medium: {
    low: "manual_review",
    medium: "monitor",
    high: "allow",
  },
  low: {
    low: "monitor",
    medium: "allow",
    high: "allow",
  },
};

// ─── Decision Overrides ───

/**
 * Trigger-specific overrides that can escalate decisions.
 * If a trigger matches, the action is escalated one level up.
 */
const TRIGGER_OVERRIDES = {
  donation: { minRiskForEscalation: 50 },
  payout: { minRiskForEscalation: 40 },
  verification: { minRiskForEscalation: 60 },
  account_change: { minRiskForEscalation: 45 },
};

// ─── Core Decision Logic ───

/**
 * Determine the action based on risk, trust, and verification data.
 *
 * @param {Object} params
 * @param {number} params.riskScore — Risk score (0-100)
 * @param {string} params.riskLevel — Risk level (low/medium/high/critical)
 * @param {number} params.trustScore — Trust score (0-100)
 * @param {number} params.verificationLevel — Verification level (0-5)
 * @param {string} params.trigger — What triggered this evaluation
 * @param {Object} [params.context] — Additional context
 * @returns {{action: string, reason: string, restrictions: string[], confidence: number}}
 */
export function determineDecision({ riskScore, riskLevel, trustScore, verificationLevel, trigger, context = {} }) {
  try {
    // 1. Get trust level
    const trustLevel = getTrustLevel(trustScore);

    // 2. Look up base action from matrix
    const baseAction = DECISION_MATRIX[riskLevel]?.[trustLevel] || "allow";

    // 3. Apply trigger-specific overrides
    let finalAction = baseAction;
    const override = TRIGGER_OVERRIDES[trigger];
    if (override && riskScore >= override.minRiskForEscalation) {
      finalAction = escalateAction(baseAction);
    }

    // 4. Apply context-based adjustments
    finalAction = applyContextAdjustments(finalAction, context);

    // 5. Generate restrictions
    const restrictions = generateRestrictions(finalAction);

    // 6. Calculate confidence
    const confidence = calculateDecisionConfidence(riskScore, trustScore, verificationLevel);

    // 7. Generate reason
    const reason = generateDecisionReason(finalAction, riskLevel, trustLevel, verificationLevel);

    logInfo("DecisionEngine", "Decision made", {
      action: finalAction,
      riskLevel,
      trustLevel,
      trigger,
    });

    return {
      action: finalAction,
      reason,
      restrictions,
      confidence,
    };
  } catch (err) {
    logError("DecisionEngine", "Decision error", { error: err.message });
    return {
      action: "allow",
      reason: "Decision engine error — defaulting to allow",
      restrictions: [],
      confidence: 0,
    };
  }
}

// ─── Helper Functions ───

/**
 * Get trust level from score.
 * @param {number} trustScore
 * @returns {string} 'low' | 'medium' | 'high'
 */
function getTrustLevel(trustScore) {
  if (trustScore >= 60) return "high";
  if (trustScore >= 30) return "medium";
  return "low";
}

/**
 * Escalate an action one level up.
 * @param {string} action
 * @returns {string}
 */
function escalateAction(action) {
  const escalationMap = {
    allow: "monitor",
    monitor: "manual_review",
    manual_review: "limit",
    limit: "block",
    block: "block",
    escalate: "escalate",
  };
  return escalationMap[action] || action;
}

/**
 * Apply context-based adjustments to the decision.
 * @param {string} action
 * @param {Object} context
 * @returns {string}
 */
function applyContextAdjustments(action, context) {
  // Large donation escalation
  if (context.donationAmount && context.donationAmount > 50000) {
    if (action === "allow") return "monitor";
    if (action === "monitor") return "manual_review";
  }

  // High-value payout escalation
  if (context.payoutAmount && context.payoutAmount > 100000) {
    if (action === "allow") return "manual_review";
    if (action === "monitor") return "manual_review";
  }

  // Multiple failed attempts
  if (context.failedAttempts && context.failedAttempts > 5) {
    if (action === "allow") return "limit";
  }

  return action;
}

/**
 * Generate restrictions based on the decision action.
 * @param {string} action
 * @returns {string[]}
 */
function generateRestrictions(action) {
  switch (action) {
    case "block":
      return [
        "create_campaign",
        "donate",
        "request_payout",
        "upload_document",
        "edit_profile",
        "verify_account",
      ];
    case "limit":
      return ["request_payout", "create_campaign"];
    case "manual_review":
      return ["request_payout"];
    case "monitor":
    case "allow":
    default:
      return [];
  }
}

/**
 * Calculate decision confidence based on available data.
 * @param {number} riskScore
 * @param {number} trustScore
 * @param {number} verificationLevel
 * @returns {number} 0-100
 */
function calculateDecisionConfidence(riskScore, trustScore, verificationLevel) {
  let confidence = 50; // Base confidence

  // More data = higher confidence
  if (verificationLevel >= 3) confidence += 20;
  if (verificationLevel >= 1) confidence += 10;

  // Extreme scores = higher confidence
  if (riskScore > 80 || riskScore < 20) confidence += 10;
  if (trustScore > 80 || trustScore < 20) confidence += 10;

  return Math.min(100, confidence);
}

/**
 * Generate a human-readable reason for the decision.
 * @param {string} action
 * @param {string} riskLevel
 * @param {string} trustLevel
 * @param {number} verificationLevel
 * @returns {string}
 */
function generateDecisionReason(action, riskLevel, trustLevel, verificationLevel) {
  const reasons = {
    block: `Blocked due to ${riskLevel} risk score and ${trustLevel} trust level (verification level: ${verificationLevel})`,
    limit: `Limited actions due to ${riskLevel} risk score (trust: ${trustLevel}, verification: ${verificationLevel})`,
    manual_review: `Queued for manual review due to ${riskLevel} risk score (trust: ${trustLevel})`,
    monitor: `Silent monitoring enabled due to moderate risk indicators`,
    allow: `Standard access granted — risk within acceptable limits`,
    escalate: `Escalated to admin due to elevated risk indicators`,
  };

  return reasons[action] || "Decision based on risk assessment";
}

/**
 * Export config for testing.
 */
export { DECISION_MATRIX, TRIGGER_OVERRIDES };

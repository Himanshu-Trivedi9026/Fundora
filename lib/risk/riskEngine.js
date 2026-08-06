/**
 * Risk Engine — Modular risk assessment for creators.
 *
 * Each risk factor contributes independently to the final risk score.
 * Higher risk score = higher likelihood of fraudulent/abusive behavior.
 *
 * Risk Factors:
 *   - VPN/TOR usage (future)
 *   - Chargeback history (future)
 *   - Spam/abuse reports (future)
 *   - Multiple accounts (future)
 *   - Device fingerprint anomalies (future)
 *   - Community reports (future)
 *   - Fraud detection signals (future)
 *
 * Output:
 *   - riskScore: 0-100 (0 = no risk, 100 = extreme risk)
 *   - riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical'
 *   - riskFactors: array of individual factor scores
 *   - lastCalculated: ISO timestamp
 *
 * This is the FOUNDATION only. Individual factor algorithms
 * will be implemented when we have real signals to analyze.
 */

// ─── Risk Factor Definitions ───

const RISK_FACTORS = {
  network: {
    weight: 0.15,
    label: "Network Analysis",
    description: "VPN, TOR, proxy detection",
  },
  chargebacks: {
    weight: 0.2,
    label: "Chargeback History",
    description: "Payment disputes and chargebacks",
  },
  spam: {
    weight: 0.15,
    label: "Spam & Abuse",
    description: "Spam reports and abuse flags",
  },
  accounts: {
    weight: 0.15,
    label: "Account Patterns",
    description: "Multiple accounts, suspicious registration",
  },
  device: {
    weight: 0.1,
    label: "Device Signals",
    description: "Device fingerprint and behavior analysis",
  },
  reports: {
    weight: 0.15,
    label: "Community Reports",
    description: "User-submitted reports and flags",
  },
  fraud: {
    weight: 0.1,
    label: "Fraud Detection",
    description: "AI-powered fraud signal analysis",
  },
};

// ─── Risk Level Thresholds ───

const RISK_LEVELS = {
  minimal: { min: 0, max: 15, label: "Minimal Risk", color: "success" },
  low: { min: 16, max: 35, label: "Low Risk", color: "primary" },
  medium: { min: 36, max: 55, label: "Medium Risk", color: "warning" },
  high: { min: 56, max: 75, label: "High Risk", color: "danger" },
  critical: { min: 76, max: 100, label: "Critical Risk", color: "danger" },
};

// ─── Individual Factor Scoring (Stubs) ───

/**
 * Network risk — VPN/TOR/proxy detection.
 * Foundation: returns minimal risk.
 */
function scoreNetwork(signals) {
  return {
    score: 5,
    confidence: 10,
    details: "Network analysis not yet implemented",
  };
}

/**
 * Chargeback risk — Payment dispute history.
 * Foundation: returns minimal risk.
 */
function scoreChargebacks(donations) {
  return {
    score: 5,
    confidence: 10,
    details: "Chargeback analysis not yet implemented",
  };
}

/**
 * Spam risk — Abuse and spam reports.
 * Foundation: returns minimal risk.
 */
function scoreSpam(reports) {
  if (!reports || reports.length === 0) return { score: 5, confidence: 40 };
  return {
    score: 20,
    confidence: 30,
    details: "Spam analysis not yet implemented",
  };
}

/**
 * Account pattern risk — Multiple accounts, suspicious registration.
 * Foundation: returns minimal risk.
 */
function scoreAccounts(profile, user) {
  return {
    score: 5,
    confidence: 10,
    details: "Account pattern analysis not yet implemented",
  };
}

/**
 * Device risk — Device fingerprint and behavior.
 * Foundation: returns minimal risk.
 */
function scoreDevice(signals) {
  return {
    score: 5,
    confidence: 5,
    details: "Device analysis not yet implemented",
  };
}

/**
 * Community report risk — User-submitted reports.
 * Foundation: returns minimal risk if no reports.
 */
function scoreReports(reports) {
  if (!reports || reports.length === 0) return { score: 5, confidence: 50 };
  return {
    score: 30,
    confidence: 40,
    details: "Report analysis not yet implemented",
  };
}

/**
 * Fraud detection risk — AI-powered fraud signals.
 * Foundation: returns minimal risk.
 */
function scoreFraud(signals) {
  return {
    score: 5,
    confidence: 5,
    details: "Fraud detection not yet implemented",
  };
}

// ─── Engine ───

/**
 * Calculate composite risk score from all factors.
 *
 * @param {Object} data — All data needed for risk assessment
 * @param {Object} data.signals — Network/device/fraud signals
 * @param {Array}  data.donations — Payment history
 * @param {Array}  data.reports — Community reports
 * @param {Object} data.profile — User profile
 * @param {Object} data.user — Auth user record
 * @returns {{ riskScore: number, riskLevel: string, riskFactors: Object, lastCalculated: string }}
 */
export function calculateRiskScore(data = {}) {
  const factors = {
    network: scoreNetwork(data.signals),
    chargebacks: scoreChargebacks(data.donations),
    spam: scoreSpam(data.reports),
    accounts: scoreAccounts(data.profile, data.user),
    device: scoreDevice(data.signals),
    reports: scoreReports(data.reports),
    fraud: scoreFraud(data.signals),
  };

  // Weighted sum
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [factor, result] of Object.entries(factors)) {
    const weight = RISK_FACTORS[factor]?.weight || 0;
    weightedScore += result.score * weight;
    totalWeight += weight;
  }

  const riskScore =
    totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  // Determine risk level
  let riskLevel = "minimal";
  for (const [level, range] of Object.entries(RISK_LEVELS)) {
    if (riskScore >= range.min && riskScore <= range.max) {
      riskLevel = level;
      break;
    }
  }

  return {
    riskScore: Math.min(100, Math.max(0, riskScore)),
    riskLevel,
    riskLevelLabel: RISK_LEVELS[riskLevel]?.label || "Unknown",
    riskLevelColor: RISK_LEVELS[riskLevel]?.color || "danger",
    riskFactors: factors,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Get risk level info from score.
 * @param {number} score — 0-100
 * @returns {{ label: string, color: string, description: string }}
 */
export function getRiskLevel(score) {
  for (const [level, range] of Object.entries(RISK_LEVELS)) {
    if (score >= range.min && score <= range.max) {
      const descriptions = {
        minimal: "No significant risk indicators detected",
        low: "Minor risk factors present — normal for new creators",
        medium: "Some risk factors detected — review recommended",
        high: "Significant risk factors — manual review required",
        critical: "Critical risk indicators — immediate attention required",
      };
      return {
        label: range.label,
        color: range.color,
        description: descriptions[level],
      };
    }
  }
  return {
    label: "Unknown",
    color: "danger",
    description: "Risk level could not be determined",
  };
}

/**
 * Apply risk score adjustment after document rejection.
 *
 * @param {number} currentScore — Current risk score (0-100)
 * @returns {number} Adjusted score
 */
export function applyDocumentRejection(currentScore) {
  return Math.min(100, currentScore + 15);
}

/**
 * Apply risk score adjustment after repeated verification failures.
 *
 * @param {number} currentScore — Current risk score (0-100)
 * @param {number} failureCount — Number of consecutive failures
 * @returns {number} Adjusted score
 */
export function applyRepeatedFailures(currentScore, failureCount) {
  const increase = Math.min(30, failureCount * 5);
  return Math.min(100, currentScore + increase);
}

/**
 * Apply risk score adjustment after document replacement.
 * Multiple document replacements may indicate fraud.
 *
 * @param {number} currentScore — Current risk score (0-100)
 * @param {number} replacementCount — Number of document replacements
 * @returns {number} Adjusted score
 */
export function applyDocumentReplacement(currentScore, replacementCount) {
  const increase = Math.min(15, replacementCount * 3);
  return Math.min(100, currentScore + increase);
}

export { RISK_FACTORS, RISK_LEVELS };

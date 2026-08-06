/**
 * Trust Engine — Modular scoring architecture for creator trust.
 *
 * Each module scores independently (0-100) with its own weight.
 * Final trust score = weighted sum of module scores.
 *
 * Modules:
 *   - Identity: verification completeness
 *   - Campaigns: project quality and success
 *   - Community: follower engagement and reputation
 *   - Payments: funding history and reliability
 *   - Reports: community reports (future)
 *   - AI: machine learning signals (future)
 *
 * Output:
 *   - score: 0-100 composite trust score
 *   - confidence: 0-100 how confident we are in the score
 *   - lastCalculated: ISO timestamp
 *   - modules: per-module breakdown
 *
 * This is the FOUNDATION only. Individual module algorithms
 * will be implemented when we have real data to train on.
 */

// ─── Module Weights ───
// Weights must sum to 1.0
const MODULE_WEIGHTS = {
  identity: 0.30,
  campaigns: 0.25,
  community: 0.15,
  payments: 0.20,
  reports: 0.05,
  ai: 0.05,
};

// ─── Configurable Verification Weights ───
// Each verification type contributes a specific boost to trust score.
export const VERIFICATION_WEIGHTS = {
  email: 5,
  phone: 10,
  id: 25,
  bank: 20,
  business: 25,
  gst: 10,
  selfie: 5,
  address: 5,
  penny_drop: 10,
  pan: 8,
};

// ─── Business Type Multipliers ───
// Different business types carry different trust multipliers.
export const BUSINESS_TYPE_MULTIPLIERS = {
  private_limited: 1.2,
  public_limited: 1.2,
  llp: 1.1,
  partnership: 1.0,
  ngo: 0.9,
  trust: 0.9,
  society: 0.9,
  startup: 1.1,
  sole_proprietorship: 0.9,
  individual: 0.8,
  government: 1.0,
};

// ─── Module Definitions ───

/**
 * Identity Module — Scores based on verification completeness.
 *
 * Inputs:
 *   - verification_level (0-5)
 *   - email_verified, phone_verified, identity_verified, etc.
 *   - verified_at (how long ago)
 *
 * Algorithm (foundation):
 *   level 0 → 10, level 1 → 30, level 2 → 55,
 *   level 3 → 70, level 4 → 85, level 5 → 95
 *   + recency bonus: verified within 1 year → +5
 */
function scoreIdentity(verification) {
  if (!verification) return { score: 0, confidence: 80 };

  const levelScores = { 0: 10, 1: 30, 2: 55, 3: 70, 4: 85, 5: 95 };
  let score = levelScores[verification.verification_level] || 0;

  // Recency bonus
  if (verification.verified_at) {
    const daysSinceVerified = (Date.now() - new Date(verification.verified_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerified < 365) score = Math.min(100, score + 5);
  }

  return { score: Math.min(100, score), confidence: 85 };
}

/**
 * Campaigns Module — Scores based on project quality.
 *
 * Inputs:
 *   - project count
 *   - funding success rate
 *   - average funding percentage
 *   - project completion rate
 *
 * Algorithm (foundation): stub — returns neutral score.
 */
function scoreCampaigns(projects) {
  if (!projects || projects.length === 0) return { score: 30, confidence: 20 };

  // Foundation stub — will be implemented with real data
  return { score: 50, confidence: 30 };
}

/**
 * Community Module — Scores based on follower engagement.
 *
 * Inputs:
 *   - follower count
 *   - follower growth rate
 *   - engagement ratio
 *
 * Algorithm (foundation): stub — returns neutral score.
 */
function scoreCommunity(profile) {
  if (!profile) return { score: 20, confidence: 15 };

  // Foundation stub — will be implemented with real data
  return { score: 40, confidence: 25 };
}

/**
 * Payments Module — Scores based on funding history.
 *
 * Inputs:
 *   - total raised
 *   - number of donations received
 *   - average donation amount
 *   - refund rate
 *
 * Algorithm (foundation): stub — returns neutral score.
 */
function scorePayments(donations) {
  if (!donations || donations.length === 0) return { score: 25, confidence: 15 };

  // Foundation stub — will be implemented with real data
  return { score: 45, confidence: 20 };
}

/**
 * Reports Module — Scores based on community reports.
 *
 * Inputs:
 *   - report count
 *   - report severity
 *   - resolution status
 *
 * Algorithm (foundation): stub — no reports = good.
 */
function scoreReports(reports) {
  // No reports is good
  if (!reports || reports.length === 0) return { score: 80, confidence: 60 };

  // Foundation stub — will be implemented with real data
  return { score: 50, confidence: 40 };
}

/**
 * AI Module — Scores based on ML predictions.
 *
 * Inputs:
 *   - fraud detection signals
 *   - behavioral analysis
 *   - anomaly detection
 *
 * Algorithm (foundation): stub — neutral.
 */
function scoreAI(signals) {
  // No AI signals yet
  return { score: 50, confidence: 10 };
}

// ─── Engine ───

/**
 * Calculate composite trust score from all modules.
 *
 * @param {Object} data — All data needed for scoring
 * @param {Object} data.verification — Verification record
 * @param {Array}  data.projects — User's projects
 * @param {Object} data.profile — User's profile
 * @param {Array}  data.donations — Donations received
 * @param {Array}  data.reports — Community reports
 * @param {Object} data.aiSignals — AI analysis signals
 * @returns {{ score: number, confidence: number, lastCalculated: string, modules: Object }}
 */
export async function calculateTrustScore(data = {}) {
  const modules = {
    identity: scoreIdentity(data.verification),
    campaigns: scoreCampaigns(data.projects),
    community: scoreCommunity(data.profile),
    payments: scorePayments(data.donations),
    reports: scoreReports(data.reports),
    ai: scoreAI(data.aiSignals),
  };

  // AI module score (async — non-blocking, falls back to neutral)
  let aiModuleResult = modules.ai;
  try {
    const aiScore = await calculateAIModuleScore(data.userId);
    aiModuleResult = { score: aiScore, confidence: 10 };
    modules.ai = aiModuleResult;
  } catch {
    // AI scoring is optional — keep stub result
  }

  // Weighted sum
  let compositeScore = 0;
  let totalWeight = 0;

  for (const [module, result] of Object.entries(modules)) {
    const weight = MODULE_WEIGHTS[module] || 0;
    compositeScore += result.score * weight;
    totalWeight += weight;
  }

  // Normalize
  const score = totalWeight > 0 ? Math.round(compositeScore / totalWeight) : 0;

  // Confidence = weighted average of module confidences
  let confidenceSum = 0;
  for (const [module, result] of Object.entries(modules)) {
    const weight = MODULE_WEIGHTS[module] || 0;
    confidenceSum += result.confidence * weight;
  }
  const confidence = totalWeight > 0 ? Math.round(confidenceSum / totalWeight) : 0;

  return {
    score: Math.min(100, Math.max(0, score)),
    confidence: Math.min(100, Math.max(0, confidence)),
    lastCalculated: new Date().toISOString(),
    modules,
  };
}

/**
 * Calculate AI module score for a user.
 * Returns 0.5 (neutral baseline) if no AI data exists.
 *
 * @param {string} userId — User ID
 * @returns {Promise<number>} AI module score (0-100)
 */
async function calculateAIModuleScore(userId) {
  // Baseline neutral score — will be enhanced with real AI data
  if (!userId) return 50;
  return 50;
}

/**
 * Get trust level label from score.
 * @param {number} score — 0-100
 * @returns {{ label: string, color: string, description: string }}
 */
export function getTrustLevel(score) {
  if (score >= 80) return { label: "High Trust", color: "success", description: "Exemplary creator with strong verification and track record" };
  if (score >= 60) return { label: "Moderate Trust", color: "primary", description: "Verified creator with positive platform history" };
  if (score >= 40) return { label: "Developing Trust", color: "warning", description: "Building verification and platform presence" };
  if (score >= 20) return { label: "Low Trust", color: "danger", description: "Limited verification and platform history" };
  return { label: "New Creator", color: "danger", description: "Just joined — verification recommended" };
}

/**
 * Apply trust score adjustment after verification approval.
 * Uses configurable VERIFICATION_WEIGHTS instead of hardcoded boosts.
 *
 * @param {number} currentScore — Current trust score (0-100)
 * @param {string} verificationType — Type of verification approved
 * @returns {number} Adjusted score
 */
export function applyVerificationApproval(currentScore, verificationType) {
  const boost = VERIFICATION_WEIGHTS[verificationType] || 5;
  return Math.min(100, currentScore + boost);
}

/**
 * Apply trust score adjustment after verification rejection.
 * Uses configurable VERIFICATION_WEIGHTS for penalty calculation.
 *
 * @param {number} currentScore — Current trust score (0-100)
 * @param {string} verificationType — Type of verification rejected
 * @returns {number} Adjusted score
 */
export function applyVerificationRejection(currentScore, verificationType) {
  const basePenalty = VERIFICATION_WEIGHTS[verificationType] || 5;
  const penalty = -Math.round(basePenalty * 0.4); // 40% of weight as penalty
  return Math.max(0, currentScore + penalty);
}

/**
 * Calculate business trust bonus based on business type.
 * Uses BUSINESS_TYPE_MULTIPLIERS for type-specific scoring.
 *
 * @param {Object} businessData — Business verification data
 * @param {string} businessData.business_type — Type of business
 * @returns {number} Trust bonus points
 */
export function calculateBusinessTrustBonus(businessData) {
  if (!businessData) return 0;
  const base = VERIFICATION_WEIGHTS.business || 25;
  const multiplier = BUSINESS_TYPE_MULTIPLIERS[businessData.business_type] || 1.0;
  return Math.round(base * multiplier);
}

/**
 * Calculate bank trust bonus including penny drop verification.
 *
 * @param {Object} bankData — Bank verification data
 * @param {string} bankData.penny_drop_status — Penny drop status
 * @returns {number} Trust bonus points
 */
export function calculateBankTrustBonus(bankData) {
  if (!bankData) return 0;
  const base = VERIFICATION_WEIGHTS.bank || 20;
  const pennyDropBonus = bankData.penny_drop_status === "success" ? VERIFICATION_WEIGHTS.penny_drop : 0;
  return base + pennyDropBonus;
}

export { MODULE_WEIGHTS };

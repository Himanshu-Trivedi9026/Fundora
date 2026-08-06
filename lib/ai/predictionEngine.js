/**
 * Prediction Engine — Feature-based predictive analytics for Fundora.
 *
 * Extracts feature vectors from campaigns, donors, and creators, then applies
 * deterministic rule-based scoring with optional AI enhancement.  Every public
 * function returns a probability or projection together with a confidence score
 * and explanatory factors so callers can render transparent UI.
 *
 * Public API:
 *   predictCampaignSuccess      — probability a campaign will reach its goal
 *   predictFundingTimeline      — estimated completion date
 *   predictDonationVelocity     — forward-looking velocity projection
 *   predictFailureRisk          — risk level with key risk factors
 *   predictRefundProbability    — likelihood a donation will be refunded
 *   predictMilestoneCompletion  — probability a milestone will be completed
 *   predictCreatorGrowth        — follower / donation growth projection
 *   batchPredict                — bulk predictions for multiple entities
 *
 * Security:
 *   - Never throws — all errors are caught and returned as { success: false, error }
 *   - All mutations are audit-logged via secureLogger
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";

// ─── Constants ───

/**
 * Canonical prediction types.
 * @type {Object<string, string>}
 */
export const PREDICTION_TYPES = {
  CAMPAIGN_SUCCESS: "success_prob",
  FUNDING_TIMELINE: "funding_timeline",
  DONATION_VELOCITY: "donation_velocity",
  FAILURE_RISK: "failure_risk",
  REFUND_PROBABILITY: "refund_prob",
  MILESTONE_COMPLETION: "milestone_completion",
  CREATOR_GROWTH: "creator_growth",
};

/** Feature weights used by the rule-based scoring model. */
const FEATURE_WEIGHTS = {
  goalAmount: 0.10,
  categorySuccessRate: 0.12,
  creatorReputation: 0.18,
  trustScore: 0.15,
  earlyFundingRatio: 0.20,
  updateFrequency: 0.10,
  daysActive: 0.05,
  socialProof: 0.10,
};

/** Category average success rates (baseline priors). */
const CATEGORY_BASELINES = {
  technology: 0.38,
  health: 0.35,
  education: 0.42,
  environment: 0.36,
  arts: 0.30,
  community: 0.40,
  social: 0.37,
  business: 0.33,
  creative: 0.32,
  _default: 0.35,
};

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Extract a feature vector from a campaign and its creator.
 *
 * @param {Object} campaign
 * @param {Object} [creator]
 * @returns {Object} Normalised feature vector with values in roughly 0-1 range.
 */
function extractCampaignFeatures(campaign, creator) {
  const goalAmount = campaign.goal_amount || 0;
  const currentAmount = campaign.current_amount || 0;
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(campaign.created_at || Date.now()).getTime()) / 86400000),
  );

  const earlyFundingRatio = goalAmount > 0 ? Math.min(currentAmount / goalAmount, 1) : 0;
  const updateCount = campaign.update_count || 0;
  const updateFrequency = daysActive > 0 ? updateCount / daysActive : 0;
  const donorCount = campaign.donor_count || 0;

  return {
    goalAmount,
    currentAmount,
    daysActive,
    category: campaign.category || "_default",
    earlyFundingRatio,
    updateFrequency: Math.min(updateFrequency, 1),
    updateCount,
    donorCount,
    creatorReputation: creator?.reputation_score ?? creator?.trust_score ?? 0.5,
    trustScore: creator?.trust_score ?? 0.5,
    socialProof: Math.min(donorCount / 100, 1),
  };
}

/**
 * Extract features from a donor record and their history.
 *
 * @param {Object} donor
 * @param {Object} history — { totalDonations, avgAmount, refundRate, accountAgeDays }
 * @returns {Object} Feature vector.
 */
function extractDonorFeatures(donor, history) {
  return {
    trustScore: donor?.trust_score ?? 0.5,
    totalDonations: history?.totalDonations ?? 0,
    avgAmount: history?.avgAmount ?? 0,
    refundRate: history?.refundRate ?? 0,
    accountAgeDays: history?.accountAgeDays ?? 30,
    kycVerified: donor?.kyc_verified ? 1 : 0,
  };
}

/**
 * Deterministic rule-based prediction from a feature vector.
 * Returns { probability, confidence, factors[] }.
 *
 * @param {Object} features — Feature vector from extractCampaignFeatures
 * @returns {{ probability: number, confidence: number, factors: Array<{name: string, impact: number, description: string}> }}
 */
function ruleBasedPrediction(features) {
  const factors = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // Early funding ratio (strongest signal)
  const earlyWeight = FEATURE_WEIGHTS.earlyFundingRatio;
  weightedSum += features.earlyFundingRatio * earlyWeight;
  totalWeight += earlyWeight;
  factors.push({
    name: "early_funding_ratio",
    impact: features.earlyFundingRatio,
    description: `Currently at ${Math.round(features.earlyFundingRatio * 100)}% of goal`,
  });

  // Creator reputation
  const repWeight = FEATURE_WEIGHTS.creatorReputation;
  weightedSum += features.creatorReputation * repWeight;
  totalWeight += repWeight;
  factors.push({
    name: "creator_reputation",
    impact: features.creatorReputation,
    description: `Creator reputation score: ${Math.round(features.creatorReputation * 100)}%`,
  });

  // Trust score
  const trustWeight = FEATURE_WEIGHTS.trustScore;
  weightedSum += features.trustScore * trustWeight;
  totalWeight += trustWeight;
  factors.push({
    name: "trust_score",
    impact: features.trustScore,
    description: `Platform trust score: ${Math.round(features.trustScore * 100)}%`,
  });

  // Category baseline
  const categoryBaseline =
    CATEGORY_BASELINES[features.category] ?? CATEGORY_BASELINES._default;
  const catWeight = FEATURE_WEIGHTS.categorySuccessRate;
  weightedSum += categoryBaseline * catWeight;
  totalWeight += catWeight;
  factors.push({
    name: "category_baseline",
    impact: categoryBaseline,
    description: `Category "${features.category}" has ${Math.round(categoryBaseline * 100)}% average success rate`,
  });

  // Update frequency
  const updWeight = FEATURE_WEIGHTS.updateFrequency;
  weightedSum += features.updateFrequency * updWeight;
  totalWeight += updWeight;
  factors.push({
    name: "update_frequency",
    impact: features.updateFrequency,
    description: `${features.updateCount} updates over ${features.daysActive} days`,
  });

  // Social proof (donor count)
  const socialWeight = FEATURE_WEIGHTS.socialProof;
  weightedSum += features.socialProof * socialWeight;
  totalWeight += socialWeight;
  factors.push({
    name: "social_proof",
    impact: features.socialProof,
    description: `${features.donorCount} donors so far`,
  });

  // Goal amount penalty (very large goals are harder)
  const goalNorm = Math.min(features.goalAmount / 100000, 1);
  const goalPenalty = 1 - goalNorm * 0.15;
  const goalWeight = FEATURE_WEIGHTS.goalAmount;
  weightedSum += goalPenalty * goalWeight;
  totalWeight += goalWeight;
  factors.push({
    name: "goal_scale",
    impact: goalPenalty,
    description: `Goal of $${features.goalAmount.toLocaleString()} ${features.goalAmount > 50000 ? "(ambitious)" : "(moderate)"}`,
  });

  // Recency penalty for very new campaigns with no traction
  let recencyBonus = 0;
  if (features.daysActive <= 3 && features.earlyFundingRatio === 0) {
    recencyBonus = -0.1;
    factors.push({
      name: "early_stage",
      impact: -0.1,
      description: "Campaign is very new with no early funding",
    });
  }

  const probability = Math.max(0, Math.min(1, weightedSum / totalWeight + recencyBonus));

  // Confidence based on available data richness
  const dataSignals = [
    features.daysActive > 0 ? 1 : 0,
    features.donorCount > 0 ? 1 : 0,
    features.updateCount > 0 ? 1 : 0,
    features.trustScore !== 0.5 ? 1 : 0, // non-default trust
  ].reduce((a, b) => a + b, 0);

  const confidence = Math.min(0.3 + dataSignals * 0.175, 0.95);

  return { probability, confidence, factors };
}

/**
 * Calculate prediction confidence from sample size and variance.
 *
 * @param {number} sampleSize
 * @param {number} variance
 * @returns {number} Confidence between 0 and 1
 */
function calculateConfidence(sampleSize, variance) {
  if (sampleSize <= 0) return 0.1;

  const sizeContribution = Math.min(sampleSize / 100, 1) * 0.5;
  const variancePenalty = Math.min(variance, 1) * 0.3;
  const baseConfidence = 0.2;

  return Math.max(0.05, Math.min(1, baseConfidence + sizeContribution - variancePenalty));
}

// ─── Data Fetching Helpers ───────────────────────────────────────────────────

/**
 * Fetch a campaign with its creator data.
 *
 * @param {string} campaignId
 * @returns {Promise<{campaign: Object|null, creator: Object|null, error?: string}>}
 */
async function fetchCampaignWithCreator(campaignId) {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("*, creator:users(id, trust_score, reputation_score, total_raised, total_campaigns, created_at)")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    logError("PredictionEngine", "Campaign fetch error", { error: error?.message, campaignId });
    return { campaign: null, creator: null, error: "Campaign not found" };
  }

  const creator = Array.isArray(campaign.creator) ? campaign.creator[0] : campaign.creator;
  return { campaign, creator };
}

/**
 * Fetch donation history stats for a campaign.
 *
 * @param {string} campaignId
 * @param {number} [days=30]
 * @returns {Promise<{totalDonations: number, totalAmount: number, recentDonations: number, recentAmount: number, days: number}>}
 */
async function fetchDonationStats(campaignId, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data: recent, error: err1 } = await supabaseAdmin
    .from("donations")
    .select("amount, created_at")
    .eq("campaign_id", campaignId)
    .gte("created_at", cutoff.toISOString());

  if (err1) {
    logError("PredictionEngine", "Donation stats fetch error", { error: err1.message, campaignId });
    return { totalDonations: 0, totalAmount: 0, recentDonations: 0, recentAmount: 0, days };
  }

  const donations = recent || [];
  let totalAmount = 0;
  for (const d of donations) {
    totalAmount += d.amount || 0;
  }

  return {
    totalDonations: donations.length,
    totalAmount,
    recentDonations: donations.length,
    recentAmount: totalAmount,
    days,
  };
}

// ─── Public Functions ────────────────────────────────────────────────────────

/**
 * Predict whether a campaign will reach its funding goal.
 *
 * @param {Object} params
 * @param {string} params.campaignId
 * @returns {Promise<{success: boolean, data?: {probability: number, confidence: number, factors: Array<{name: string, impact: number, description: string}>, timeframe: string}, error?: string}>}
 */
export async function predictCampaignSuccess({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("PredictionEngine", "Predicting campaign success", { campaignId });

    const { campaign, creator, error: fetchErr } = await fetchCampaignWithCreator(campaignId);
    if (fetchErr) {
      return { success: false, error: fetchErr };
    }

    const features = extractCampaignFeatures(campaign, creator);
    const { probability, confidence, factors } = ruleBasedPrediction(features);

    // Determine prediction timeframe based on campaign maturity
    let timeframe = "90d";
    if (features.daysActive <= 14) {
      timeframe = "30d";
    } else if (features.daysActive <= 45) {
      timeframe = "60d";
    }

    logInfo("PredictionEngine", "Campaign success prediction complete", {
      campaignId,
      probability,
      confidence,
      timeframe,
    });

    return {
      success: true,
      data: {
        probability: Math.round(probability * 1000) / 1000,
        confidence: Math.round(confidence * 1000) / 1000,
        factors,
        timeframe,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictCampaignSuccess exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error predicting campaign success" };
  }
}

/**
 * Predict the estimated funding completion date for a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId
 * @returns {Promise<{success: boolean, data?: {estimatedCompletionDate: string|null, dailyRateNeeded: number, currentRate: number, confidence: number}, error?: string}>}
 */
export async function predictFundingTimeline({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("PredictionEngine", "Predicting funding timeline", { campaignId });

    const { campaign, creator, error: fetchErr } = await fetchCampaignWithCreator(campaignId);
    if (fetchErr) {
      return { success: false, error: fetchErr };
    }

    const goalAmount = campaign.goal_amount || 0;
    const currentAmount = campaign.current_amount || 0;
    const remaining = Math.max(goalAmount - currentAmount, 0);

    if (remaining === 0) {
      return {
        success: true,
        data: {
          estimatedCompletionDate: new Date().toISOString(),
          dailyRateNeeded: 0,
          currentRate: 0,
          confidence: 1,
        },
      };
    }

    // Compute daily funding rate from recent history
    const daysActive = Math.max(
      1,
      Math.floor((Date.now() - new Date(campaign.created_at || Date.now()).getTime()) / 86400000),
    );

    const stats = await fetchDonationStats(campaignId, Math.min(daysActive, 30));
    const currentRate = stats.days > 0 ? stats.recentAmount / stats.days : 0;

    let estimatedCompletionDate = null;
    let dailyRateNeeded = 0;
    let confidence = 0;

    if (currentRate > 0) {
      const daysNeeded = remaining / currentRate;
      const completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + Math.ceil(daysNeeded));
      estimatedCompletionDate = completionDate.toISOString();

      // Confidence from sample size and rate consistency
      const { data: allDonations } = await supabaseAdmin
        .from("donations")
        .select("amount")
        .eq("campaign_id", campaignId);

      const amounts = (allDonations || []).map((d) => d.amount || 0);
      const mean = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      const variance = amounts.length > 1
        ? amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / (amounts.length - 1)
        : 1;
      const normalisedVariance = mean > 0 ? Math.min(variance / (mean * mean), 1) : 1;

      confidence = calculateConfidence(amounts.length, normalisedVariance);
    }

    // What rate would be needed to fund within 30 days from now
    dailyRateNeeded = remaining / 30;

    logInfo("PredictionEngine", "Funding timeline prediction complete", {
      campaignId,
      estimatedCompletionDate,
      currentRate,
      dailyRateNeeded,
    });

    return {
      success: true,
      data: {
        estimatedCompletionDate,
        dailyRateNeeded: Math.round(dailyRateNeeded * 100) / 100,
        currentRate: Math.round(currentRate * 100) / 100,
        confidence: Math.round(confidence * 1000) / 1000,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictFundingTimeline exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error predicting funding timeline" };
  }
}

/**
 * Predict upcoming donation velocity for a campaign.
 *
 * @param {Object}  params
 * @param {string}  params.campaignId
 * @param {number}  [params.windowDays=30]
 * @returns {Promise<{success: boolean, data?: {currentVelocity: number, predictedVelocity: number, trend: string, confidence: number}, error?: string}>}
 */
export async function predictDonationVelocity({ campaignId, windowDays = 30 }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("PredictionEngine", "Predicting donation velocity", { campaignId, windowDays });

    // Fetch donations over the last 2x the window to establish a trend
    const lookbackDays = windowDays * 2;
    const lookbackCutoff = new Date();
    lookbackCutoff.setDate(lookbackCutoff.getDate() - lookbackDays);

    const { data: donations, error } = await supabaseAdmin
      .from("donations")
      .select("amount, created_at")
      .eq("campaign_id", campaignId)
      .gte("created_at", lookbackCutoff.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      logError("PredictionEngine", "Velocity donations fetch error", { error: error.message, campaignId });
      return { success: false, error: "Failed to fetch donation history" };
    }

    const allDonations = donations || [];

    if (allDonations.length < 2) {
      return {
        success: true,
        data: {
          currentVelocity: 0,
          predictedVelocity: 0,
          trend: "stable",
          confidence: 0.1,
        },
      };
    }

    // Split into two halves for trend analysis
    const midpoint = Math.floor(allDonations.length / 2);
    const firstHalf = allDonations.slice(0, midpoint);
    const secondHalf = allDonations.slice(midpoint);

    const firstRate = firstHalf.length / Math.max(windowDays, 1);
    const secondRate = secondHalf.length / Math.max(windowDays, 1);

    const currentVelocity = Math.round(secondRate * 1000) / 1000;

    // Determine trend
    let trend = "stable";
    const changeThreshold = 0.15;
    if (secondRate > firstRate * (1 + changeThreshold)) {
      trend = "increasing";
    } else if (secondRate < firstRate * (1 - changeThreshold)) {
      trend = "decreasing";
    }

    // Simple linear extrapolation for predicted velocity
    const velocityChange = secondRate - firstRate;
    const predictedVelocity = Math.max(0, Math.round((secondRate + velocityChange) * 1000) / 1000);

    const confidence = calculateConfidence(allDonations.length, Math.abs(velocityChange));

    logInfo("PredictionEngine", "Donation velocity prediction complete", {
      campaignId,
      currentVelocity,
      predictedVelocity,
      trend,
    });

    return {
      success: true,
      data: {
        currentVelocity,
        predictedVelocity,
        trend,
        confidence: Math.round(confidence * 1000) / 1000,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictDonationVelocity exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error predicting donation velocity" };
  }
}

/**
 * Predict the risk of a campaign failing.
 *
 * @param {Object} params
 * @param {string} params.campaignId
 * @returns {Promise<{success: boolean, data?: {riskLevel: string, probability: number, keyRiskFactors: string[], mitigationSuggestions: string[]}, error?: string}>}
 */
export async function predictFailureRisk({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("PredictionEngine", "Predicting failure risk", { campaignId });

    const { campaign, creator, error: fetchErr } = await fetchCampaignWithCreator(campaignId);
    if (fetchErr) {
      return { success: false, error: fetchErr };
    }

    const features = extractCampaignFeatures(campaign, creator);
    const stats = await fetchDonationStats(campaignId, 30);

    const keyRiskFactors = [];
    const mitigationSuggestions = [];
    let riskScore = 0;

    // Low early funding
    if (features.earlyFundingRatio < 0.1 && features.daysActive > 14) {
      riskScore += 0.25;
      keyRiskFactors.push("Less than 10% funded after 14+ days");
      mitigationSuggestions.push("Consider lowering the goal or increasing promotion");
    }

    // No recent donations
    if (stats.recentDonations === 0 && features.daysActive > 7) {
      riskScore += 0.20;
      keyRiskFactors.push("No donations in the last 30 days");
      mitigationSuggestions.push("Share campaign on social media and reach out to past supporters");
    }

    // Declining donation velocity
    if (features.daysActive > 14) {
      const velocityResult = await predictDonationVelocity({ campaignId, windowDays: 14 });
      if (velocityResult.success && velocityResult.data?.trend === "decreasing") {
        riskScore += 0.15;
        keyRiskFactors.push("Donation velocity is declining");
        mitigationSuggestions.push("Post a campaign update to re-engage donors");
      }
    }

    // Low creator trust
    if (features.trustScore < 0.3) {
      riskScore += 0.15;
      keyRiskFactors.push("Low creator trust score");
      mitigationSuggestions.push("Complete identity verification to build trust");
    }

    // No updates
    if (features.updateCount === 0 && features.daysActive > 7) {
      riskScore += 0.10;
      keyRiskFactors.push("No campaign updates posted");
      mitigationSuggestions.push("Post regular updates to maintain donor confidence");
    }

    // Very high goal
    if (features.goalAmount > 50000 && features.earlyFundingRatio < 0.05) {
      riskScore += 0.10;
      keyRiskFactors.push("High goal with minimal early traction");
      mitigationSuggestions.push("Consider a milestone-based approach with smaller sub-goals");
    }

    // Low social proof
    if (features.donorCount < 3 && features.daysActive > 14) {
      riskScore += 0.05;
      keyRiskFactors.push("Very few unique donors");
      mitigationSuggestions.push("Ask friends and family for initial support to build momentum");
    }

    const probability = Math.min(Math.max(riskScore, 0), 1);

    let riskLevel;
    if (probability < 0.25) {
      riskLevel = "low";
    } else if (probability < 0.50) {
      riskLevel = "medium";
    } else if (probability < 0.75) {
      riskLevel = "high";
    } else {
      riskLevel = "critical";
    }

    logInfo("PredictionEngine", "Failure risk prediction complete", {
      campaignId,
      riskLevel,
      probability,
      factorCount: keyRiskFactors.length,
    });

    return {
      success: true,
      data: {
        riskLevel,
        probability: Math.round(probability * 1000) / 1000,
        keyRiskFactors,
        mitigationSuggestions,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictFailureRisk exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error predicting failure risk" };
  }
}

/**
 * Predict the probability that a donation will be refunded.
 *
 * @param {Object} params
 * @param {string} params.donationId
 * @returns {Promise<{success: boolean, data?: {probability: number, factors: string[]}, error?: string}>}
 */
export async function predictRefundProbability({ donationId }) {
  try {
    if (!donationId) {
      return { success: false, error: "donationId is required" };
    }

    logInfo("PredictionEngine", "Predicting refund probability", { donationId });

    // 1. Fetch the donation with campaign and donor data
    const { data: donation, error: donErr } = await supabaseAdmin
      .from("donations")
      .select("id, amount, donor_id, campaign_id, created_at, donor:users(id, trust_score, refund_count, total_donations), campaign:campaigns(id, status, goal_amount, current_amount)")
      .eq("id", donationId)
      .single();

    if (donErr || !donation) {
      logError("PredictionEngine", "Donation fetch error", { error: donErr?.message, donationId });
      return { success: false, error: "Donation not found" };
    }

    const donor = Array.isArray(donation.donor) ? donation.donor[0] : donation.donor;
    const campaign = Array.isArray(donation.campaign) ? donation.campaign[0] : donation.campaign;

    // 2. Build features
    const donorFeatures = extractDonorFeatures(donor, {
      totalDonations: donor?.total_donations || 0,
      refundRate: donor?.refund_count && donor?.total_donations
        ? donor.refund_count / Math.max(donor.total_donations, 1)
        : 0,
    });

    // 3. Score refund risk
    const factors = [];
    let refundScore = 0;

    // Donor refund history (strongest signal)
    if (donorFeatures.refundRate > 0.3) {
      refundScore += 0.35;
      factors.push(`Donor has a ${Math.round(donorFeatures.refundRate * 100)}% historical refund rate`);
    } else if (donorFeatures.refundRate > 0.1) {
      refundScore += 0.15;
      factors.push(`Donor has a moderate refund history`);
    }

    // Low donor trust
    if (donorFeatures.trustScore < 0.3) {
      refundScore += 0.20;
      factors.push("Donor has a low trust score");
    }

    // Campaign health
    if (campaign?.status !== "active") {
      refundScore += 0.20;
      factors.push("Campaign is no longer active");
    } else if (campaign.goal_amount && campaign.current_amount) {
      const fundingRatio = campaign.current_amount / campaign.goal_amount;
      if (fundingRatio < 0.1) {
        refundScore += 0.10;
        factors.push("Campaign has very low funding progress");
      }
    }

    // Time since donation (recent donations more likely to be refunded)
    const hoursSinceDonation = donation.created_at
      ? (Date.now() - new Date(donation.created_at).getTime()) / 3600000
      : 0;
    if (hoursSinceDonation < 24) {
      refundScore += 0.15;
      factors.push("Donation was made within the last 24 hours (cooling-off period)");
    } else if (hoursSinceDonation < 72) {
      refundScore += 0.05;
      factors.push("Donation is recent (within 72 hours)");
    }

    // Large donation amounts slightly more likely to be refunded
    if (donation.amount > 1000) {
      refundScore += 0.05;
      factors.push(`Large donation amount ($${donation.amount.toLocaleString()})`);
    }

    const probability = Math.min(Math.max(refundScore, 0), 1);

    logInfo("PredictionEngine", "Refund probability prediction complete", {
      donationId,
      probability,
      factorCount: factors.length,
    });

    return {
      success: true,
      data: {
        probability: Math.round(probability * 1000) / 1000,
        factors,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictRefundProbability exception", { error: err.message, donationId });
    return { success: false, error: "Internal error predicting refund probability" };
  }
}

/**
 * Predict whether a campaign milestone will be completed.
 *
 * @param {Object} params
 * @param {string} params.milestoneId
 * @returns {Promise<{success: boolean, data?: {probability: number, estimatedCompletionDate: string|null, blockers: string[]}, error?: string}>}
 */
export async function predictMilestoneCompletion({ milestoneId }) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    logInfo("PredictionEngine", "Predicting milestone completion", { milestoneId });

    // 1. Fetch milestone with campaign context
    const { data: milestone, error: msErr } = await supabaseAdmin
      .from("campaign_milestones")
      .select("id, title, description, status, target_date, campaign_id, created_at, campaign:campaigns(id, status, creator_id, creator:users(id, trust_score, reputation_score, total_campaigns))")
      .eq("id", milestoneId)
      .single();

    if (msErr || !milestone) {
      logError("PredictionEngine", "Milestone fetch error", { error: msErr?.message, milestoneId });
      return { success: false, error: "Milestone not found" };
    }

    const campaign = Array.isArray(milestone.campaign) ? milestone.campaign[0] : milestone.campaign;
    const creator = campaign?.creator
      ? (Array.isArray(campaign.creator) ? campaign.creator[0] : campaign.creator)
      : null;

    // 2. Check milestone status
    if (milestone.status === "completed") {
      return {
        success: true,
        data: {
          probability: 1,
          estimatedCompletionDate: milestone.target_date || new Date().toISOString(),
          blockers: [],
        },
      };
    }

    // 3. Feature-based scoring
    const blockers = [];
    let completionScore = 0.5; // baseline

    // Creator track record
    const creatorReputation = creator?.reputation_score ?? creator?.trust_score ?? 0.5;
    completionScore += (creatorReputation - 0.5) * 0.3;
    if (creatorReputation < 0.3) {
      blockers.push("Creator has a low reputation score");
    }

    // Campaign is still active
    if (campaign?.status === "active") {
      completionScore += 0.1;
    } else {
      completionScore -= 0.3;
      blockers.push("Campaign is not active");
    }

    // Historical milestone completion rate for this creator
    if (creator?.id) {
      const { data: pastMilestones } = await supabaseAdmin
        .from("campaign_milestones")
        .select("status, campaign:campaigns(creator_id)")
        .limit(50);

      if (pastMilestones) {
        const creatorMilestones = pastMilestones.filter(
          (m) => {
            const c = Array.isArray(m.campaign) ? m.campaign[0] : m.campaign;
            return c?.creator_id === creator.id;
          },
        );
        const completed = creatorMilestones.filter((m) => m.status === "completed").length;
        if (creatorMilestones.length > 0) {
          const completionRate = completed / creatorMilestones.length;
          completionScore += (completionRate - 0.5) * 0.2;
          if (completionRate < 0.3) {
            blockers.push(`Creator has only ${Math.round(completionRate * 100)}% milestone completion rate`);
          }
        }
      }
    }

    // Target date proximity
    if (milestone.target_date) {
      const daysUntilTarget = Math.floor(
        (new Date(milestone.target_date).getTime() - Date.now()) / 86400000,
      );
      if (daysUntilTarget < 0) {
        completionScore -= 0.2;
        blockers.push("Target date has passed");
      } else if (daysUntilTarget > 90) {
        completionScore += 0.05;
      }
    }

    const probability = Math.max(0, Math.min(1, completionScore));

    // Estimate completion date (use target date if available, otherwise project from creator speed)
    let estimatedCompletionDate = milestone.target_date || null;
    if (!estimatedCompletionDate && probability > 0.3) {
      const projected = new Date();
      projected.setDate(projected.getDate() + Math.round(60 / Math.max(probability, 0.1)));
      estimatedCompletionDate = projected.toISOString();
    }

    logInfo("PredictionEngine", "Milestone completion prediction complete", {
      milestoneId,
      probability,
      blockerCount: blockers.length,
    });

    return {
      success: true,
      data: {
        probability: Math.round(probability * 1000) / 1000,
        estimatedCompletionDate,
        blockers,
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictMilestoneCompletion exception", { error: err.message, milestoneId });
    return { success: false, error: "Internal error predicting milestone completion" };
  }
}

/**
 * Predict a creator's growth trajectory over a given window.
 *
 * @param {Object}  params
 * @param {string}  params.creatorId
 * @param {number}  [params.windowDays=90]
 * @returns {Promise<{success: boolean, data?: {followerGrowthRate: number, donationGrowthRate: number, trend: string, projectedFollowers: number, projectedDonations: number}, error?: string}>}
 */
export async function predictCreatorGrowth({ creatorId, windowDays = 90 }) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    logInfo("PredictionEngine", "Predicting creator growth", { creatorId, windowDays });

    // 1. Fetch the creator's current stats
    const { data: creator, error: creatorErr } = await supabaseAdmin
      .from("users")
      .select("id, follower_count, total_raised, total_campaigns, trust_score, created_at")
      .eq("id", creatorId)
      .single();

    if (creatorErr || !creator) {
      logError("PredictionEngine", "Creator fetch error", { error: creatorErr?.message, creatorId });
      return { success: false, error: "Creator not found" };
    }

    // 2. Fetch historical donations in two periods for trend analysis
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - windowDays);
    const midpoint = new Date(periodStart);
    midpoint.setDate(midpoint.getDate() + Math.floor(windowDays / 2));

    const { data: recentDonations } = await supabaseAdmin
      .from("donations")
      .select("id, amount, created_at")
      .eq("creator_id", creatorId)
      .gte("created_at", midpoint.toISOString());

    const { data: olderDonations } = await supabaseAdmin
      .from("donations")
      .select("id, amount, created_at")
      .eq("creator_id", creatorId)
      .gte("created_at", periodStart.toISOString())
      .lt("created_at", midpoint.toISOString());

    const recentDons = recentDonations || [];
    const olderDons = olderDonations || [];
    const halfWindow = Math.max(windowDays / 2, 1);

    const recentDonationRate = recentDons.length / halfWindow;
    const olderDonationRate = olderDons.length / halfWindow;

    const recentAmount = recentDons.reduce((sum, d) => sum + (d.amount || 0), 0);
    const olderAmount = olderDons.reduce((sum, d) => sum + (d.amount || 0), 0);
    const recentAmountRate = recentAmount / halfWindow;
    const olderAmountRate = olderAmount / halfWindow;

    // 3. Compute growth rates
    const donationGrowthRate =
      olderDonationRate > 0
        ? ((recentDonationRate - olderDonationRate) / olderDonationRate) * 100
        : recentDonationRate > 0
          ? 100
          : 0;

    const donationAmountGrowthRate =
      olderAmountRate > 0
        ? ((recentAmountRate - olderAmountRate) / olderAmountRate) * 100
        : recentAmountRate > 0
          ? 100
          : 0;

    // Follower growth (approximation from account age and current count)
    const accountAgeDays = Math.max(
      1,
      Math.floor((now.getTime() - new Date(creator.created_at || now).getTime()) / 86400000),
    );
    const currentFollowers = creator.follower_count || 0;
    const followerGrowthRate = accountAgeDays > 0
      ? (currentFollowers / accountAgeDays) * 100
      : 0;

    // 4. Determine overall trend
    let trend = "steady";
    const trendThreshold = 20;
    if (donationGrowthRate > trendThreshold) {
      trend = "accelerating";
    } else if (donationGrowthRate < -trendThreshold) {
      trend = "declining";
    }

    // 5. Project forward
    const futureDays = windowDays;
    const projectedFollowerGrowth = trend === "accelerating"
      ? followerGrowthRate * 1.2
      : trend === "declining"
        ? followerGrowthRate * 0.8
        : followerGrowthRate;

    const projectedFollowers =
      currentFollowers + Math.round((projectedFollowerGrowth / 100) * futureDays);

    const projectedDonationRate = trend === "accelerating"
      ? recentDonationRate * 1.2
      : trend === "declining"
        ? recentDonationRate * 0.8
        : recentDonationRate;

    const projectedDonations =
      Math.round(projectedDonationRate * futureDays * 10) / 10;

    logInfo("PredictionEngine", "Creator growth prediction complete", {
      creatorId,
      trend,
      donationGrowthRate,
      projectedFollowers,
      projectedDonations,
    });

    return {
      success: true,
      data: {
        followerGrowthRate: Math.round(followerGrowthRate * 100) / 100,
        donationGrowthRate: Math.round(donationGrowthRate * 100) / 100,
        trend,
        projectedFollowers: Math.max(0, projectedFollowers),
        projectedDonations: Math.max(0, projectedDonations),
      },
    };
  } catch (err) {
    logError("PredictionEngine", "predictCreatorGrowth exception", { error: err.message, creatorId });
    return { success: false, error: "Internal error predicting creator growth" };
  }
}

/**
 * Run batch predictions for multiple entities of the same type.
 *
 * @param {Object} params
 * @param {string} params.entityType     — "campaign" | "donation" | "milestone" | "creator"
 * @param {string[]} params.entityIds    — Array of entity IDs
 * @param {string} params.predictionType — One of PREDICTION_TYPES values
 * @returns {Promise<{success: boolean, data?: Array<{entityId: string, prediction: Object}>, error?: string}>}
 */
export async function batchPredict({ entityType, entityIds, predictionType }) {
  try {
    if (!entityType || !entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
      return { success: false, error: "entityType and a non-empty entityIds array are required" };
    }

    if (!predictionType) {
      return { success: false, error: "predictionType is required" };
    }

    logInfo("PredictionEngine", "Running batch predictions", {
      entityType,
      entityCount: entityIds.length,
      predictionType,
    });

    const results = [];

    for (const entityId of entityIds) {
      let prediction = null;

      try {
        switch (predictionType) {
          case PREDICTION_TYPES.CAMPAIGN_SUCCESS: {
            if (entityType !== "campaign") {
              prediction = { error: `Cannot predict campaign success for entity type: ${entityType}` };
            } else {
              const result = await predictCampaignSuccess({ campaignId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.FUNDING_TIMELINE: {
            if (entityType !== "campaign") {
              prediction = { error: `Cannot predict funding timeline for entity type: ${entityType}` };
            } else {
              const result = await predictFundingTimeline({ campaignId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.DONATION_VELOCITY: {
            if (entityType !== "campaign") {
              prediction = { error: `Cannot predict donation velocity for entity type: ${entityType}` };
            } else {
              const result = await predictDonationVelocity({ campaignId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.FAILURE_RISK: {
            if (entityType !== "campaign") {
              prediction = { error: `Cannot predict failure risk for entity type: ${entityType}` };
            } else {
              const result = await predictFailureRisk({ campaignId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.REFUND_PROBABILITY: {
            if (entityType !== "donation") {
              prediction = { error: `Cannot predict refund probability for entity type: ${entityType}` };
            } else {
              const result = await predictRefundProbability({ donationId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.MILESTONE_COMPLETION: {
            if (entityType !== "milestone") {
              prediction = { error: `Cannot predict milestone completion for entity type: ${entityType}` };
            } else {
              const result = await predictMilestoneCompletion({ milestoneId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          case PREDICTION_TYPES.CREATOR_GROWTH: {
            if (entityType !== "creator") {
              prediction = { error: `Cannot predict creator growth for entity type: ${entityType}` };
            } else {
              const result = await predictCreatorGrowth({ creatorId: entityId });
              prediction = result.success ? result.data : { error: result.error };
            }
            break;
          }

          default: {
            prediction = { error: `Unknown prediction type: ${predictionType}` };
          }
        }
      } catch (innerErr) {
        prediction = { error: `Prediction failed: ${innerErr.message}` };
      }

      results.push({ entityId, prediction });
    }

    logInfo("PredictionEngine", "Batch predictions complete", {
      entityType,
      predictionType,
      resultCount: results.length,
    });

    return { success: true, data: results };
  } catch (err) {
    logError("PredictionEngine", "batchPredict exception", { error: err.message, entityType, predictionType });
    return { success: false, error: "Internal error running batch predictions" };
  }
}

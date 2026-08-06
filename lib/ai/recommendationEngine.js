/**
 * Recommendation Engine — Personalised multi-signal recommendation system.
 *
 * Combines four signals to rank candidates:
 *   1. Content-based  — category match, goal-range similarity
 *   2. Collaborative  — donors with similar history also funded this
 *   3. Trending       — recent donation velocity
 *   4. Trust-weighted — higher platform trust boosts the score
 *
 * Public API:
 *   getDonorRecommendations      — campaigns a donor is likely to fund
 *   getCampaignDonorSuggestions  — donors likely to fund a campaign
 *   getSimilarCampaigns          — campaigns similar to a given campaign
 *   getTrendingCampaigns         — fast-rising campaigns
 *   getCreatorRecommendations    — category/goal guidance for a creator
 *   invalidateRecommendationCache — clear cached results
 *
 * Security:
 *   - Never throws — all errors are caught and returned as { success: false, error }
 *   - All mutations are audit-logged via secureLogger
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { searchEmbeddings } from "./embeddingEngine.js";

// ─── Constants ───

/**
 * Canonical recommendation types.
 * @type {Object<string, string>}
 */
export const RECOMMENDATION_TYPES = {
  CAMPAIGNS_FOR_DONOR: "campaign_for_donor",
  SIMILAR_CAMPAIGNS: "similar_campaigns",
  TRENDING: "trending",
  CREATOR_RECOMMENDATIONS: "creator_recommendations",
  CAMPAIGN_DONOR_SUGGESTIONS: "campaign_donor_suggestions",
};

/** Weight assigned to each scoring signal in the composite score. */
const SIGNAL_WEIGHTS = {
  contentBased: 0.35,
  collaborative: 0.25,
  trending: 0.20,
  trust: 0.20,
};

/** Maximum number of historical donations to sample per donor. */
const MAX_HISTORY_SAMPLE = 200;

/** Maximum number of similar donors to consider for collaborative filtering. */
const MAX_SIMILAR_DONORS = 50;

// ─── Internal Scoring Helpers ────────────────────────────────────────────────

/**
 * Collaborative filtering score: how often similar donors funded this campaign.
 *
 * @param {Object}   userHistory     — { categories: string[], amounts: number[] }
 * @param {Object[]} allDonations    — donations from similar donors
 * @param {string}   campaignId      — target campaign ID
 * @returns {number} Score between 0 and 1
 */
function collaborativeFilterScore(userHistory, allDonations, campaignId) {
  if (!allDonations || allDonations.length === 0) return 0;

  const categorySet = new Set(userHistory.categories || []);
  let matchCount = 0;
  let weightedSum = 0;

  for (const donation of allDonations) {
    if (donation.campaign_id === campaignId) {
      matchCount += 1;
      const amountWeight = donation.amount
        ? Math.min(donation.amount / 1000, 1)
        : 0.5;
      weightedSum += amountWeight;
    }
  }

  const frequencyScore = Math.min(matchCount / Math.max(allDonations.length, 1), 1);
  const recencyScore = allDonations.length > 0 ? weightedSum / allDonations.length : 0;

  return frequencyScore * 0.6 + recencyScore * 0.4;
}

/**
 * Content-based score: category overlap + goal-range proximity.
 *
 * @param {Object} userPreferences    — { categories: string[], avgDonation: number, goalRange: { min, max } }
 * @param {Object} campaignFeatures   — { category: string, goalAmount: number }
 * @returns {number} Score between 0 and 1
 */
function contentBasedScore(userPreferences, campaignFeatures) {
  const categoryMatch =
    userPreferences.categories && campaignFeatures.category
      ? userPreferences.categories.includes(campaignFeatures.category)
        ? 1
        : 0
      : 0.5;

  let goalProximity = 0.5;
  if (userPreferences.goalRange && campaignFeatures.goalAmount) {
    const { min = 0, max = Infinity } = userPreferences.goalRange;
    const goal = campaignFeatures.goalAmount;
    if (goal >= min && goal <= max) {
      goalProximity = 1;
    } else {
      const distance = goal < min ? min - goal : goal - max;
      goalProximity = Math.max(0, 1 - distance / Math.max(max, 1));
    }
  }

  return categoryMatch * 0.6 + goalProximity * 0.4;
}

/**
 * Trending score based on recent donation velocity.
 *
 * @param {Object}  stats      — { recentDonations, daysActive, previousDonations }
 * @param {string}  timeframe  — "7d" | "30d" | "90d"
 * @returns {number} Score between 0 and 1
 */
function trendingScore(stats, timeframe = "7d") {
  if (!stats || !stats.daysActive || stats.daysActive <= 0) return 0;

  const recent = stats.recentDonations || 0;
  const previous = stats.previousDonations || 0;
  const daysActive = Math.max(stats.daysActive, 1);

  const timeframeDays =
    timeframe === "30d" ? 30 : timeframe === "90d" ? 90 : 7;

  const velocity = recent / Math.min(daysActive, timeframeDays);
  const acceleration =
    previous > 0 ? (recent - previous) / Math.max(previous, 1) : recent > 0 ? 1 : 0;

  const velocityNorm = Math.min(velocity * 10, 1);
  const accelerationNorm = Math.min((acceleration + 1) / 2, 1);

  return velocityNorm * 0.7 + accelerationNorm * 0.3;
}

/**
 * Apply a trust multiplier to an existing campaign score.
 *
 * @param {number} campaignScore — Base score before trust adjustment
 * @param {number} trustScore    — Platform trust score 0-1
 * @returns {number} Adjusted score between 0 and 1
 */
function trustWeightedScore(campaignScore, trustScore) {
  const trust = typeof trustScore === "number" ? Math.max(0, Math.min(1, trustScore)) : 0.5;
  return campaignScore * (0.5 + 0.5 * trust);
}

// ─── Internal Data Helpers ───────────────────────────────────────────────────

/**
 * Fetch a donor's donation history and derive preference signals.
 *
 * @param {string} donorId
 * @returns {Promise<{preferences: Object, donations: Object[], error?: string}>}
 */
async function fetchDonorHistory(donorId) {
  const { data, error } = await supabaseAdmin
    .from("donations")
    .select("campaign_id, amount, created_at, campaign:campaigns(id, category, goal_amount, title)")
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_SAMPLE);

  if (error) {
    logError("RecommendationEngine", "Fetch donor history error", { error: error.message, donorId });
    return { preferences: null, donations: [], error: "Failed to fetch donor history" };
  }

  const donations = data || [];
  const categoryCounts = {};
  let totalAmount = 0;
  let minGoal = Infinity;
  let maxGoal = 0;

  for (const d of donations) {
    totalAmount += d.amount || 0;
    if (d.campaign) {
      const cat = d.campaign.category;
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
      if (d.campaign.goal_amount) {
        minGoal = Math.min(minGoal, d.campaign.goal_amount);
        maxGoal = Math.max(maxGoal, d.campaign.goal_amount);
      }
    }
  }

  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const preferences = {
    categories: sortedCategories.slice(0, 5),
    avgDonation: donations.length > 0 ? totalAmount / donations.length : 0,
    totalDonations: donations.length,
    goalRange: {
      min: minGoal === Infinity ? 0 : minGoal * 0.5,
      max: maxGoal > 0 ? maxGoal * 1.5 : 10000,
    },
  };

  return { preferences, donations };
}

/**
 * Fetch all active campaigns with basic metadata.
 *
 * @param {Object}   [opts]
 * @param {string}   [opts.category]
 * @param {number}   [opts.limit=50]
 * @param {string[]} [opts.excludeIds]
 * @returns {Promise<{campaigns: Object[], error?: string}>}
 */
async function fetchActiveCampaigns({ category, limit = 50, excludeIds = [] } = {}) {
  let query = supabaseAdmin
    .from("campaigns")
    .select("id, title, category, goal_amount, current_amount, status, created_at, creator_id, creator:users(id, trust_score)")
    .eq("status", "active");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    logError("RecommendationEngine", "Fetch active campaigns error", { error: error.message });
    return { campaigns: [], error: "Failed to fetch active campaigns" };
  }

  const filtered = (data || []).filter((c) => !excludeIds.includes(c.id));
  return { campaigns: filtered };
}

/**
 * Fetch recent donation velocity stats for a campaign.
 *
 * @param {string} campaignId
 * @param {string} [timeframe="7d"]
 * @returns {Promise<{recentDonations: number, previousDonations: number, daysActive: number, donationCount: number}>}
 */
async function fetchCampaignVelocity(campaignId, timeframe = "7d") {
  const timeframeDays =
    timeframe === "30d" ? 30 : timeframe === "90d" ? 90 : 7;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
  const prevCutoff = new Date(cutoffDate);
  prevCutoff.setDate(prevCutoff.getDate() - timeframeDays);

  const { data: recent, error: err1 } = await supabaseAdmin
    .from("donations")
    .select("id, amount")
    .eq("campaign_id", campaignId)
    .gte("created_at", cutoffDate.toISOString());

  if (err1) {
    logError("RecommendationEngine", "Fetch velocity error (recent)", { error: err1.message, campaignId });
    return { recentDonations: 0, previousDonations: 0, daysActive: 1, donationCount: 0 };
  }

  const { data: previous, error: err2 } = await supabaseAdmin
    .from("donations")
    .select("id")
    .eq("campaign_id", campaignId)
    .gte("created_at", prevCutoff.toISOString())
    .lt("created_at", cutoffDate.toISOString());

  if (err2) {
    logError("RecommendationEngine", "Fetch velocity error (previous)", { error: err2.message, campaignId });
    return { recentDonations: 0, previousDonations: 0, daysActive: 1, donationCount: 0 };
  }

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("created_at")
    .eq("id", campaignId)
    .single();

  const createdAt = campaign?.created_at ? new Date(campaign.created_at) : new Date();
  const daysActive = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86400000));

  return {
    recentDonations: recent?.length || 0,
    previousDonations: previous?.length || 0,
    daysActive,
    donationCount: recent?.length || 0,
  };
}

// ─── Public Functions ────────────────────────────────────────────────────────

/**
 * Get personalised campaign recommendations for a donor.
 *
 * @param {Object}   params
 * @param {string}   params.donorId      — Donor user ID
 * @param {number}   [params.limit=10]   — Max results
 * @param {string[]} [params.excludeIds] — Campaign IDs to exclude
 * @returns {Promise<{success: boolean, data?: Array<{campaignId: string, score: number, reason: string, factors: Object}>, error?: string}>}
 */
export async function getDonorRecommendations({ donorId, limit = 10, excludeIds = [] }) {
  try {
    if (!donorId) {
      return { success: false, error: "donorId is required" };
    }

    logInfo("RecommendationEngine", "Generating donor recommendations", { donorId, limit });

    // 1. Fetch donor history and derive preferences
    const { preferences, donations: history, error: histErr } = await fetchDonorHistory(donorId);
    if (histErr) {
      return { success: false, error: histErr };
    }

    // Collect IDs the donor already funded
    const donatedCampaignIds = new Set(history.map((d) => d.campaign_id));

    // 2. Fetch candidate campaigns
    const { campaigns, error: campErr } = await fetchActiveCampaigns({ limit: 100, excludeIds });
    if (campErr) {
      return { success: false, error: campErr };
    }

    // 3. Build a set of similar donors for collaborative filtering
    const { data: similarDonations, error: simErr } = await supabaseAdmin
      .from("donations")
      .select("donor_id, campaign_id, amount")
      .in("campaign_id", history.map((d) => d.campaign_id).slice(0, 20))
      .neq("donor_id", donorId)
      .limit(MAX_SIMILAR_DONORS * 3);

    if (simErr) {
      logError("RecommendationEngine", "Similar donors fetch error", { error: simErr.message });
    }
    const similarDonorData = similarDonations || [];

    // 4. Score each candidate
    const scored = [];

    for (const campaign of campaigns) {
      // Skip already-donated campaigns
      if (donatedCampaignIds.has(campaign.id)) continue;

      const campaignFeatures = {
        category: campaign.category,
        goalAmount: campaign.goal_amount,
      };

      const velocity = await fetchCampaignVelocity(campaign.id);
      const trustScore = campaign.creator?.trust_score ?? 0.5;

      // Individual signal scores
      const contentScore = contentBasedScore(preferences, campaignFeatures);
      const collabScore = collaborativeFilterScore(
        { categories: preferences.categories },
        similarDonorData,
        campaign.id,
      );
      const trendScore = trendingScore({
        recentDonations: velocity.recentDonations,
        daysActive: velocity.daysActive,
        previousDonations: velocity.previousDonations,
      });

      // Composite score
      let composite =
        contentScore * SIGNAL_WEIGHTS.contentBased +
        collabScore * SIGNAL_WEIGHTS.collaborative +
        trendScore * SIGNAL_WEIGHTS.trending;

      // Apply trust weighting
      composite = trustWeightedScore(composite, trustScore);

      // Build human-readable reason
      const reasons = [];
      if (contentScore > 0.6) reasons.push(`matches your interest in ${campaign.category || "this category"}`);
      if (trendScore > 0.6) reasons.push("trending right now");
      if (collabScore > 0.5) reasons.push("similar donors loved this");
      if (trustScore > 0.8) reasons.push("highly trusted creator");

      scored.push({
        campaignId: campaign.id,
        score: Math.round(composite * 1000) / 1000,
        reason: reasons.length > 0 ? reasons.join("; ") : "recommended for you",
        factors: {
          categoryMatch: contentScore,
          trendingScore: trendScore,
          trustScore,
          donorAffinity: collabScore,
        },
      });
    }

    // 5. Sort by composite score, return top N
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    logInfo("RecommendationEngine", "Donor recommendations generated", {
      donorId,
      candidateCount: scored.length,
      resultCount: results.length,
    });

    return { success: true, data: results };
  } catch (err) {
    logError("RecommendationEngine", "getDonorRecommendations exception", { error: err.message, donorId });
    return { success: false, error: "Internal error generating donor recommendations" };
  }
}

/**
 * Find donors likely to donate to a specific campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Target campaign ID
 * @param {number} [params.limit=20] — Max results
 * @returns {Promise<{success: boolean, data?: Array<{donorId: string, score: number, reason: string}>, error?: string}>}
 */
export async function getCampaignDonorSuggestions({ campaignId, limit = 20 }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("RecommendationEngine", "Generating campaign donor suggestions", { campaignId, limit });

    // 1. Fetch the target campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, category, goal_amount, title, creator_id")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      logError("RecommendationEngine", "Campaign fetch error", { error: campErr?.message, campaignId });
      return { success: false, error: "Campaign not found" };
    }

    // 2. Find donors who funded campaigns in the same category
    const { data: categoryDonors, error: catErr } = await supabaseAdmin
      .from("donations")
      .select("donor_id, amount, campaign:campaigns(category, goal_amount)")
      .neq("campaign_id", campaignId)
      .limit(500);

    if (catErr) {
      logError("RecommendationEngine", "Category donors fetch error", { error: catErr.message });
      return { success: false, error: "Failed to fetch donor data" };
    }

    // 3. Aggregate and score donors
    const donorScores = {};

    for (const donation of categoryDonors || []) {
      if (!donation.campaign) continue;
      const donorId = donation.donor_id;

      if (!donorScores[donorId]) {
        donorScores[donorId] = { count: 0, totalAmount: 0, categoryMatches: 0, goalMatches: 0 };
      }

      const entry = donorScores[donorId];
      entry.count += 1;
      entry.totalAmount += donation.amount || 0;

      if (donation.campaign.category === campaign.category) {
        entry.categoryMatches += 1;
      }
      if (campaign.goal_amount && donation.campaign.goal_amount) {
        const ratio = Math.min(donation.campaign.goal_amount, campaign.goal_amount) /
          Math.max(donation.campaign.goal_amount, campaign.goal_amount);
        if (ratio > 0.3) {
          entry.goalMatches += 1;
        }
      }
    }

    // 4. Compute final scores
    const results = [];

    for (const [donorId, stats] of Object.entries(donorScores)) {
      const totalDonors = Object.keys(donorScores).length;
      const frequencyScore = Math.min(stats.count / Math.max(totalDonors * 0.1, 1), 1);
      const categoryScore = stats.count > 0 ? stats.categoryMatches / stats.count : 0;
      const goalScore = stats.count > 0 ? stats.goalMatches / stats.count : 0;
      const amountScore = Math.min(stats.totalAmount / (stats.count * 500), 1);

      const score =
        categoryScore * 0.35 +
        goalScore * 0.20 +
        frequencyScore * 0.25 +
        amountScore * 0.20;

      const reasons = [];
      if (categoryScore > 0.5) reasons.push(`funds ${campaign.category || "similar"} campaigns`);
      if (frequencyScore > 0.3) reasons.push("active and frequent donor");
      if (amountScore > 0.5) reasons.push("generous donor");

      results.push({
        donorId,
        score: Math.round(score * 1000) / 1000,
        reason: reasons.length > 0 ? reasons.join("; ") : "potential match",
      });
    }

    results.sort((a, b) => b.score - a.score);
    const sliced = results.slice(0, limit);

    logInfo("RecommendationEngine", "Campaign donor suggestions generated", {
      campaignId,
      scoredDonors: results.length,
      resultCount: sliced.length,
    });

    return { success: true, data: sliced };
  } catch (err) {
    logError("RecommendationEngine", "getCampaignDonorSuggestions exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error generating donor suggestions" };
  }
}

/**
 * Find campaigns similar to a given campaign using embeddings or feature matching.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Reference campaign ID
 * @param {number} [params.limit=5]  — Max results
 * @returns {Promise<{success: boolean, data?: Array<{campaignId: string, score: number, reason: string, sharedCategories: string[], goalSimilarity: number}>, error?: string}>}
 */
export async function getSimilarCampaigns({ campaignId, limit = 5 }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("RecommendationEngine", "Finding similar campaigns", { campaignId, limit });

    // 1. Fetch the reference campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, description, category, goal_amount, status, tags")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      logError("RecommendationEngine", "Reference campaign fetch error", { error: campErr?.message, campaignId });
      return { success: false, error: "Campaign not found" };
    }

    // 2. Try embedding-based similarity first
    let embeddingResults = [];
    try {
      const searchText = [campaign.title, campaign.description, campaign.category]
        .filter(Boolean)
        .join(" ");

      const embResult = await searchEmbeddings({
        query: searchText,
        resourceType: "campaign",
        limit: limit * 3,
      });

      if (embResult.success && embResult.data) {
        embeddingResults = embResult.data.filter(
          (r) => r.resourceId !== campaignId && r.resourceType === "campaign",
        );
      }
    } catch (_embErr) {
      // Embedding search not available — fall back to feature matching
    }

    // 3. Fetch all active campaigns for feature-based fallback
    const { data: allCampaigns, error: allErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, category, goal_amount, current_amount, status")
      .eq("status", "active")
      .neq("id", campaignId)
      .limit(200);

    if (allErr) {
      logError("RecommendationEngine", "Fetch campaigns for similarity error", { error: allErr.message });
      return { success: false, error: "Failed to fetch campaigns" };
    }

    // 4. Build embedding score map
    const embScoreMap = {};
    for (const er of embeddingResults) {
      embScoreMap[er.resourceId] = er.score || er.similarity || 0;
    }

    // 5. Score all candidates
    const scored = [];

    for (const candidate of allCampaigns || []) {
      // Category similarity
      const sharedCategories = [];
      if (candidate.category && campaign.category && candidate.category === campaign.category) {
        sharedCategories.push(candidate.category);
      }

      // Goal similarity
      let goalSimilarity = 0;
      if (candidate.goal_amount && campaign.goal_amount) {
        const ratio = Math.min(candidate.goal_amount, campaign.goal_amount) /
          Math.max(candidate.goal_amount, campaign.goal_amount);
        goalSimilarity = ratio;
      }

      // Embedding similarity (primary signal when available)
      const embScore = embScoreMap[candidate.id] || 0;

      // Tag overlap
      const candidateTags = new Set(candidate.tags || []);
      const referenceTags = new Set(campaign.tags || []);
      let tagOverlap = 0;
      if (candidateTags.size > 0 && referenceTags.size > 0) {
        let matches = 0;
        for (const tag of referenceTags) {
          if (candidateTags.has(tag)) matches++;
        }
        tagOverlap = matches / Math.max(candidateTags.size + referenceTags.size - matches, 1);
      }

      // Composite similarity
      let score;
      if (embScore > 0) {
        // Embedding available — weight it heavily
        score =
          embScore * 0.60 +
          goalSimilarity * 0.15 +
          (sharedCategories.length > 0 ? 1 : 0) * 0.10 +
          tagOverlap * 0.15;
      } else {
        // Feature-based fallback
        score =
          (sharedCategories.length > 0 ? 1 : 0) * 0.40 +
          goalSimilarity * 0.30 +
          tagOverlap * 0.30;
      }

      const reasons = [];
      if (sharedCategories.length > 0) reasons.push(`same category (${sharedCategories[0]})`);
      if (goalSimilarity > 0.7) reasons.push("similar goal amount");
      if (tagOverlap > 0.3) reasons.push("overlapping tags");
      if (embScore > 0.7) reasons.push("semantically similar");

      scored.push({
        campaignId: candidate.id,
        score: Math.round(score * 1000) / 1000,
        reason: reasons.length > 0 ? reasons.join("; ") : "similar profile",
        sharedCategories,
        goalSimilarity: Math.round(goalSimilarity * 1000) / 1000,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    logInfo("RecommendationEngine", "Similar campaigns found", {
      campaignId,
      candidateCount: scored.length,
      resultCount: results.length,
    });

    return { success: true, data: results };
  } catch (err) {
    logError("RecommendationEngine", "getSimilarCampaigns exception", { error: err.message, campaignId });
    return { success: false, error: "Internal error finding similar campaigns" };
  }
}

/**
 * Get trending campaigns ranked by recent donation velocity.
 *
 * @param {Object}  params
 * @param {number}  [params.limit=10]
 * @param {string}  [params.timeframe="7d"]  — "7d" | "30d" | "90d"
 * @param {string}  [params.category]        — Filter by category
 * @returns {Promise<{success: boolean, data?: Array<{campaignId: string, score: number, velocity: number, reason: string, donationCount: number, recentGrowth: number}>, error?: string}>}
 */
export async function getTrendingCampaigns({ limit = 10, timeframe = "7d", category } = {}) {
  try {
    logInfo("RecommendationEngine", "Generating trending campaigns", { limit, timeframe, category });

    // 1. Fetch active campaigns
    const { campaigns, error: campErr } = await fetchActiveCampaigns({ category, limit: 100 });
    if (campErr) {
      return { success: false, error: campErr };
    }

    // 2. Score each by velocity
    const scored = [];

    for (const campaign of campaigns) {
      const velocity = await fetchCampaignVelocity(campaign.id, timeframe);

      const recencyWeight =
        timeframe === "30d" ? 0.8 : timeframe === "90d" ? 0.6 : 1;

      const daysActive = Math.max(velocity.daysActive, 1);
      const recentDonations = velocity.recentDonations;
      const previousDonations = velocity.previousDonations;

      const velocityRate = (recentDonations / daysActive) * recencyWeight;

      // Growth rate: how much donations grew vs previous period
      const recentGrowth =
        previousDonations > 0
          ? ((recentDonations - previousDonations) / previousDonations) * 100
          : recentDonations > 0
            ? 100
            : 0;

      // Composite trending score
      const score = Math.min(
        velocityRate * 2 + Math.max(recentGrowth, 0) / 200,
        1,
      );

      const reasons = [];
      if (recentDonations > 10) reasons.push(`${recentDonations} donations this period`);
      if (recentGrowth > 50) reasons.push(`${Math.round(recentGrowth)}% growth`);
      if (velocityRate > 1) reasons.push("strong daily velocity");

      scored.push({
        campaignId: campaign.id,
        score: Math.round(score * 1000) / 1000,
        velocity: Math.round(velocityRate * 1000) / 1000,
        reason: reasons.length > 0 ? reasons.join("; ") : "gaining traction",
        donationCount: recentDonations,
        recentGrowth: Math.round(recentGrowth * 10) / 10,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    logInfo("RecommendationEngine", "Trending campaigns generated", {
      timeframe,
      category,
      resultCount: results.length,
    });

    return { success: true, data: results };
  } catch (err) {
    logError("RecommendationEngine", "getTrendingCampaigns exception", { error: err.message });
    return { success: false, error: "Internal error generating trending campaigns" };
  }
}

/**
 * Recommend campaign categories and goal ranges for a creator based on their track record.
 *
 * @param {Object} params
 * @param {string} params.creatorId — Creator user ID
 * @param {number} [params.limit=5]
 * @returns {Promise<{success: boolean, data?: Array<{category: string, goalRange: {min: number, max: number}, reason: string, expectedSuccess: number}>, error?: string}>}
 */
export async function getCreatorRecommendations({ creatorId, limit = 5 }) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    logInfo("RecommendationEngine", "Generating creator recommendations", { creatorId, limit });

    // 1. Fetch the creator's existing campaigns
    const { data: campaigns, error: campErr } = await supabaseAdmin
      .from("campaigns")
      .select("id, category, goal_amount, current_amount, status, created_at")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (campErr) {
      logError("RecommendationEngine", "Creator campaigns fetch error", { error: campErr.message, creatorId });
      return { success: false, error: "Failed to fetch creator campaigns" };
    }

    // 2. Fetch the creator's trust score and profile
    const { data: creator, error: creatorErr } = await supabaseAdmin
      .from("users")
      .select("trust_score, total_raised, total_campaigns")
      .eq("id", creatorId)
      .single();

    if (creatorErr) {
      logError("RecommendationEngine", "Creator profile fetch error", { error: creatorErr.message, creatorId });
      return { success: false, error: "Failed to fetch creator profile" };
    }

    // 3. Analyse performance per category
    const categoryStats = {};
    for (const c of campaigns || []) {
      const cat = c.category || "uncategorized";
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, totalGoal: 0, totalRaised: 0, successCount: 0 };
      }
      const stats = categoryStats[cat];
      stats.count += 1;
      stats.totalGoal += c.goal_amount || 0;
      stats.totalRaised += c.current_amount || 0;
      if (c.current_amount >= c.goal_amount && c.goal_amount > 0) {
        stats.successCount += 1;
      }
    }

    // 4. Build recommendations
    const results = [];

    for (const [category, stats] of Object.entries(categoryStats)) {
      const avgGoal = stats.count > 0 ? stats.totalGoal / stats.count : 0;
      const avgRaised = stats.count > 0 ? stats.totalRaised / stats.count : 0;
      const successRate = stats.count > 0 ? stats.successCount / stats.count : 0;

      // Determine optimal goal range based on what worked
      const fundedGoals = (campaigns || [])
        .filter((c) => c.category === category && c.current_amount > 0)
        .map((c) => c.goal_amount)
        .filter(Boolean)
        .sort((a, b) => a - b);

      const minGoal = fundedGoals.length > 0
        ? fundedGoals[Math.floor(fundedGoals.length * 0.25)]
        : avgGoal * 0.7;
      const maxGoal = fundedGoals.length > 0
        ? fundedGoals[Math.floor(fundedGoals.length * 0.75)]
        : avgGoal * 1.3;

      // Expected success probability
      const trustBoost = (creator?.trust_score || 0.5) * 0.2;
      const expectedSuccess = Math.min(successRate * 0.8 + trustBoost + 0.1, 1);

      const reasons = [];
      if (successRate > 0.5) reasons.push(`${Math.round(successRate * 100)}% success rate in this category`);
      if (avgRaised > avgGoal * 0.5) reasons.push(`averages ${Math.round((avgRaised / avgGoal) * 100)}% funding`);
      if (stats.count >= 2) reasons.push("proven track record");

      results.push({
        category,
        goalRange: {
          min: Math.round(minGoal),
          max: Math.round(maxGoal),
        },
        reason: reasons.length > 0 ? reasons.join("; ") : "based on your profile",
        expectedSuccess: Math.round(expectedSuccess * 1000) / 1000,
      });
    }

    // Also suggest unexplored high-potential categories if we have room
    const allCategories = [
      "technology", "health", "education", "environment",
      "arts", "community", "social", "business", "creative",
    ];
    const unexplored = allCategories.filter((cat) => !categoryStats[cat]);
    const trustScore = creator?.trust_score || 0.5;

    for (const cat of unexplored) {
      if (results.length >= limit) break;
      results.push({
        category: cat,
        goalRange: { min: 500, max: 5000 },
        reason: "new category opportunity",
        expectedSuccess: Math.round(Math.min(trustScore * 0.6 + 0.2, 1) * 1000) / 1000,
      });
    }

    results.sort((a, b) => b.expectedSuccess - a.expectedSuccess);
    const sliced = results.slice(0, limit);

    logInfo("RecommendationEngine", "Creator recommendations generated", {
      creatorId,
      categoryCount: results.length,
      resultCount: sliced.length,
    });

    return { success: true, data: sliced };
  } catch (err) {
    logError("RecommendationEngine", "getCreatorRecommendations exception", { error: err.message, creatorId });
    return { success: false, error: "Internal error generating creator recommendations" };
  }
}

/**
 * Invalidate cached recommendations for a user or type.
 *
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} [params.type]   — One of RECOMMENDATION_TYPES values
 * @returns {Promise<{success: boolean, data?: {invalidated: boolean}, error?: string}>}
 */
export async function invalidateRecommendationCache({ userId, type } = {}) {
  try {
    logInfo("RecommendationEngine", "Invalidating recommendation cache", { userId, type });

    if (!userId && !type) {
      return { success: false, error: "At least one of userId or type is required" };
    }

    // Delete matching cache entries from recommendation_cache table
    let query = supabaseAdmin.from("recommendation_cache").delete();

    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (type) {
      query = query.eq("recommendation_type", type);
    }

    const { error } = await query;

    if (error) {
      // Table may not exist yet — treat as success with warning
      logError("RecommendationEngine", "Cache invalidation DB error", { error: error.message, userId, type });
    }

    logInfo("RecommendationEngine", "Recommendation cache invalidated", { userId, type });

    return { success: true, data: { invalidated: true } };
  } catch (err) {
    logError("RecommendationEngine", "invalidateRecommendationCache exception", { error: err.message, userId, type });
    return { success: false, error: "Internal error invalidating recommendation cache" };
  }
}

// ─── Backward Compatibility ───

/**
 * Get recommendations (generic router for backward compatibility).
 * Routes to the appropriate recommendation function based on type.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.type — Recommendation type: "campaigns_for_donor", "trending", "similar"
 * @param {string} [params.entityId] — Entity ID (for "similar" type)
 * @param {number} [params.limit] — Max results
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getRecommendations({ userId, type, entityId, limit }) {
  try {
    switch (type) {
      case "campaigns_for_donor":
        return await getDonorRecommendations({ donorId: userId, limit });
      case "trending":
        return await getTrendingCampaigns({ limit });
      case "similar":
        if (!entityId) {
          return { success: false, error: "entityId is required for 'similar' recommendations" };
        }
        return await getSimilarCampaigns({ campaignId: entityId, limit });
      default:
        return { success: false, error: `Unknown recommendation type: ${type}` };
    }
  } catch (err) {
    logError("RecommendationEngine", "getRecommendations failed", { userId, type, error: err.message });
    return { success: false, error: err.message };
  }
}

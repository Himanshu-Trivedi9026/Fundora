/**
 * Reputation Engine — Weighted reputation scoring across multiple dimensions.
 *
 * Calculates composite reputation scores for creators, donors, and campaigns
 * based on various behavioral and performance metrics.
 *
 * Dimensions:
 *   - Creator: quality, reliability, communication, transparency, community, verification
 *   - Donor: engagement, generosity, feedback_quality, campaign_adherence
 *   - Campaign: funding_progress, milestone_adherence, transparency, creator_reputation,
 *               donor_sentiment, update_frequency
 *
 * Output:
 *   - overallScore: 0-100 composite reputation score
 *   - scores: per-dimension breakdown
 *   - stats: raw statistics used for calculation
 *
 * All functions return { success: boolean, data?: any, error?: string } — never throw.
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Reputation Dimensions & Weights ───

/**
 * Creator reputation dimensions and their weights (must sum to 1.0).
 */
export const REPUTATION_DIMENSIONS = {
  CREATOR: {
    quality: { weight: 0.25, label: "Content Quality" },
    reliability: { weight: 0.2, label: "Reliability" },
    communication: { weight: 0.15, label: "Communication" },
    transparency: { weight: 0.15, label: "Transparency" },
    community: { weight: 0.1, label: "Community" },
    verification: { weight: 0.15, label: "Verification" },
  },
  DONOR: {
    engagement: { weight: 0.25, label: "Engagement" },
    generosity: { weight: 0.25, label: "Generosity" },
    feedback_quality: { weight: 0.3, label: "Feedback Quality" },
    campaign_adherence: { weight: 0.2, label: "Campaign Adherence" },
  },
  CAMPAIGN: {
    funding_progress: { weight: 0.2, label: "Funding Progress" },
    milestone_adherence: { weight: 0.2, label: "Milestone Adherence" },
    transparency: { weight: 0.2, label: "Transparency" },
    creator_reputation: { weight: 0.15, label: "Creator Reputation" },
    donor_sentiment: { weight: 0.15, label: "Donor Sentiment" },
    update_frequency: { weight: 0.1, label: "Update Frequency" },
  },
};

/**
 * Penalty configuration.
 */
export const REPUTATION_WEIGHTS = {
  PENALTY_PER_INCIDENT: 5,
  MAX_PENALTY: 50,
  DECAY_FACTOR: 0.95,
  MIN_SCORE: 0,
  MAX_SCORE: 100,
};

// ─── Creator Reputation ───

/**
 * Calculate weighted reputation score for a creator.
 *
 * Queries campaign stats, milestone stats, and reviews to compute
 * a composite score across six dimensions.
 *
 * @param {string} creatorId — Creator user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculateCreatorReputation(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    logInfo("ReputationEngine", "Calculating creator reputation", {
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Fetch creator's campaigns
    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, status, goal_amount, current_amount, created_at, updated_at")
      .eq("creator_id", creatorId);

    if (campaignError) {
      logError("ReputationEngine", "Fetch campaigns error", {
        error: campaignError.message,
      });
      return { success: false, error: "Failed to fetch creator campaigns" };
    }

    const allCampaigns = campaigns || [];

    // Fetch milestone stats across all campaigns
    const campaignIds = allCampaigns.map((c) => c.id);
    let milestones = [];

    if (campaignIds.length > 0) {
      const { data: milestoneData, error: milestoneError } = await supabaseAdmin
        .from("campaign_milestones")
        .select(
          "id, campaign_id, status, target_amount, release_amount, approval_percentage",
        )
        .in("campaign_id", campaignIds);

      if (milestoneError) {
        logWarn("ReputationEngine", "Fetch milestones error", {
          error: milestoneError.message,
        });
      } else {
        milestones = milestoneData || [];
      }
    }

    // Fetch reviews for the creator's campaigns
    let reviews = [];

    if (campaignIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabaseAdmin
        .from("milestone_reviews")
        .select("id, decision, vote_weight, reviewer_id, milestone_id")
        .in(
          "milestone_id",
          milestones.map((m) => m.id),
        );

      if (reviewError) {
        logWarn("ReputationEngine", "Fetch reviews error", {
          error: reviewError.message,
        });
      } else {
        reviews = reviewData || [];
      }
    }

    // Fetch donation stats for creator's campaigns
    let donations = [];

    if (campaignIds.length > 0) {
      const { data: donationData, error: donationError } = await supabaseAdmin
        .from("donations")
        .select("id, amount, campaign_id, status, created_at")
        .in("campaign_id", campaignIds);

      if (donationError) {
        logWarn("ReputationEngine", "Fetch donations error", {
          error: donationError.message,
        });
      } else {
        donations = donationData || [];
      }
    }

    // Fetch verification status
    const { data: verification, error: verificationError } = await supabaseAdmin
      .from("creator_verifications")
      .select("verification_level, verified_at")
      .eq("creator_id", creatorId)
      .single();

    // Compute dimension scores
    const scores = {
      quality: scoreCreatorQuality(allCampaigns, milestones, donations),
      reliability: scoreCreatorReliability(allCampaigns, milestones),
      communication: scoreCreatorCommunication(reviews, allCampaigns),
      transparency: scoreCreatorTransparency(milestones, allCampaigns),
      community: scoreCreatorCommunity(reviews, donations),
      verification: scoreCreatorVerification(verification),
    };

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore(
      scores,
      REPUTATION_DIMENSIONS.CREATOR,
    );

    // Compute stats
    const totalCampaigns = allCampaigns.length;
    const completedCampaigns = allCampaigns.filter(
      (c) => c.status === "completed" || c.status === "funded",
    ).length;
    const totalRaised = allCampaigns.reduce(
      (sum, c) => sum + (c.current_amount || 0),
      0,
    );
    const completedMilestones = milestones.filter(
      (m) => m.status === "completed",
    ).length;
    const totalMilestones = milestones.length;
    const approvalRate =
      reviews.length > 0
        ? Math.round(
            (reviews.filter((r) => r.decision === "approved").length /
              reviews.length) *
              100,
          )
        : 0;
    const totalDonations = donations.length;
    const averageDonation =
      totalDonations > 0
        ? Math.round(
            donations.reduce((sum, d) => sum + (d.amount || 0), 0) /
              totalDonations,
          )
        : 0;

    const result = {
      overallScore,
      scores,
      stats: {
        totalCampaigns,
        completedCampaigns,
        totalRaised,
        completedMilestones,
        totalMilestones,
        approvalRate,
        totalDonations,
        averageDonation,
        verificationLevel: verification?.verification_level || 0,
      },
      lastCalculated: new Date().toISOString(),
    };

    logInfo("ReputationEngine", "Creator reputation calculated", {
      creatorId: creatorId.substring(0, 8) + "...",
      overallScore,
    });

    return { success: true, data: result };
  } catch (err) {
    logError("ReputationEngine", "Calculate creator reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to calculate creator reputation" };
  }
}

/**
 * Fetch cached creator reputation from creator_reputation table.
 *
 * @param {string} creatorId — Creator user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCreatorReputation(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("creator_reputation")
      .select("*")
      .eq("creator_id", creatorId)
      .single();

    if (error || !data) {
      return { success: false, error: "Creator reputation not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ReputationEngine", "Get creator reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch creator reputation" };
  }
}

// ─── Donor Reputation ───

/**
 * Calculate weighted reputation score for a donor.
 *
 * @param {string} donorId — Donor user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculateDonorReputation(donorId) {
  try {
    if (!donorId) {
      return { success: false, error: "donorId is required" };
    }

    logInfo("ReputationEngine", "Calculating donor reputation", {
      donorId: donorId.substring(0, 8) + "...",
    });

    // Fetch donor's donations
    const { data: donations, error: donationError } = await supabaseAdmin
      .from("donations")
      .select("id, amount, campaign_id, status, created_at")
      .eq("donor_id", donorId);

    if (donationError) {
      logError("ReputationEngine", "Fetch donor donations error", {
        error: donationError.message,
      });
      return { success: false, error: "Failed to fetch donor donations" };
    }

    const allDonations = donations || [];

    // Fetch milestone reviews by this donor
    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from("milestone_reviews")
      .select("id, decision, vote_weight, milestone_id")
      .eq("reviewer_id", donorId);

    const allReviews = reviewError ? [] : reviews || [];

    // Fetch campaigns the donor has backed
    const backedCampaignIds = [
      ...new Set(allDonations.map((d) => d.campaign_id)),
    ];

    let backedCampaigns = [];
    if (backedCampaignIds.length > 0) {
      const { data: campaignData } = await supabaseAdmin
        .from("campaigns")
        .select("id, status, creator_id")
        .in("id", backedCampaignIds);

      backedCampaigns = campaignData || [];
    }

    // Compute dimension scores
    const scores = {
      engagement: scoreDonorEngagement(
        allDonations,
        allReviews,
        backedCampaigns.length,
      ),
      generosity: scoreDonorGenerosity(allDonations),
      feedback_quality: scoreDonorFeedbackQuality(allReviews),
      campaign_adherence: scoreDonorCampaignAdherence(
        allDonations,
        backedCampaigns,
      ),
    };

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore(
      scores,
      REPUTATION_DIMENSIONS.DONOR,
    );

    // Compute stats
    const totalDonations = allDonations.length;
    const totalAmount = allDonations.reduce(
      (sum, d) => sum + (d.amount || 0),
      0,
    );
    const averageDonation =
      totalDonations > 0 ? Math.round(totalAmount / totalDonations) : 0;
    const uniqueCampaigns = backedCampaignIds.length;
    const completedDonations = allDonations.filter(
      (d) => d.status === "completed",
    ).length;
    const completionRate =
      totalDonations > 0
        ? Math.round((completedDonations / totalDonations) * 100)
        : 0;
    const totalReviews = allReviews.length;
    const approvalReviews = allReviews.filter(
      (r) => r.decision === "approved",
    ).length;

    const result = {
      overallScore,
      scores,
      stats: {
        totalDonations,
        totalAmount,
        averageDonation,
        uniqueCampaigns,
        completionRate,
        totalReviews,
        approvalReviews,
      },
      lastCalculated: new Date().toISOString(),
    };

    logInfo("ReputationEngine", "Donor reputation calculated", {
      donorId: donorId.substring(0, 8) + "...",
      overallScore,
    });

    return { success: true, data: result };
  } catch (err) {
    logError("ReputationEngine", "Calculate donor reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to calculate donor reputation" };
  }
}

/**
 * Fetch cached donor reputation from donor_reputation table.
 *
 * @param {string} donorId — Donor user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getDonorReputation(donorId) {
  try {
    if (!donorId) {
      return { success: false, error: "donorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("donor_reputation")
      .select("*")
      .eq("donor_id", donorId)
      .single();

    if (error || !data) {
      return { success: false, error: "Donor reputation not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ReputationEngine", "Get donor reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch donor reputation" };
  }
}

// ─── Campaign Reputation ───

/**
 * Calculate weighted reputation score for a campaign.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculateCampaignReputation(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    logInfo("ReputationEngine", "Calculating campaign reputation", {
      campaignId,
    });

    // Fetch campaign data
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select(
        "id, creator_id, status, goal_amount, current_amount, created_at, updated_at",
      )
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Fetch milestones for this campaign
    const { data: milestones, error: milestoneError } = await supabaseAdmin
      .from("campaign_milestones")
      .select(
        "id, status, target_amount, release_amount, approval_percentage, created_at",
      )
      .eq("campaign_id", campaignId);

    const allMilestones = milestoneError ? [] : milestones || [];

    // Fetch donations for this campaign
    const { data: donations, error: donationError } = await supabaseAdmin
      .from("donations")
      .select("id, amount, status, created_at")
      .eq("campaign_id", campaignId);

    const allDonations = donationError ? [] : donations || [];

    // Fetch reviews for this campaign's milestones
    let reviews = [];
    if (allMilestones.length > 0) {
      const { data: reviewData, error: reviewError } = await supabaseAdmin
        .from("milestone_reviews")
        .select("id, decision, vote_weight")
        .in(
          "milestone_id",
          allMilestones.map((m) => m.id),
        );

      reviews = reviewError ? [] : reviewData || [];
    }

    // Fetch creator reputation for creator_reputation dimension
    let creatorRepScore = 50;
    const { data: creatorRep } = await supabaseAdmin
      .from("creator_reputation")
      .select("overall_score")
      .eq("creator_id", campaign.creator_id)
      .single();

    if (creatorRep) {
      creatorRepScore = creatorRep.overall_score || 50;
    }

    // Fetch campaign updates count
    let updateCount = 0;
    const { count } = await supabaseAdmin
      .from("campaign_updates")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    updateCount = count || 0;

    // Compute dimension scores
    const scores = {
      funding_progress: scoreCampaignFundingProgress(campaign),
      milestone_adherence: scoreCampaignMilestoneAdherence(allMilestones),
      transparency: scoreCampaignTransparency(allMilestones, allDonations),
      creator_reputation: creatorRepScore,
      donor_sentiment: scoreCampaignDonorSentiment(reviews, allDonations),
      update_frequency: scoreCampaignUpdateFrequency(
        updateCount,
        campaign.created_at,
      ),
    };

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore(
      scores,
      REPUTATION_DIMENSIONS.CAMPAIGN,
    );

    // Compute stats
    const totalRaised = campaign.current_amount || 0;
    const goalAmount = campaign.goal_amount || 0;
    const fundingPercentage =
      goalAmount > 0 ? Math.round((totalRaised / goalAmount) * 100) : 0;
    const completedMilestones = allMilestones.filter(
      (m) => m.status === "completed",
    ).length;
    const totalMilestones = allMilestones.length;
    const milestoneCompletionRate =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;
    const totalDonations = allDonations.length;
    const totalDonors = totalDonations;
    const averageDonation =
      totalDonations > 0
        ? Math.round(
            allDonations.reduce((sum, d) => sum + (d.amount || 0), 0) /
              totalDonations,
          )
        : 0;

    const result = {
      overallScore,
      scores,
      stats: {
        totalRaised,
        goalAmount,
        fundingPercentage,
        completedMilestones,
        totalMilestones,
        milestoneCompletionRate,
        totalDonations,
        totalDonors,
        averageDonation,
        updateCount,
      },
      lastCalculated: new Date().toISOString(),
    };

    logInfo("ReputationEngine", "Campaign reputation calculated", {
      campaignId,
      overallScore,
    });

    return { success: true, data: result };
  } catch (err) {
    logError("ReputationEngine", "Calculate campaign reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to calculate campaign reputation" };
  }
}

/**
 * Fetch cached campaign reputation from campaign_reputation table.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCampaignReputation(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_reputation")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    if (error || !data) {
      return { success: false, error: "Campaign reputation not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ReputationEngine", "Get campaign reputation error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch campaign reputation" };
  }
}

// ─── Reputation Penalties ───

/**
 * Apply a reputation penalty to a user. Decreases score and logs the event.
 *
 * @param {string} userId — User ID
 * @param {number} penaltyCount — Number of penalty incidents
 * @param {string} reason — Reason for the penalty
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateReputationPenalty(userId, penaltyCount, reason) {
  try {
    if (!userId || !penaltyCount || !reason) {
      return {
        success: false,
        error: "userId, penaltyCount, and reason are required",
      };
    }

    logInfo("ReputationEngine", "Applying reputation penalty", {
      userId: userId.substring(0, 8) + "...",
      penaltyCount,
    });

    // Calculate penalty amount
    const penaltyAmount = Math.min(
      REPUTATION_WEIGHTS.MAX_PENALTY,
      penaltyCount * REPUTATION_WEIGHTS.PENALTY_PER_INCIDENT,
    );

    // Try creator_reputation first, then donor_reputation
    let table = null;
    let idField = null;

    const { data: creatorRep } = await supabaseAdmin
      .from("creator_reputation")
      .select("id, overall_score")
      .eq("creator_id", userId)
      .single();

    if (creatorRep) {
      table = "creator_reputation";
      idField = "creator_id";
    } else {
      const { data: donorRep } = await supabaseAdmin
        .from("donor_reputation")
        .select("id, overall_score")
        .eq("donor_id", userId)
        .single();

      if (donorRep) {
        table = "donor_reputation";
        idField = "donor_id";
      }
    }

    if (!table) {
      return {
        success: false,
        error: "No reputation record found for this user",
      };
    }

    // Fetch current score
    const { data: currentRep } = await supabaseAdmin
      .from(table)
      .select("overall_score, penalty_count")
      .eq(idField, userId)
      .single();

    const previousScore = currentRep?.overall_score || 0;
    const previousPenaltyCount = currentRep?.penalty_count || 0;
    const newScore = Math.max(
      REPUTATION_WEIGHTS.MIN_SCORE,
      previousScore - penaltyAmount,
    );

    // Update reputation with penalty
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({
        overall_score: newScore,
        penalty_count: previousPenaltyCount + penaltyCount,
        last_penalty_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq(idField, userId)
      .select()
      .single();

    if (error) {
      logError("ReputationEngine", "Update reputation penalty error", {
        error: error.message,
      });
      return { success: false, error: "Failed to update reputation penalty" };
    }

    await logAuditEvent({
      eventType: "reputation.penalty_applied",
      entityType: table,
      entityId: userId,
      userId,
      action: "apply_penalty",
      details: {
        previousScore,
        newScore,
        penaltyAmount,
        penaltyCount,
        reason,
      },
    });

    logInfo("ReputationEngine", "Reputation penalty applied", {
      userId: userId.substring(0, 8) + "...",
      previousScore,
      newScore,
      penaltyAmount,
    });

    return { success: true, data };
  } catch (err) {
    logError("ReputationEngine", "Apply reputation penalty error", {
      error: err.message,
    });
    return { success: false, error: "Failed to apply reputation penalty" };
  }
}

// ─── Leaderboard ───

/**
 * Get top creators or donors by overall reputation score.
 *
 * @param {Object} params
 * @param {string} [params.type="creator"] — "creator" or "donor"
 * @param {number} [params.limit=20] — Max results
 * @param {number} [params.offset=0] — Offset for pagination
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getReputationLeaderboard({
  type = "creator",
  limit = 20,
  offset = 0,
} = {}) {
  try {
    if (type !== "creator" && type !== "donor") {
      return { success: false, error: 'type must be "creator" or "donor"' };
    }

    const table =
      type === "creator" ? "creator_reputation" : "donor_reputation";
    const idField = type === "creator" ? "creator_id" : "donor_id";

    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order("overall_score", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("ReputationEngine", "Fetch leaderboard error", {
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to fetch reputation leaderboard",
      };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("ReputationEngine", "Get reputation leaderboard error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch reputation leaderboard" };
  }
}

// ─── Internal Scoring Helpers ───

/**
 * Calculate weighted score from dimension scores and weights.
 *
 * @param {Object} scores — { dimensionName: score (0-100) }
 * @param {Object} dimensions — { dimensionName: { weight, label } }
 * @returns {number} Weighted overall score (0-100)
 */
function calculateWeightedScore(scores, dimensions) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [dim, config] of Object.entries(dimensions)) {
    const score = scores[dim] || 0;
    weightedSum += score * config.weight;
    totalWeight += config.weight;
  }

  return totalWeight > 0
    ? Math.min(100, Math.max(0, Math.round(weightedSum / totalWeight)))
    : 0;
}

/**
 * Score creator quality based on campaign funding success and milestone outcomes.
 */
function scoreCreatorQuality(campaigns, milestones, donations) {
  if (campaigns.length === 0) return 30;

  const fundedCampaigns = campaigns.filter(
    (c) => (c.current_amount || 0) >= (c.goal_amount || 1),
  );
  const fundingRate = fundedCampaigns.length / campaigns.length;

  const completedMilestones = milestones.filter(
    (m) => m.status === "completed",
  ).length;
  const milestoneRate =
    milestones.length > 0 ? completedMilestones / milestones.length : 0;

  const score = Math.round(fundingRate * 50 + milestoneRate * 50);
  return Math.min(100, Math.max(0, score));
}

/**
 * Score creator reliability based on milestone completion and campaign activity.
 */
function scoreCreatorReliability(campaigns, milestones) {
  if (campaigns.length === 0) return 25;

  const completedMilestones = milestones.filter(
    (m) => m.status === "completed",
  ).length;
  const totalMilestones = milestones.length;
  const completionRate =
    totalMilestones > 0 ? completedMilestones / totalMilestones : 0;

  const activeCampaigns = campaigns.filter(
    (c) =>
      c.status === "active" ||
      c.status === "funded" ||
      c.status === "completed",
  );
  const activityRate = activeCampaigns.length / campaigns.length;

  const score = Math.round(completionRate * 60 + activityRate * 40);
  return Math.min(100, Math.max(0, score));
}

/**
 * Score creator communication based on review outcomes and engagement.
 */
function scoreCreatorCommunication(reviews, campaigns) {
  if (reviews.length === 0) return campaigns.length > 0 ? 40 : 30;

  const positiveReviews = reviews.filter(
    (r) => r.decision === "approved",
  ).length;
  const positiveRate = positiveReviews / reviews.length;

  return Math.min(100, Math.max(0, Math.round(positiveRate * 100)));
}

/**
 * Score creator transparency based on milestone documentation.
 */
function scoreCreatorTransparency(milestones, campaigns) {
  if (milestones.length === 0) return campaigns.length > 0 ? 35 : 30;

  const documentedMilestones = milestones.filter(
    (m) => m.target_amount > 0 && m.release_amount > 0,
  );
  const documentationRate = documentedMilestones.length / milestones.length;

  return Math.min(100, Math.max(0, Math.round(documentationRate * 100)));
}

/**
 * Score creator community based on review participation.
 */
function scoreCreatorCommunity(reviews, donations) {
  const reviewCount = reviews.length;
  const donationCount = donations.length;

  if (reviewCount === 0 && donationCount === 0) return 25;

  const reviewScore = Math.min(60, reviewCount * 5);
  const donationScore = Math.min(40, donationCount * 2);

  return Math.min(100, reviewScore + donationScore);
}

/**
 * Score creator verification based on verification level.
 */
function scoreCreatorVerification(verification) {
  if (!verification) return 10;

  const level = verification.verification_level || 0;
  const levelScores = { 0: 10, 1: 30, 2: 50, 3: 70, 4: 85, 5: 95 };

  return levelScores[level] || 10;
}

/**
 * Score donor engagement based on donation frequency and review participation.
 */
function scoreDonorEngagement(donations, reviews, backedCampaignCount) {
  const donationFrequency = donations.length;
  const reviewParticipation = reviews.length;

  const frequencyScore = Math.min(60, donationFrequency * 3);
  const reviewScore = Math.min(30, reviewParticipation * 5);
  const diversityScore = Math.min(10, backedCampaignCount * 2);

  return Math.min(100, frequencyScore + reviewScore + diversityScore);
}

/**
 * Score donor generosity based on donation amounts and consistency.
 */
function scoreDonorGenerosity(donations) {
  if (donations.length === 0) return 20;

  const totalAmount = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
  const averageAmount = totalAmount / donations.length;

  // Scale: higher average donation = higher generosity score
  const amountScore = Math.min(70, Math.round(averageAmount / 100));

  // Consistency: more donations = higher score
  const consistencyScore = Math.min(30, donations.length * 3);

  return Math.min(100, amountScore + consistencyScore);
}

/**
 * Score donor feedback quality based on review decisions.
 */
function scoreDonorFeedbackQuality(reviews) {
  if (reviews.length === 0) return 30;

  const validReviews = reviews.filter(
    (r) => r.decision === "approved" || r.decision === "rejected",
  );
  const validRate = validReviews.length / reviews.length;

  const volumeScore = Math.min(50, reviews.length * 5);
  const qualityScore = Math.round(validRate * 50);

  return Math.min(100, volumeScore + qualityScore);
}

/**
 * Score donor campaign adherence based on completion of backed campaigns.
 */
function scoreDonorCampaignAdherence(donations, backedCampaigns) {
  if (backedCampaigns.length === 0) return 30;

  const completedBacked = backedCampaigns.filter(
    (c) => c.status === "completed" || c.status === "funded",
  ).length;
  const adherenceRate = completedBacked / backedCampaigns.length;

  return Math.min(100, Math.max(0, Math.round(adherenceRate * 100)));
}

/**
 * Score campaign funding progress relative to goal.
 */
function scoreCampaignFundingProgress(campaign) {
  const goal = campaign.goal_amount || 0;
  const current = campaign.current_amount || 0;

  if (goal <= 0) return 30;

  const percentage = (current / goal) * 100;
  return Math.min(100, Math.round(percentage));
}

/**
 * Score campaign milestone adherence.
 */
function scoreCampaignMilestoneAdherence(milestones) {
  if (milestones.length === 0) return 30;

  const completed = milestones.filter((m) => m.status === "completed").length;
  const active = milestones.filter(
    (m) => m.status === "active" || m.status === "submitted",
  ).length;
  const failed = milestones.filter(
    (m) => m.status === "rejected" || m.status === "cancelled",
  ).length;

  const completionRate = completed / milestones.length;
  const failureRate = failed / milestones.length;

  const score = Math.round(completionRate * 80 + (1 - failureRate) * 20);
  return Math.min(100, Math.max(0, score));
}

/**
 * Score campaign transparency based on milestone and donation documentation.
 */
function scoreCampaignTransparency(milestones, donations) {
  let score = 30; // Base score

  if (milestones.length > 0) {
    const documented = milestones.filter(
      (m) => m.target_amount > 0 || m.release_amount > 0,
    ).length;
    score += Math.round((documented / milestones.length) * 35);
  }

  if (donations.length > 0) {
    // More donations with data = more transparent
    score += Math.min(35, donations.length * 2);
  }

  return Math.min(100, score);
}

/**
 * Score campaign donor sentiment based on review outcomes.
 */
function scoreCampaignDonorSentiment(reviews, donations) {
  if (reviews.length === 0) return donations.length > 0 ? 50 : 30;

  const approved = reviews.filter((r) => r.decision === "approved").length;
  const sentimentRate = approved / reviews.length;

  return Math.min(100, Math.max(0, Math.round(sentimentRate * 100)));
}

/**
 * Score campaign update frequency.
 */
function scoreCampaignUpdateFrequency(updateCount, createdAt) {
  if (!createdAt) return 30;

  const daysSinceCreation = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  // Target: ~1 update per week
  const expectedUpdates = Math.floor(daysSinceCreation / 7);
  const updateRate =
    expectedUpdates > 0
      ? updateCount / expectedUpdates
      : updateCount > 0
        ? 1
        : 0;

  return Math.min(100, Math.round(updateRate * 100));
}

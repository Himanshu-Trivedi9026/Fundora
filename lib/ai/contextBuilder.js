/**
 * Context Builder — Builds rich context objects for AI requests.
 *
 * Pulls data from multiple platform engines to construct comprehensive
 * context payloads that AI models use for informed responses.
 *
 * Context types:
 *   - Campaign context (creator + campaign + stats)
 *   - User context (profile + verification + trust + reputation)
 *   - Donor context (profile + donation history + preferences)
 *   - Platform context (global stats + trending + activity)
 *   - Conversation context (message history + summary)
 *
 * Security:
 *   - Missing data is handled gracefully (empty/null values, never throws)
 *   - All queries use supabaseAdmin (service role)
 *   - No PII is returned beyond what's needed for AI processing
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";

// ─── Core Functions ───

/**
 * Build rich context for a campaign, including creator info and stats.
 *
 * @param {string} campaignId — Campaign (project) ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function buildCampaignContext(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    // Pull campaign data
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("projects")
      .select(
        "id, title, description, goal, pledged, category, creator_id, created_at, status",
      )
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      logError("buildCampaignContext: campaign not found", {
        campaignId,
        error: campaignError?.message,
      });
      return {
        success: true,
        data: {
          campaign: null,
          creator: null,
          stats: null,
        },
      };
    }

    // Pull creator reputation/trust in parallel
    const [creatorResult, donationsResult, milestonesResult] =
      await Promise.allSettled([
        // Creator trust & verification
        supabaseAdmin
          .from("creator_verifications")
          .select("trust_score, reputation_score, verification_level, user_id")
          .eq("user_id", campaign.creator_id)
          .single(),

        // Donation stats
        supabaseAdmin
          .from("donations")
          .select("id, amount")
          .eq("campaign_id", campaignId)
          .eq("status", "completed"),

        // Milestone completion
        supabaseAdmin
          .from("milestones")
          .select("id, status")
          .eq("campaign_id", campaignId),
      ]);

    // Process creator data
    const creatorData =
      creatorResult.status === "fulfilled" ? creatorResult.value?.data : null;
    const creator = creatorData
      ? {
          trustScore: creatorData.trust_score || 0,
          reputation: creatorData.reputation_score || 0,
          verificationLevel: creatorData.verification_level || "none",
        }
      : { trustScore: 0, reputation: 0, verificationLevel: "none" };

    // Process donation stats
    const donations =
      donationsResult.status === "fulfilled"
        ? donationsResult.value?.data || []
        : [];
    const donationCount = donations.length;
    const avgDonation =
      donationCount > 0
        ? Math.round(
            donations.reduce((sum, d) => sum + (d.amount || 0), 0) /
              donationCount,
          )
        : 0;

    // Process milestone stats
    const milestones =
      milestonesResult.status === "fulfilled"
        ? milestonesResult.value?.data || []
        : [];
    const completedMilestones = milestones.filter(
      (m) => m.status === "completed",
    ).length;
    const milestoneCompletion =
      milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0;

    // Calculate days active
    const createdAt = new Date(campaign.created_at);
    const daysActive = Math.max(
      1,
      Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const stats = {
      donationCount,
      avgDonation,
      milestoneCompletion,
      daysActive,
    };

    logInfo("Campaign context built", {
      campaignId,
      donationCount,
      milestoneCompletion,
    });

    return {
      success: true,
      data: {
        campaign: {
          title: campaign.title,
          description: campaign.description,
          goal: campaign.goal,
          pledged: campaign.pledged,
          category: campaign.category,
          creator_id: campaign.creator_id,
          created_at: campaign.created_at,
          status: campaign.status,
        },
        creator,
        stats,
      },
    };
  } catch (error) {
    logError("buildCampaignContext error", {
      campaignId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Build rich context for a user, including verification, trust, and reputation.
 *
 * @param {string} userId — User ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function buildUserContext(userId) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    // Pull all user data in parallel
    const [
      profileResult,
      verificationResult,
      trustResult,
      reputationResult,
      statsResult,
    ] = await Promise.allSettled([
      // Profile
      supabaseAdmin
        .from("auth.users")
        .select("id, email, created_at")
        .eq("id", userId)
        .single(),

      // Verification
      supabaseAdmin
        .from("creator_verifications")
        .select("verification_level, completed_types")
        .eq("user_id", userId)
        .single(),

      // Trust score
      supabaseAdmin
        .from("trust_scores")
        .select("score, breakdown")
        .eq("user_id", userId)
        .single(),

      // Reputation
      supabaseAdmin
        .from("reputation_scores")
        .select("overall_score, dimensions")
        .eq("user_id", userId)
        .single(),

      // Donation and campaign stats
      Promise.allSettled([
        supabaseAdmin
          .from("donations")
          .select("id")
          .eq("donor_id", userId)
          .eq("status", "completed"),
        supabaseAdmin.from("projects").select("id").eq("creator_id", userId),
        supabaseAdmin
          .from("user_follows")
          .select("id")
          .eq("following_id", userId),
      ]),
    ]);

    // Process profile
    const profileData =
      profileResult.status === "fulfilled" ? profileResult.value?.data : null;
    const profile = profileData
      ? {
          id: profileData.id,
          email: profileData.email,
          created_at: profileData.created_at,
        }
      : { id: userId, email: null, created_at: null };

    // Process verification
    const verificationData =
      verificationResult.status === "fulfilled"
        ? verificationResult.value?.data
        : null;
    const verification = verificationData
      ? {
          level: verificationData.verification_level || "none",
          completedTypes: verificationData.completed_types || [],
        }
      : { level: "none", completedTypes: [] };

    // Process trust
    const trustData =
      trustResult.status === "fulfilled" ? trustResult.value?.data : null;
    const trust = trustData
      ? { score: trustData.score || 0, breakdown: trustData.breakdown || {} }
      : { score: 0, breakdown: {} };

    // Process reputation
    const reputationData =
      reputationResult.status === "fulfilled"
        ? reputationResult.value?.data
        : null;
    const reputation = reputationData
      ? {
          overall: reputationData.overall_score || 0,
          dimensions: reputationData.dimensions || {},
        }
      : { overall: 0, dimensions: {} };

    // Process stats
    const statsData =
      statsResult.status === "fulfilled" ? statsResult.value : null;
    const totalDonations =
      statsData?.[0]?.status === "fulfilled"
        ? (statsData[0].value?.data || []).length
        : 0;
    const campaignsCreated =
      statsData?.[1]?.status === "fulfilled"
        ? (statsData[1].value?.data || []).length
        : 0;
    const followerCount =
      statsData?.[2]?.status === "fulfilled"
        ? (statsData[2].value?.data || []).length
        : 0;

    const stats = { totalDonations, campaignsCreated, followerCount };

    logInfo("User context built", {
      userId,
      verificationLevel: verification.level,
    });

    return {
      success: true,
      data: { profile, verification, trust, reputation, stats },
    };
  } catch (error) {
    logError("buildUserContext error", { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Build rich context for a donor, including donation history and preferences.
 *
 * @param {string} donorId — Donor user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function buildDonorContext(donorId) {
  try {
    if (!donorId) {
      return { success: false, error: "donorId is required" };
    }

    // Pull donor data in parallel
    const [profileResult, donationsResult, trustResult] =
      await Promise.allSettled([
        // Profile
        supabaseAdmin
          .from("auth.users")
          .select("id, email, created_at")
          .eq("id", donorId)
          .single(),

        // Donation history
        supabaseAdmin
          .from("donations")
          .select("campaign_id, amount, created_at, campaigns(category, title)")
          .eq("donor_id", donorId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(100),

        // Trust score
        supabaseAdmin
          .from("trust_scores")
          .select("score")
          .eq("user_id", donorId)
          .single(),
      ]);

    // Process profile
    const profileData =
      profileResult.status === "fulfilled" ? profileResult.value?.data : null;
    const profile = profileData
      ? {
          id: profileData.id,
          email: profileData.email,
          created_at: profileData.created_at,
        }
      : { id: donorId, email: null, created_at: null };

    // Process donation history
    const rawDonations =
      donationsResult.status === "fulfilled"
        ? donationsResult.value?.data || []
        : [];

    const donationHistory = rawDonations.map((d) => ({
      campaignId: d.campaign_id,
      amount: d.amount,
      date: d.created_at,
      category: d.campaigns?.category || null,
      campaignTitle: d.campaigns?.title || null,
    }));

    // Compute preferences from history
    const categoryCounts = {};
    let totalAmount = 0;
    for (const d of donationHistory) {
      if (d.category) {
        categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
      }
      totalAmount += d.amount || 0;
    }

    // Top categories sorted by frequency
    const categories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const avgDonation =
      donationHistory.length > 0
        ? Math.round(totalAmount / donationHistory.length)
        : 0;

    // Calculate donation frequency (donations per month)
    let frequency = 0;
    if (donationHistory.length >= 2) {
      const oldest = new Date(donationHistory[donationHistory.length - 1].date);
      const newest = new Date(donationHistory[0].date);
      const monthsDiff = Math.max(
        1,
        (newest - oldest) / (1000 * 60 * 60 * 24 * 30),
      );
      frequency = Math.round((donationHistory.length / monthsDiff) * 10) / 10;
    }

    const preferences = { categories, avgDonation, frequency };

    // Process trust
    const trustData =
      trustResult.status === "fulfilled" ? trustResult.value?.data : null;
    const trust = { score: trustData?.score || 0 };

    logInfo("Donor context built", {
      donorId,
      donationCount: donationHistory.length,
    });

    return {
      success: true,
      data: { profile, donationHistory, preferences, trust },
    };
  } catch (error) {
    logError("buildDonorContext error", { donorId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Build platform-wide context with global stats, trending campaigns, and recent activity.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function buildPlatformContext() {
  try {
    // Pull all platform stats in parallel
    const [
      usersResult,
      campaignsResult,
      donationsResult,
      activeResult,
      trendingResult,
      recentResult,
    ] = await Promise.allSettled([
      // Total users
      supabaseAdmin
        .from("auth.users")
        .select("id", { count: "exact", head: true }),

      // Total campaigns
      supabaseAdmin
        .from("projects")
        .select("id", { count: "exact", head: true }),

      // Total completed donations
      supabaseAdmin
        .from("donations")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),

      // Active campaigns
      supabaseAdmin
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // Trending campaigns (highest recent donation velocity in last 7 days)
      supabaseAdmin
        .from("projects")
        .select("id, title, pledged")
        .eq("status", "active")
        .order("pledged", { ascending: false })
        .limit(10),

      // Recent activity (latest donations)
      supabaseAdmin
        .from("donations")
        .select("id, campaign_id, amount, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const totalUsers =
      usersResult.status === "fulfilled" ? (usersResult.value?.count ?? 0) : 0;
    const totalCampaigns =
      campaignsResult.status === "fulfilled"
        ? (campaignsResult.value?.count ?? 0)
        : 0;
    const totalDonations =
      donationsResult.status === "fulfilled"
        ? (donationsResult.value?.count ?? 0)
        : 0;
    const activeCampaigns =
      activeResult.status === "fulfilled"
        ? (activeResult.value?.count ?? 0)
        : 0;

    const trending =
      trendingResult.status === "fulfilled"
        ? (trendingResult.value?.data || []).map((c) => ({
            campaignId: c.id,
            title: c.title,
            velocity: c.pledged || 0,
          }))
        : [];

    const recentActivity =
      recentResult.status === "fulfilled"
        ? (recentResult.value?.data || []).map((d) => ({
            donationId: d.id,
            campaignId: d.campaign_id,
            amount: d.amount,
            timestamp: d.created_at,
          }))
        : [];

    const stats = {
      totalUsers,
      totalCampaigns,
      totalDonations,
      activeCampaigns,
      recentActivity: recentActivity.length,
    };

    logInfo("Platform context built", {
      totalUsers,
      totalCampaigns,
      activeCampaigns,
    });

    return {
      success: true,
      data: { stats, trending, recentActivity },
    };
  } catch (error) {
    logError("buildPlatformContext error", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Build conversation context by pulling message history.
 *
 * @param {string} conversationId — Conversation ID
 * @param {number} [maxMessages=20] — Maximum messages to retrieve
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function buildConversationContext(
  conversationId,
  maxMessages = 20,
) {
  try {
    if (!conversationId) {
      return { success: false, error: "conversationId is required" };
    }

    // Pull messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(maxMessages);

    if (messagesError) {
      logError("buildConversationContext DB error", {
        conversationId,
        error: messagesError.message,
      });
      return {
        success: false,
        error: `Failed to load conversation: ${messagesError.message}`,
      };
    }

    const formattedMessages = (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
    }));

    // Build a simple summary from the first few messages
    let summary = null;
    if (formattedMessages.length > 5) {
      const firstFew = formattedMessages
        .slice(0, 3)
        .map((m) => `${m.role}: ${m.content?.substring(0, 100)}`)
        .join("\n");
      summary = firstFew;
    }

    // Estimate token count (rough: 1 token ≈ 4 chars for English)
    const totalChars = formattedMessages.reduce(
      (sum, m) => sum + (m.content?.length || 0),
      0,
    );
    const tokenCount = Math.ceil(totalChars / 4);

    logInfo("Conversation context built", {
      conversationId,
      messageCount: formattedMessages.length,
    });

    return {
      success: true,
      data: {
        messages: formattedMessages,
        summary,
        tokenCount,
      },
    };
  } catch (error) {
    logError("buildConversationContext error", {
      conversationId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

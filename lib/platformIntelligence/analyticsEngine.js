/**
 * Analytics Engine — Platform intelligence and metrics storage.
 *
 * Provides comprehensive platform analytics by aggregating data from
 * multiple tables: users, campaigns, donations, escrow, fraud, trust,
 * milestones, payouts, verifications, and moderation.
 *
 * Features:
 *   - Platform health scoring
 *   - Trust distribution analysis
 *   - Fraud trend tracking
 *   - Escrow utilization metrics
 *   - Milestone and payout success rates
 *   - User and campaign performance stats
 *   - Persistent metric storage and retrieval
 *
 * Security:
 *   - Read-only aggregation queries
 *   - All queries use service-role client
 *   - Structured logging for every operation
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent, hashIP } from "../verification/auditLog";

// ─── Constants ───

export const METRIC_TYPES = {
  PLATFORM_HEALTH: "platform_health",
  TRUST_DISTRIBUTION: "trust_distribution",
  FRAUD_TRENDS: "fraud_trends",
  ESCROW_STATS: "escrow_stats",
  MILESTONE_COMPLETION: "milestone_completion",
  PAYOUT_SUCCESS: "payout_success",
  USER_GROWTH: "user_growth",
  CAMPAIGN_PERFORMANCE: "campaign_performance",
  VERIFICATION_STATS: "verification_stats",
  ENGAGEMENT_METRICS: "engagement_metrics",
  MODERATION_STATS: "moderation_stats",
};

export const AGGREGATION_PERIODS = {
  HOURLY: "hourly",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

// ─── Core Analytics Functions ───

/**
 * Calculate overall platform health score.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculatePlatformHealth() {
  try {
    // Total and active users
    const { count: totalUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", thirtyDaysAgo);

    // Total and active campaigns
    const { count: totalCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id", { count: "exact", head: true });

    const { count: activeCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Donations
    const { count: totalDonations } = await supabaseAdmin
      .from("donations")
      .select("id", { count: "exact", head: true });

    const { data: donationSum } = await supabaseAdmin
      .from("donations")
      .select("amount")
      .eq("status", "completed");

    const totalRaised = (donationSum || []).reduce((sum, d) => sum + (d.amount || 0), 0);

    // Fraud rate
    const { count: fraudAlerts } = await supabaseAdmin
      .from("fraud_alerts")
      .select("id", { count: "exact", head: true });

    const fraudRate = totalUsers > 0 ? ((fraudAlerts || 0) / totalUsers) * 100 : 0;

    // Compliance rate
    const { count: complianceIssues } = await supabaseAdmin
      .from("compliance_cases")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed");

    const complianceRate = totalUsers > 0
      ? ((totalUsers - (complianceIssues || 0)) / totalUsers) * 100
      : 100;

    // Average trust score
    const { data: trustScores } = await supabaseAdmin
      .from("trust_scores")
      .select("score");

    const avgTrustScore = (trustScores || []).length > 0
      ? (trustScores.reduce((sum, t) => sum + (t.score || 0), 0)) / trustScores.length
      : 0;

    // Calculate overall score (0-100)
    const overallScore = Math.round(
      (Math.min(activeUsers || 0, 1000) / 10) * 0.15
      + (Math.min(activeCampaigns || 0, 500) / 5) * 0.2
      + (Math.min(totalRaised / 100, 100)) * 0.25
      + (100 - fraudRate) * 0.2
      + complianceRate * 0.1
      + avgTrustScore * 0.1,
    );

    return {
      success: true,
      data: {
        overallScore: Math.max(0, Math.min(100, overallScore)),
        metrics: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalCampaigns: totalCampaigns || 0,
          activeCampaigns: activeCampaigns || 0,
          totalDonations: totalDonations || 0,
          totalRaised: totalRaised || 0,
          fraudRate: Math.round(fraudRate * 100) / 100,
          complianceRate: Math.round(complianceRate * 100) / 100,
          averageTrustScore: Math.round(avgTrustScore * 100) / 100,
        },
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Failed to calculate platform health", { error: error.message });
    return { success: false, error: "Failed to calculate platform health" };
  }
}

/**
 * Calculate trust score distribution across the platform.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculateTrustDistribution() {
  try {
    const { data, error } = await supabaseAdmin
      .from("trust_scores")
      .select("score");

    if (error) {
      logError("AnalyticsEngine", "Failed to get trust scores", { error: error.message });
      return { success: false, error: "Failed to calculate trust distribution" };
    }

    const scores = (data || []).map((s) => s.score || 0);
    const total = scores.length;

    const low = scores.filter((s) => s < 30).length;
    const medium = scores.filter((s) => s >= 30 && s < 60).length;
    const high = scores.filter((s) => s >= 60 && s < 85).length;
    const critical = scores.filter((s) => s >= 85).length;

    const average = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

    return {
      success: true,
      data: {
        low,
        medium,
        high,
        critical,
        average: Math.round(average * 100) / 100,
        total,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error calculating trust distribution", { error: error.message });
    return { success: false, error: "Failed to calculate trust distribution" };
  }
}

/**
 * Get fraud trends over a time period.
 *
 * @param {Object} params
 * @param {string} params.startDate — Start date (ISO string)
 * @param {string} params.endDate — End date (ISO string)
 * @param {string} [params.period="daily"] — Aggregation period
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getFraudTrends({ startDate, endDate, period = AGGREGATION_PERIODS.DAILY } = {}) {
  try {
    let query = supabaseAdmin
      .from("fraud_alerts")
      .select("id, risk_level, created_at, status");

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query.order("created_at", { ascending: true });

    if (error) {
      logError("AnalyticsEngine", "Failed to get fraud trends", { error: error.message });
      return { success: false, error: "Failed to get fraud trends" };
    }

    // Aggregate by period
    const aggregated = aggregateByPeriod(data || [], period);

    return { success: true, data: aggregated };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting fraud trends", { error: error.message });
    return { success: false, error: "Failed to get fraud trends" };
  }
}

/**
 * Get escrow utilization statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getEscrowStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .select("balance, status, total_donated");

    if (error) {
      logError("AnalyticsEngine", "Failed to get escrow stats", { error: error.message });
      return { success: false, error: "Failed to get escrow stats" };
    }

    const accounts = data || [];
    const activeAccounts = accounts.filter((a) => a.status === "active");
    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalDonated = accounts.reduce((sum, a) => sum + (a.total_donated || 0), 0);

    const utilizationRate = totalDonated > 0 ? (totalBalance / totalDonated) * 100 : 0;

    return {
      success: true,
      data: {
        totalLocked: totalBalance,
        totalReleased: totalDonated - totalBalance,
        totalRefunded: 0,
        activeAccounts: activeAccounts.length,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting escrow stats", { error: error.message });
    return { success: false, error: "Failed to get escrow stats" };
  }
}

/**
 * Get milestone completion statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getMilestoneCompletionStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("milestones")
      .select("id, status");

    if (error) {
      logError("AnalyticsEngine", "Failed to get milestone stats", { error: error.message });
      return { success: false, error: "Failed to get milestone stats" };
    }

    const milestones = data || [];
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === "completed").length;
    const approved = milestones.filter((m) => m.status === "approved").length;
    const rejected = milestones.filter((m) => m.status === "rejected").length;

    const averageApproval = total > 0 ? (approved / total) * 100 : 0;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      success: true,
      data: {
        total,
        completed,
        approved,
        rejected,
        averageApproval: Math.round(averageApproval * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting milestone stats", { error: error.message });
    return { success: false, error: "Failed to get milestone stats" };
  }
}

/**
 * Get payout success rate statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPayoutSuccessStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .select("id, status, created_at, processed_at");

    if (error) {
      logError("AnalyticsEngine", "Failed to get payout stats", { error: error.message });
      return { success: false, error: "Failed to get payout stats" };
    }

    const payouts = data || [];
    const total = payouts.length;
    const completed = payouts.filter((p) => p.status === "completed").length;
    const failed = payouts.filter((p) => p.status === "failed").length;

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    const processingTimes = payouts
      .filter((p) => p.processed_at && p.created_at)
      .map((p) => new Date(p.processed_at).getTime() - new Date(p.created_at).getTime());

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    return {
      success: true,
      data: {
        total,
        completed,
        failed,
        successRate: Math.round(successRate * 100) / 100,
        averageProcessingTime: Math.round(averageProcessingTime / (1000 * 60)), // minutes
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting payout stats", { error: error.message });
    return { success: false, error: "Failed to get payout stats" };
  }
}

/**
 * Get user growth statistics.
 *
 * @param {Object} params
 * @param {string} [params.period="daily"] — Aggregation period
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getUserGrowthStats({ period = AGGREGATION_PERIODS.DAILY } = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .order("created_at", { ascending: true });

    if (error) {
      logError("AnalyticsEngine", "Failed to get user growth", { error: error.message });
      return { success: false, error: "Failed to get user growth stats" };
    }

    const aggregated = aggregateByPeriod(
      (data || []).map((u) => ({ created_at: u.created_at })),
      period,
    );

    // Cumulative count
    let cumulative = 0;
    const cumulativeData = aggregated.map((entry) => {
      cumulative += entry.count;
      return { ...entry, totalUsers: cumulative };
    });

    return { success: true, data: cumulativeData };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting user growth stats", { error: error.message });
    return { success: false, error: "Failed to get user growth stats" };
  }
}

/**
 * Get campaign performance statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCampaignPerformanceStats() {
  try {
    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, status, goal_amount, raised_amount, created_at");

    if (campaignError) {
      logError("AnalyticsEngine", "Failed to get campaign stats", { error: campaignError.message });
      return { success: false, error: "Failed to get campaign performance stats" };
    }

    const campaignsList = campaigns || [];
    const total = campaignsList.length;
    const active = campaignsList.filter((c) => c.status === "active").length;
    const completed = campaignsList.filter((c) => c.status === "completed").length;
    const failed = campaignsList.filter((c) => c.status === "failed").length;

    const totalGoalAmount = campaignsList.reduce((sum, c) => sum + (c.goal_amount || 0), 0);
    const totalRaisedAmount = campaignsList.reduce((sum, c) => sum + (c.raised_amount || 0), 0);
    const fundingRate = totalGoalAmount > 0 ? (totalRaisedAmount / totalGoalAmount) * 100 : 0;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    const averageGoal = total > 0 ? totalGoalAmount / total : 0;
    const averageRaised = total > 0 ? totalRaisedAmount / total : 0;

    return {
      success: true,
      data: {
        total,
        active,
        completed,
        failed,
        fundingRate: Math.round(fundingRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        totalGoalAmount,
        totalRaisedAmount,
        averageGoal: Math.round(averageGoal),
        averageRaised: Math.round(averageRaised),
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting campaign performance stats", { error: error.message });
    return { success: false, error: "Failed to get campaign performance stats" };
  }
}

/**
 * Get verification completion statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getVerificationStats() {
  try {
    const { data: verifications, error } = await supabaseAdmin
      .from("verifications")
      .select("id, status, verification_type, created_at");

    if (error) {
      logError("AnalyticsEngine", "Failed to get verification stats", { error: error.message });
      return { success: false, error: "Failed to get verification stats" };
    }

    const verificationsList = verifications || [];
    const total = verificationsList.length;
    const completed = verificationsList.filter((v) => v.status === "verified" || v.status === "approved").length;
    const pending = verificationsList.filter((v) => v.status === "pending" || v.status === "in_progress").length;
    const failed = verificationsList.filter((v) => v.status === "failed" || v.status === "rejected").length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // By type
    const byType = {};
    for (const v of verificationsList) {
      const type = v.verification_type || "unknown";
      if (!byType[type]) {
        byType[type] = { total: 0, completed: 0, failed: 0 };
      }
      byType[type].total += 1;
      if (v.status === "verified" || v.status === "approved") byType[type].completed += 1;
      if (v.status === "failed" || v.status === "rejected") byType[type].failed += 1;
    }

    return {
      success: true,
      data: {
        total,
        completed,
        pending,
        failed,
        completionRate: Math.round(completionRate * 100) / 100,
        byType,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting verification stats", { error: error.message });
    return { success: false, error: "Failed to get verification stats" };
  }
}

/**
 * Get engagement metrics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getEngagementMetrics() {
  try {
    // Total donations
    const { count: totalDonations } = await supabaseAdmin
      .from("donations")
      .select("id", { count: "exact", head: true });

    // Unique donors
    const { data: donors } = await supabaseAdmin
      .from("donations")
      .select("donor_id");

    const uniqueDonors = new Set((donors || []).map((d) => d.donor_id)).size;

    // Average donation amount
    const { data: donationAmounts } = await supabaseAdmin
      .from("donations")
      .select("amount")
      .eq("status", "completed");

    const amounts = (donationAmounts || []).map((d) => d.amount || 0);
    const averageDonation = amounts.length > 0
      ? amounts.reduce((a, b) => a + b, 0) / amounts.length
      : 0;

    // Comments and shares (if available)
    const { count: totalComments } = await supabaseAdmin
      .from("comments")
      .select("id", { count: "exact", head: true });

    return {
      success: true,
      data: {
        totalDonations: totalDonations || 0,
        uniqueDonors,
        averageDonation: Math.round(averageDonation),
        totalComments: totalComments || 0,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting engagement metrics", { error: error.message });
    return { success: false, error: "Failed to get engagement metrics" };
  }
}

/**
 * Get moderation statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getModerationStats() {
  try {
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from("reports")
      .select("id, status, category, created_at");

    if (reportsError) {
      logError("AnalyticsEngine", "Failed to get moderation stats", { error: reportsError.message });
      return { success: false, error: "Failed to get moderation stats" };
    }

    const reportsList = reports || [];
    const total = reportsList.length;
    const pending = reportsList.filter((r) => r.status === "pending").length;
    const resolved = reportsList.filter((r) => r.status === "resolved").length;
    const dismissed = reportsList.filter((r) => r.status === "dismissed").length;

    // By category
    const byCategory = {};
    for (const r of reportsList) {
      const cat = r.category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    const resolutionRate = total > 0 ? ((resolved + dismissed) / total) * 100 : 0;

    return {
      success: true,
      data: {
        total,
        pending,
        resolved,
        dismissed,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        byCategory,
      },
    };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting moderation stats", { error: error.message });
    return { success: false, error: "Failed to get moderation stats" };
  }
}

// ─── Metric Storage ───

/**
 * Store a computed metric.
 *
 * @param {Object} params
 * @param {string} params.metricType — Type from METRIC_TYPES
 * @param {string} params.metricDate — Date for the metric (ISO date string)
 * @param {Object} params.metricData — Metric data payload
 * @param {string} [params.aggregationPeriod="daily"] — Aggregation period
 * @param {string} [params.source="system"] — Source of the metric
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function storeMetric({
  metricType,
  metricDate,
  metricData,
  aggregationPeriod = AGGREGATION_PERIODS.DAILY,
  source = "system",
}) {
  try {
    if (!metricType || !metricDate || !metricData) {
      return { success: false, error: "metricType, metricDate, and metricData are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("platform_metrics")
      .insert({
        metric_type: metricType,
        metric_date: metricDate,
        metric_data: metricData,
        aggregation_period: aggregationPeriod,
        source,
      })
      .select("*")
      .single();

    if (error) {
      logError("AnalyticsEngine", "Failed to store metric", { error: error.message, metricType });
      return { success: false, error: "Failed to store metric" };
    }

    logInfo("AnalyticsEngine", "Metric stored", { metricType, metricDate, aggregationPeriod });

    return { success: true, data };
  } catch (error) {
    logError("AnalyticsEngine", "Error storing metric", { error: error.message });
    return { success: false, error: "Failed to store metric" };
  }
}

/**
 * Retrieve stored metrics with optional filters.
 *
 * @param {Object} params
 * @param {string} params.metricType — Type from METRIC_TYPES
 * @param {string} [params.startDate] — Start date filter (ISO date)
 * @param {string} [params.endDate] — End date filter (ISO date)
 * @param {string} [params.aggregationPeriod] — Filter by aggregation period
 * @param {number} [params.limit=100] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, data?: Object[], total?: number, error?: string}>}
 */
export async function getStoredMetrics({
  metricType,
  startDate,
  endDate,
  aggregationPeriod,
  limit = 100,
  offset = 0,
} = {}) {
  try {
    if (!metricType) {
      return { success: false, error: "metricType is required" };
    }

    let query = supabaseAdmin
      .from("platform_metrics")
      .select("*", { count: "exact" })
      .eq("metric_type", metricType);

    if (startDate) query = query.gte("metric_date", startDate);
    if (endDate) query = query.lte("metric_date", endDate);
    if (aggregationPeriod) query = query.eq("aggregation_period", aggregationPeriod);

    query = query
      .order("metric_date", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("AnalyticsEngine", "Failed to get stored metrics", { error: error.message, metricType });
      return { success: false, error: "Failed to get stored metrics" };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (error) {
    logError("AnalyticsEngine", "Error getting stored metrics", { error: error.message });
    return { success: false, error: "Failed to get stored metrics" };
  }
}

// ─── Internal Helpers ───

/**
 * Aggregate records by time period.
 *
 * @param {Object[]} records — Records with created_at field
 * @param {string} period — Aggregation period
 * @returns {Object[]}
 */
function aggregateByPeriod(records, period) {
  const buckets = {};

  for (const record of records) {
    const date = new Date(record.created_at);
    let key;

    switch (period) {
      case AGGREGATION_PERIODS.HOURLY:
        key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        break;
      case AGGREGATION_PERIODS.DAILY:
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
        break;
      case AGGREGATION_PERIODS.WEEKLY: {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD (Sunday)
        break;
      }
      case AGGREGATION_PERIODS.MONTHLY:
        key = date.toISOString().slice(0, 7); // YYYY-MM
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }

    if (!buckets[key]) {
      buckets[key] = { date: key, count: 0 };
    }
    buckets[key].count += 1;
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

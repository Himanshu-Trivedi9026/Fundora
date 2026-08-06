/**
 * Admin Platform Analytics API — Platform intelligence dashboard.
 *
 * GET — Platform health, trust distribution, fraud trends, escrow stats, etc.
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import {
  calculatePlatformHealth,
  calculateTrustDistribution,
  getFraudTrends,
  getEscrowStats,
  getMilestoneCompletionStats,
  getPayoutSuccessStats,
  getUserGrowthStats,
  getCampaignPerformanceStats,
  getVerificationStats,
  getEngagementMetrics,
  getModerationStats,
} from "../../../lib/platformIntelligence/analyticsEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { mode, startDate, endDate, period } = req.query;

      if (mode === "health" || !mode) {
        const health = await calculatePlatformHealth();
        return res.status(200).json({ success: true, data: health.success ? health.data : {} });
      }

      if (mode === "trust") {
        const trust = await calculateTrustDistribution();
        return res.status(200).json({ success: true, data: trust.success ? trust.data : {} });
      }

      if (mode === "fraud") {
        const fraud = await getFraudTrends({ startDate, endDate, period });
        return res.status(200).json({ success: true, data: fraud.success ? fraud.data : {} });
      }

      if (mode === "escrow") {
        const escrow = await getEscrowStats();
        return res.status(200).json({ success: true, data: escrow.success ? escrow.data : {} });
      }

      if (mode === "milestones") {
        const milestones = await getMilestoneCompletionStats();
        return res.status(200).json({ success: true, data: milestones.success ? milestones.data : {} });
      }

      if (mode === "payouts") {
        const payouts = await getPayoutSuccessStats();
        return res.status(200).json({ success: true, data: payouts.success ? payouts.data : {} });
      }

      if (mode === "growth") {
        const growth = await getUserGrowthStats({ period });
        return res.status(200).json({ success: true, data: growth.success ? growth.data : {} });
      }

      if (mode === "engagement") {
        const engagement = await getEngagementMetrics();
        return res.status(200).json({ success: true, data: engagement.success ? engagement.data : {} });
      }

      if (mode === "verification") {
        const verification = await getVerificationStats();
        return res.status(200).json({ success: true, data: verification.success ? verification.data : {} });
      }

      if (mode === "campaigns") {
        const campaigns = await getCampaignPerformanceStats();
        return res.status(200).json({ success: true, data: campaigns.success ? campaigns.data : {} });
      }

      if (mode === "moderation") {
        const moderation = await getModerationStats();
        return res.status(200).json({ success: true, data: moderation.success ? moderation.data : {} });
      }

      if (mode === "all") {
        const [health, trust, escrow, milestones, payouts] = await Promise.all([
          calculatePlatformHealth(),
          calculateTrustDistribution(),
          getEscrowStats(),
          getMilestoneCompletionStats(),
          getPayoutSuccessStats(),
        ]);
        return res.status(200).json({
          success: true,
          data: {
            health: health.success ? health.data : {},
            trust: trust.success ? trust.data : {},
            escrow: escrow.success ? escrow.data : {},
            milestones: milestones.success ? milestones.data : {},
            payouts: payouts.success ? payouts.data : {},
          },
        });
      }

      return res.status(400).json({ error: "Invalid mode" });
    } catch (err) {
      logError("PlatformAnalyticsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch platform analytics" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}, [ROLES.ADMIN]);

/**
 * Platform Intelligence Module — Barrel exports.
 *
 * Re-exports all platform analytics functions for easy importing.
 *
 * Usage:
 *   import { calculatePlatformHealth, getFraudTrends } from "@/lib/platformIntelligence";
 */

export {
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
  storeMetric,
  getStoredMetrics,
  METRIC_TYPES,
  AGGREGATION_PERIODS,
} from "./analyticsEngine";

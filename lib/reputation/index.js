/**
 * Reputation Module — Barrel exports.
 *
 * Re-exports all reputation functions for easy importing.
 *
 * Usage:
 *   import { calculateCreatorReputation, getReputationLeaderboard } from "@/lib/reputation";
 */

export {
  calculateCreatorReputation,
  calculateDonorReputation,
  calculateCampaignReputation,
  getCreatorReputation,
  getDonorReputation,
  getCampaignReputation,
  updateReputationPenalty,
  getReputationLeaderboard,
  REPUTATION_WEIGHTS,
  REPUTATION_DIMENSIONS,
} from "./reputationEngine";

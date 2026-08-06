/**
 * Milestone Module — Barrel exports.
 *
 * Re-exports all milestone management functions for easy importing.
 *
 * Usage:
 *   import { createMilestone, submitMilestone, createReview } from "@/lib/milestone";
 *   import { getCampaignMilestones, getMilestoneStats } from "@/lib/milestone";
 */

// Engine — CRUD and lifecycle
export {
  createMilestone,
  activateMilestone,
  getMilestone,
  getCampaignMilestones,
  getCreatorMilestones,
  updateMilestone,
  cancelMilestone,
  getMilestoneStats,
  checkAutoApproval,
  MILESTONE_STATUSES,
  VALID_TRANSITIONS,
} from "./milestoneEngine";

// Submissions — Creator evidence
export {
  submitMilestone,
  getSubmissions,
  getSubmission,
  updateSubmissionStatus,
  getCreatorSubmissions,
  SUBMISSION_STATUSES,
  SUBMISSION_TYPES,
} from "./milestoneSubmission";

// Reviews — Donor reviews and voting
export {
  createReview,
  getMilestoneReviews,
  getReviewStats,
  getUserReview,
  updateReview,
  deleteReview,
  REVIEW_DECISIONS,
} from "./milestoneReview";

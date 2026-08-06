/**
 * Appeals Module — Barrel exports.
 *
 * Re-exports all appeal functions for easy importing.
 *
 * Usage:
 *   import { createAppeal, reviewAppeal } from "@/lib/appeals";
 */

export {
  createAppeal,
  getAppeal,
  getAppealByNumber,
  getAppeals,
  assignAppealReviewer,
  requestEvidence,
  reviewAppeal,
  withdrawAppeal,
  getAppealsStats,
  APPEAL_TYPES,
  APPEAL_STATUSES,
  APPEAL_DECISIONS,
} from "./appealsEngine";

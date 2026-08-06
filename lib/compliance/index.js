/**
 * Compliance Module — Barrel exports.
 *
 * Re-exports all compliance management functions for easy importing.
 *
 * Usage:
 *   import { createComplianceCase, resolveComplianceCase } from "@/lib/compliance";
 *   import { recordComplianceEvent, getComplianceEvents } from "@/lib/compliance";
 */

// ─── Compliance Engine — Case management and lifecycle ───
export {
  createComplianceCase,
  getComplianceCase,
  getComplianceCaseByNumber,
  getComplianceCases,
  updateComplianceCase,
  assignComplianceCase,
  resolveComplianceCase,
  reopenComplianceCase,
  escalateComplianceCase,
  getComplianceStats,
  COMPLIANCE_CASE_TYPES,
  COMPLIANCE_STATUSES,
  COMPLIANCE_RESOLUTION_TYPES,
  COMPLIANCE_PRIORITIES,
} from "./complianceEngine";

// ─── Compliance Events — Audit trail for compliance actions ───
export {
  recordComplianceEvent,
  getComplianceEvents,
  getComplianceEventSummary,
  COMPLIANCE_EVENT_TYPES,
} from "./complianceEvents";

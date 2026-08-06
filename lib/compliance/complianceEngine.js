/**
 * Compliance Engine — Case management and lifecycle orchestration.
 *
 * Manages the full lifecycle of compliance cases:
 *   created → open → investigating → resolved / closed
 *
 * Features:
 *   - Case creation with auto-generated case numbers (COMP-YYYY-NNNNN)
 *   - Status transitions with validation
 *   - Assignment and escalation workflows
 *   - Resolution tracking
 *   - Statistics aggregation
 *
 * Security:
 *   - All mutations are audit-logged
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Constants ───

/**
 * Valid compliance case types.
 * @type {string[]}
 */
export const COMPLIANCE_CASE_TYPES = [
  "fraud_report",
  "kyc_review",
  "aml_check",
  "dispute",
  "policy_violation",
  "suspicious_activity",
  "regulatory_request",
  "internal_audit",
  "user_complaint",
  "campaign_review",
];

/**
 * Valid compliance case statuses.
 * @type {string[]}
 */
export const COMPLIANCE_STATUSES = [
  "created",
  "open",
  "investigating",
  "pending_review",
  "resolved",
  "closed",
  "reopened",
  "escalated",
];

/**
 * Valid resolution types.
 * @type {string[]}
 */
export const COMPLIANCE_RESOLUTION_TYPES = [
  "dismissed",
  "confirmed_violation",
  "warning_issued",
  "account_suspended",
  "account_banned",
  "campaign_suspended",
  "campaign_removed",
  "funds_frozen",
  "funds_released",
  "no_action_required",
  "referred_to_authorities",
  "policy_change_recommended",
];

/**
 * Valid priority levels.
 * @type {string[]}
 */
export const COMPLIANCE_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
];

/**
 * Allowed status transitions.
 * Key: current status, Value: array of allowed next statuses.
 * @type {Object<string, string[]>}
 */
const STATUS_TRANSITIONS = {
  created: ["open"],
  open: ["investigating", "closed"],
  investigating: ["pending_review", "resolved", "closed", "escalated"],
  pending_review: ["resolved", "investigating", "closed"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["open", "investigating"],
  escalated: ["investigating", "resolved", "closed"],
};

// ─── Helpers ───

/**
 * Validate whether a status transition is allowed.
 *
 * @param {string} currentStatus — Current case status
 * @param {string} newStatus — Desired new status
 * @returns {{valid: boolean, error?: string}}
 */
function validateStatusTransition(currentStatus, newStatus) {
  if (!COMPLIANCE_STATUSES.includes(currentStatus)) {
    return { valid: false, error: `Invalid current status: ${currentStatus}` };
  }

  if (!COMPLIANCE_STATUSES.includes(newStatus)) {
    return { valid: false, error: `Invalid target status: ${newStatus}` };
  }

  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
    };
  }

  return { valid: true };
}

/**
 * Generate a case number in format COMP-YYYY-NNNNN.
 *
 * @param {number} sequence — Sequence number (1-based)
 * @returns {string}
 */
function generateCaseNumber(sequence) {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(5, "0");
  return `COMP-${year}-${padded}`;
}

/**
 * Get the next sequence number for case number generation.
 *
 * @returns {Promise<number>}
 */
async function getNextSequenceNumber() {
  const year = new Date().getFullYear();
  const prefix = `COMP-${year}-`;

  const { data, error } = await supabaseAdmin
    .from("compliance_cases")
    .select("case_number")
    .like("case_number", `${prefix}%`)
    .order("case_number", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return 1;
  }

  const lastNumber = parseInt(data[0].case_number.split("-")[2], 10);
  return lastNumber + 1;
}

// ─── Core Functions ───

/**
 * Create a new compliance case.
 *
 * @param {Object} params
 * @param {string} params.caseType — Case type from COMPLIANCE_CASE_TYPES
 * @param {string} [params.subjectUserId] — User ID being investigated
 * @param {string} [params.subjectCampaignId] — Campaign ID being investigated
 * @param {string} [params.priority='medium'] — Priority from COMPLIANCE_PRIORITIES
 * @param {string} [params.description] — Case description
 * @param {string[]} [params.evidenceUrls] — URLs to evidence files
 * @param {Object} [params.metadata] — Additional metadata
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createComplianceCase({
  caseType,
  subjectUserId,
  subjectCampaignId,
  priority = "medium",
  description,
  evidenceUrls = [],
  metadata = {},
}) {
  try {
    if (!caseType) {
      return { success: false, error: "caseType is required" };
    }

    if (!COMPLIANCE_CASE_TYPES.includes(caseType)) {
      return { success: false, error: `Invalid caseType: ${caseType}. Must be one of: ${COMPLIANCE_CASE_TYPES.join(", ")}` };
    }

    if (!COMPLIANCE_PRIORITIES.includes(priority)) {
      return { success: false, error: `Invalid priority: ${priority}. Must be one of: ${COMPLIANCE_PRIORITIES.join(", ")}` };
    }

    if (!subjectUserId && !subjectCampaignId) {
      return { success: false, error: "At least one of subjectUserId or subjectCampaignId is required" };
    }

    // Generate case number
    const sequence = await getNextSequenceNumber();
    const caseNumber = generateCaseNumber(sequence);

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .insert({
        case_number: caseNumber,
        case_type: caseType,
        subject_user_id: subjectUserId || null,
        subject_campaign_id: subjectCampaignId || null,
        priority,
        status: "open",
        description: description || null,
        evidence_urls: evidenceUrls,
        metadata,
      })
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Create case error", { error: error.message, caseType });
      return { success: false, error: "Failed to create compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case created", {
      caseId: data.id,
      caseNumber,
      caseType,
      priority,
    });

    await logAuditEvent({
      eventType: "compliance.case.created",
      entityType: "compliance_cases",
      entityId: data.id,
      userId: subjectUserId,
      action: "create_compliance_case",
      details: { caseNumber, caseType, priority, subjectUserId, subjectCampaignId },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Create case error", { error: err.message });
    return { success: false, error: "Failed to create compliance case" };
  }
}

/**
 * Get a compliance case by ID.
 *
 * @param {string} caseId — Case ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getComplianceCase(caseId) {
  try {
    if (!caseId) {
      return { success: false, error: "caseId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Compliance case not found" };
      }
      logError("ComplianceEngine", "Fetch case error", { error: error.message, caseId });
      return { success: false, error: "Failed to fetch compliance case" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Fetch case error", { error: err.message });
    return { success: false, error: "Failed to fetch compliance case" };
  }
}

/**
 * Get a compliance case by case number.
 *
 * @param {string} caseNumber — Case number (e.g., COMP-2026-00001)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getComplianceCaseByNumber(caseNumber) {
  try {
    if (!caseNumber) {
      return { success: false, error: "caseNumber is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("case_number", caseNumber)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Compliance case not found" };
      }
      logError("ComplianceEngine", "Fetch case by number error", { error: error.message, caseNumber });
      return { success: false, error: "Failed to fetch compliance case" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Fetch case by number error", { error: err.message });
    return { success: false, error: "Failed to fetch compliance case" };
  }
}

/**
 * List compliance cases with filters and pagination.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status
 * @param {string} [params.caseType] — Filter by case type
 * @param {string} [params.priority] — Filter by priority
 * @param {string} [params.assignedTo] — Filter by assigned user
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, data?: Object[], total?: number, error?: string}>}
 */
export async function getComplianceCases({
  status,
  caseType,
  priority,
  assignedTo,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("compliance_cases")
      .select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (caseType) query = query.eq("case_type", caseType);
    if (priority) query = query.eq("priority", priority);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ComplianceEngine", "List cases error", { error: error.message });
      return { success: false, error: "Failed to fetch compliance cases" };
    }

    return {
      success: true,
      data: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("ComplianceEngine", "List cases error", { error: err.message });
    return { success: false, error: "Failed to fetch compliance cases" };
  }
}

/**
 * Update a compliance case with validation.
 *
 * @param {string} caseId — Case ID
 * @param {Object} updates — Fields to update
 * @param {string} [performedBy] — User ID performing the update
 * @param {string} [performedByType='admin'] — Actor type
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateComplianceCase(caseId, updates, performedBy, performedByType = "admin") {
  try {
    if (!caseId) {
      return { success: false, error: "caseId is required" };
    }

    if (!updates || Object.keys(updates).length === 0) {
      return { success: false, error: "No updates provided" };
    }

    // Fetch current case
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Compliance case not found" };
    }

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== current.status) {
      const validation = validateStatusTransition(current.status, updates.status);
      if (!validation.valid) {
        logWarn("ComplianceEngine", "Invalid status transition", {
          caseId,
          from: current.status,
          to: updates.status,
        });
        return { success: false, error: validation.error };
      }
    }

    // Whitelist allowed update fields
    const allowedFields = [
      "status", "priority", "description", "evidence_urls", "metadata",
      "assigned_to", "assigned_at", "resolution_type", "resolution",
      "resolved_at", "closed_at", "escalated_at", "escalation_reason",
    ];

    const sanitizedUpdates = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .update(sanitizedUpdates)
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Update case error", { error: error.message, caseId });
      return { success: false, error: "Failed to update compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case updated", {
      caseId,
      caseNumber: current.case_number,
      updatedFields: Object.keys(sanitizedUpdates),
      performedBy,
    });

    await logAuditEvent({
      eventType: "compliance.case.updated",
      entityType: "compliance_cases",
      entityId: caseId,
      userId: performedBy,
      action: "update_compliance_case",
      details: {
        caseNumber: current.case_number,
        updatedFields: Object.keys(sanitizedUpdates),
        previousStatus: current.status,
        newStatus: sanitizedUpdates.status || current.status,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Update case error", { error: err.message });
    return { success: false, error: "Failed to update compliance case" };
  }
}

/**
 * Assign a compliance case to an investigator.
 *
 * @param {string} caseId — Case ID
 * @param {string} assignTo — User ID of the assignee
 * @param {string} assignedBy — User ID of the assigner
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function assignComplianceCase(caseId, assignTo, assignedBy) {
  try {
    if (!caseId || !assignTo || !assignedBy) {
      return { success: false, error: "caseId, assignTo, and assignedBy are required" };
    }

    // Fetch current case
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Compliance case not found" };
    }

    if (current.status === "resolved" || current.status === "closed") {
      return { success: false, error: `Cannot assign a case in '${current.status}' status` };
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .update({
        assigned_to: assignTo,
        assigned_at: now,
        updated_at: now,
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Assign case error", { error: error.message, caseId });
      return { success: false, error: "Failed to assign compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case assigned", {
      caseId,
      caseNumber: current.case_number,
      assignedTo: assignTo,
      assignedBy,
    });

    await logAuditEvent({
      eventType: "compliance.case.assigned",
      entityType: "compliance_cases",
      entityId: caseId,
      userId: assignedBy,
      action: "assign_compliance_case",
      details: {
        caseNumber: current.case_number,
        previousAssignee: current.assigned_to,
        newAssignee: assignTo,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Assign case error", { error: err.message });
    return { success: false, error: "Failed to assign compliance case" };
  }
}

/**
 * Resolve a compliance case.
 *
 * @param {string} caseId — Case ID
 * @param {string} resolutionType — Resolution type from COMPLIANCE_RESOLUTION_TYPES
 * @param {string} resolution — Resolution description
 * @param {string} performedBy — User ID performing the resolution
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function resolveComplianceCase(caseId, resolutionType, resolution, performedBy) {
  try {
    if (!caseId || !resolutionType || !resolution || !performedBy) {
      return { success: false, error: "caseId, resolutionType, resolution, and performedBy are required" };
    }

    if (!COMPLIANCE_RESOLUTION_TYPES.includes(resolutionType)) {
      return {
        success: false,
        error: `Invalid resolutionType: ${resolutionType}. Must be one of: ${COMPLIANCE_RESOLUTION_TYPES.join(", ")}`,
      };
    }

    // Fetch current case
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Compliance case not found" };
    }

    if (current.status === "resolved") {
      return { success: false, error: "Case is already resolved" };
    }

    if (current.status === "closed") {
      return { success: false, error: "Cannot resolve a closed case. Reopen it first." };
    }

    // Validate status transition to resolved
    const validation = validateStatusTransition(current.status, "resolved");
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .update({
        status: "resolved",
        resolution_type: resolutionType,
        resolution,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Resolve case error", { error: error.message, caseId });
      return { success: false, error: "Failed to resolve compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case resolved", {
      caseId,
      caseNumber: current.case_number,
      resolutionType,
      performedBy,
    });

    await logAuditEvent({
      eventType: "compliance.case.resolved",
      entityType: "compliance_cases",
      entityId: caseId,
      userId: performedBy,
      action: "resolve_compliance_case",
      details: {
        caseNumber: current.case_number,
        resolutionType,
        resolution,
        previousStatus: current.status,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Resolve case error", { error: err.message });
    return { success: false, error: "Failed to resolve compliance case" };
  }
}

/**
 * Reopen a resolved or closed compliance case.
 *
 * @param {string} caseId — Case ID
 * @param {string} reason — Reason for reopening
 * @param {string} performedBy — User ID performing the reopen
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function reopenComplianceCase(caseId, reason, performedBy) {
  try {
    if (!caseId || !reason || !performedBy) {
      return { success: false, error: "caseId, reason, and performedBy are required" };
    }

    // Fetch current case
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Compliance case not found" };
    }

    if (current.status !== "resolved" && current.status !== "closed") {
      return { success: false, error: `Cannot reopen a case in '${current.status}' status. Must be resolved or closed.` };
    }

    // Validate status transition to reopened
    const validation = validateStatusTransition(current.status, "reopened");
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .update({
        status: "reopened",
        resolution_type: null,
        resolution: null,
        resolved_at: null,
        reopen_reason: reason,
        reopened_at: now,
        updated_at: now,
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Reopen case error", { error: error.message, caseId });
      return { success: false, error: "Failed to reopen compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case reopened", {
      caseId,
      caseNumber: current.case_number,
      reason,
      performedBy,
    });

    await logAuditEvent({
      eventType: "compliance.case.reopened",
      entityType: "compliance_cases",
      entityId: caseId,
      userId: performedBy,
      action: "reopen_compliance_case",
      details: {
        caseNumber: current.case_number,
        reason,
        previousStatus: current.status,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Reopen case error", { error: err.message });
    return { success: false, error: "Failed to reopen compliance case" };
  }
}

/**
 * Escalate a compliance case (sets priority to urgent).
 *
 * @param {string} caseId — Case ID
 * @param {string} reason — Escalation reason
 * @param {string} performedBy — User ID performing the escalation
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function escalateComplianceCase(caseId, reason, performedBy) {
  try {
    if (!caseId || !reason || !performedBy) {
      return { success: false, error: "caseId, reason, and performedBy are required" };
    }

    // Fetch current case
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("compliance_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Compliance case not found" };
    }

    if (current.status === "resolved" || current.status === "closed") {
      return { success: false, error: `Cannot escalate a case in '${current.status}' status` };
    }

    const now = new Date().toISOString();

    // Set status to escalated and priority to urgent
    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .update({
        status: "escalated",
        priority: "urgent",
        escalation_reason: reason,
        escalated_at: now,
        updated_at: now,
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ComplianceEngine", "Escalate case error", { error: error.message, caseId });
      return { success: false, error: "Failed to escalate compliance case" };
    }

    logInfo("ComplianceEngine", "Compliance case escalated", {
      caseId,
      caseNumber: current.case_number,
      previousPriority: current.priority,
      reason,
      performedBy,
    });

    await logAuditEvent({
      eventType: "compliance.case.escalated",
      entityType: "compliance_cases",
      entityId: caseId,
      userId: performedBy,
      action: "escalate_compliance_case",
      details: {
        caseNumber: current.case_number,
        reason,
        previousPriority: current.priority,
        previousStatus: current.status,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("ComplianceEngine", "Escalate case error", { error: err.message });
    return { success: false, error: "Failed to escalate compliance case" };
  }
}

/**
 * Get compliance statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getComplianceStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("compliance_cases")
      .select("status, case_type, priority");

    if (error) {
      logError("ComplianceEngine", "Stats error", { error: error.message });
      return { success: false, error: "Failed to fetch compliance stats" };
    }

    const cases = data || [];

    const stats = {
      total: cases.length,
      open: 0,
      investigating: 0,
      resolved: 0,
      byType: {},
      byPriority: {},
    };

    for (const c of cases) {
      // By status
      if (c.status === "open" || c.status === "reopened") {
        stats.open++;
      } else if (c.status === "investigating" || c.status === "pending_review" || c.status === "escalated") {
        stats.investigating++;
      } else if (c.status === "resolved") {
        stats.resolved++;
      }

      // By type
      if (c.case_type) {
        stats.byType[c.case_type] = (stats.byType[c.case_type] || 0) + 1;
      }

      // By priority
      if (c.priority) {
        stats.byPriority[c.priority] = (stats.byPriority[c.priority] || 0) + 1;
      }
    }

    return { success: true, data: stats };
  } catch (err) {
    logError("ComplianceEngine", "Stats error", { error: err.message });
    return { success: false, error: "Failed to fetch compliance stats" };
  }
}

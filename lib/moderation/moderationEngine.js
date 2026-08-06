/**
 * Moderation Engine — Case management for content and user moderation.
 *
 * Handles the full moderation lifecycle:
 *   create → open → assigned → resolved/escalated → reopened (if needed)
 *
 * Features:
 *   - Case creation with auto-generated case numbers (MOD-YYYY-NNNNN)
 *   - Case assignment to moderators
 *   - Resolution with action tracking
 *   - Escalation to admin
 *   - Reopening of resolved cases
 *   - Aggregated moderation statistics
 *
 * Security:
 *   - All actions audit-logged
 *   - Moderator assignment tracked with assigned_by
 *   - Resolution requires performedBy for accountability
 *
 * All functions return { success: boolean, data?: any, error?: string } — never throw.
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Constants ───

/**
 * Moderation case types.
 */
export const MODERATION_CASE_TYPES = {
  SPAM: "spam",
  HARASSMENT: "harassment",
  FRAUD: "fraud",
  INAPPROPRIATE_CONTENT: "inappropriate_content",
  COPYRIGHT: "copyright",
  FAKE_CAMPAIGN: "fake_campaign",
  MISUSE_OF_FUNDS: "misuse_of_funds",
  VERIFICATION_ABUSE: "verification_abuse",
  OTHER: "other",
};

/**
 * Moderation case statuses.
 */
export const MODERATION_STATUSES = {
  OPEN: "open",
  IN_REVIEW: "in_review",
  RESOLVED: "resolved",
  ESCALATED: "escalated",
  REOPENED: "reopened",
};

/**
 * Moderation actions that can be taken on resolution.
 */
export const MODERATION_ACTIONS = {
  NONE: "none",
  DISMISSED: "dismissed",
  WARNING: "warning",
  CONTENT_REMOVAL: "content_removal",
  CONTENT_EDIT: "content_edit",
  TEMPORARY_SUSPENSION: "temporary_suspension",
  PERMANENT_BAN: "permanent_ban",
  ACCOUNT_RESTRICTION: "account_restriction",
  CAMPAIGN_RESTRICTION: "campaign_restriction",
  ESCALATED_TO_ADMIN: "escalated_to_admin",
};

/**
 * Priority levels for moderation cases.
 */
const MODERATION_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

// ─── Case Number Generation ───

/**
 * Generate a unique case number in the format MOD-YYYY-NNNNN.
 *
 * @returns {Promise<string>} Case number
 */
async function generateCaseNumber() {
  const year = new Date().getFullYear();
  const prefix = `MOD-${year}-`;

  // Fetch the last case number for this year
  const { data, error } = await supabaseAdmin
    .from("moderation_cases")
    .select("case_number")
    .like("case_number", `${prefix}%`)
    .order("case_number", { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;

  if (!error && data && data.case_number) {
    const lastSequence = parseInt(data.case_number.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const paddedSequence = String(sequence).padStart(5, "0");
  return `${prefix}${paddedSequence}`;
}

// ─── Core Functions ───

/**
 * Create a new moderation case.
 *
 * @param {Object} params
 * @param {string} params.caseType — Type of moderation case (from MODERATION_CASE_TYPES)
 * @param {string} params.reporterId — User ID of the reporter
 * @param {string} [params.reportedUserId] — User ID of the reported user
 * @param {string} [params.reportedCampaignId] — Campaign ID of the reported campaign
 * @param {string} [params.reportedContentType] — Type of reported content
 * @param {string} [params.reportedContentId] — ID of the reported content
 * @param {string} params.description — Description of the issue
 * @param {Array} [params.evidenceUrls] — Array of evidence URLs
 * @param {Object} [params.metadata] — Additional metadata
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createModerationCase({
  caseType,
  reporterId,
  reportedUserId,
  reportedCampaignId,
  reportedContentType,
  reportedContentId,
  description,
  evidenceUrls = [],
  metadata = {},
}) {
  try {
    if (!caseType || !reporterId || !description) {
      return {
        success: false,
        error: "caseType, reporterId, and description are required",
      };
    }

    if (!Object.values(MODERATION_CASE_TYPES).includes(caseType)) {
      return { success: false, error: `Invalid caseType: ${caseType}` };
    }

    logInfo("ModerationEngine", "Creating moderation case", {
      caseType,
      reporterId: reporterId.substring(0, 8) + "...",
    });

    const caseNumber = await generateCaseNumber();

    // Optional AI pre-classification (non-blocking, best-effort)
    let aiClassification = null;
    try {
      const { classifyContent } = await import("./aiModerator.js");
      const aiResult = await classifyContent({
        entityType: reportedContentType || caseType,
        entityId: reportedContentId || reportedUserId || reportedCampaignId,
        content: description,
        title: caseType,
      });
      if (aiResult.success && aiResult.data) {
        // Add AI classification as additional signal, don't override rule-based result
        aiClassification = aiResult.data;
      }
    } catch {
      // AI classification is optional
    }

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .insert({
        case_number: caseNumber,
        case_type: caseType,
        status: MODERATION_STATUSES.OPEN,
        reporter_id: reporterId,
        reported_user_id: reportedUserId || null,
        reported_campaign_id: reportedCampaignId || null,
        reported_content_type: reportedContentType || null,
        reported_content_id: reportedContentId || null,
        description,
        evidence_urls: evidenceUrls,
        metadata: { ...metadata, ai_classification: aiClassification },
        priority: MODERATION_PRIORITIES.MEDIUM,
        moderator_id: null,
        action_taken: null,
        resolution: null,
        moderator_notes: null,
        resolved_by: null,
        resolved_at: null,
      })
      .select()
      .single();

    if (error) {
      logError("ModerationEngine", "Create moderation case error", {
        error: error.message,
      });
      return { success: false, error: "Failed to create moderation case" };
    }

    await logAuditEvent({
      eventType: "moderation.case_created",
      entityType: "moderation_cases",
      entityId: data.id,
      userId: reporterId,
      action: "create_case",
      details: { caseNumber, caseType, reportedUserId, reportedCampaignId },
    });

    logInfo("ModerationEngine", "Moderation case created", {
      caseId: data.id,
      caseNumber,
    });

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Create moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to create moderation case" };
  }
}

/**
 * Get a moderation case by ID.
 *
 * @param {string} caseId — Case ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getModerationCase(caseId) {
  try {
    if (!caseId) {
      return { success: false, error: "caseId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (error || !data) {
      return { success: false, error: "Moderation case not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Get moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch moderation case" };
  }
}

/**
 * Get a moderation case by case number.
 *
 * @param {string} caseNumber — Case number (e.g., MOD-2024-00001)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getModerationCaseByNumber(caseNumber) {
  try {
    if (!caseNumber) {
      return { success: false, error: "caseNumber is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("case_number", caseNumber)
      .single();

    if (error || !data) {
      return { success: false, error: "Moderation case not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Get moderation case by number error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch moderation case" };
  }
}

/**
 * List moderation cases with optional filters.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status
 * @param {string} [params.caseType] — Filter by case type
 * @param {string} [params.priority] — Filter by priority
 * @param {string} [params.moderatorId] — Filter by assigned moderator
 * @param {string} [params.reporterId] — Filter by reporter
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset for pagination
 * @returns {Promise<{success: boolean, data?: Array, total?: number, error?: string}>}
 */
export async function getModerationCases({
  status,
  caseType,
  priority,
  moderatorId,
  reporterId,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("moderation_cases")
      .select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (caseType) query = query.eq("case_type", caseType);
    if (priority) query = query.eq("priority", priority);
    if (moderatorId) query = query.eq("moderator_id", moderatorId);
    if (reporterId) query = query.eq("reporter_id", reporterId);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ModerationEngine", "List moderation cases error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch moderation cases" };
    }

    return {
      success: true,
      data: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("ModerationEngine", "List moderation cases error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch moderation cases" };
  }
}

/**
 * Assign a moderator to a moderation case.
 *
 * @param {string} caseId — Case ID
 * @param {string} moderatorId — Moderator user ID
 * @param {string} assignedBy — User ID of the person assigning
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function assignModerationCase(caseId, moderatorId, assignedBy) {
  try {
    if (!caseId || !moderatorId || !assignedBy) {
      return {
        success: false,
        error: "caseId, moderatorId, and assignedBy are required",
      };
    }

    logInfo("ModerationEngine", "Assigning moderation case", {
      caseId,
      moderatorId: moderatorId.substring(0, 8) + "...",
    });

    // Fetch existing case
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Moderation case not found" };
    }

    if (
      existing.status === MODERATION_STATUSES.RESOLVED ||
      existing.status === MODERATION_STATUSES.ESCALATED
    ) {
      return {
        success: false,
        error: `Cannot assign moderator to case in '${existing.status}' status`,
      };
    }

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .update({
        moderator_id: moderatorId,
        status: MODERATION_STATUSES.IN_REVIEW,
        assigned_at: new Date().toISOString(),
        assigned_by: assignedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ModerationEngine", "Assign moderation case error", {
        error: error.message,
      });
      return { success: false, error: "Failed to assign moderation case" };
    }

    await logAuditEvent({
      eventType: "moderation.case_assigned",
      entityType: "moderation_cases",
      entityId: caseId,
      userId: assignedBy,
      action: "assign_moderator",
      details: {
        caseNumber: existing.case_number,
        moderatorId,
        previousStatus: existing.status,
      },
    });

    logInfo("ModerationEngine", "Moderation case assigned", {
      caseId,
      moderatorId: moderatorId.substring(0, 8) + "...",
    });

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Assign moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to assign moderation case" };
  }
}

/**
 * Resolve a moderation case with an action.
 *
 * @param {string} caseId — Case ID
 * @param {string} actionTaken — Action taken (from MODERATION_ACTIONS)
 * @param {string} resolution — Resolution description
 * @param {string} [moderatorNotes] — Internal moderator notes
 * @param {string} performedBy — User ID of the moderator performing the action
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function resolveModerationCase(
  caseId,
  actionTaken,
  resolution,
  moderatorNotes,
  performedBy,
) {
  try {
    if (!caseId || !actionTaken || !resolution || !performedBy) {
      return {
        success: false,
        error: "caseId, actionTaken, resolution, and performedBy are required",
      };
    }

    if (!Object.values(MODERATION_ACTIONS).includes(actionTaken)) {
      return { success: false, error: `Invalid actionTaken: ${actionTaken}` };
    }

    logInfo("ModerationEngine", "Resolving moderation case", {
      caseId,
      actionTaken,
      performedBy: performedBy.substring(0, 8) + "...",
    });

    // Fetch existing case
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Moderation case not found" };
    }

    if (existing.status === MODERATION_STATUSES.RESOLVED) {
      return {
        success: false,
        error: "Case is already resolved. Reopen it first.",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .update({
        status: MODERATION_STATUSES.RESOLVED,
        action_taken: actionTaken,
        resolution,
        moderator_notes: moderatorNotes || null,
        resolved_by: performedBy,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ModerationEngine", "Resolve moderation case error", {
        error: error.message,
      });
      return { success: false, error: "Failed to resolve moderation case" };
    }

    await logAuditEvent({
      eventType: "moderation.case_resolved",
      entityType: "moderation_cases",
      entityId: caseId,
      userId: performedBy,
      action: "resolve_case",
      details: {
        caseNumber: existing.case_number,
        actionTaken,
        resolution,
        previousStatus: existing.status,
      },
    });

    logInfo("ModerationEngine", "Moderation case resolved", {
      caseId,
      actionTaken,
    });

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Resolve moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to resolve moderation case" };
  }
}

/**
 * Reopen a resolved moderation case.
 *
 * @param {string} caseId — Case ID
 * @param {string} reason — Reason for reopening
 * @param {string} performedBy — User ID of the person reopening
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function reopenModerationCase(caseId, reason, performedBy) {
  try {
    if (!caseId || !reason || !performedBy) {
      return {
        success: false,
        error: "caseId, reason, and performedBy are required",
      };
    }

    logInfo("ModerationEngine", "Reopening moderation case", {
      caseId,
      performedBy: performedBy.substring(0, 8) + "...",
    });

    // Fetch existing case
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Moderation case not found" };
    }

    if (existing.status !== MODERATION_STATUSES.RESOLVED) {
      return {
        success: false,
        error: `Cannot reopen case in '${existing.status}' status. Only resolved cases can be reopened.`,
      };
    }

    // Append reopen history to metadata
    const reopenHistory = existing.metadata?.reopen_history || [];
    reopenHistory.push({
      reopenedBy: performedBy,
      reason,
      reopenedAt: new Date().toISOString(),
      previousAction: existing.action_taken,
    });

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .update({
        status: MODERATION_STATUSES.REOPENED,
        action_taken: null,
        resolution: null,
        resolved_by: null,
        resolved_at: null,
        reopen_reason: reason,
        metadata: { ...existing.metadata, reopen_history: reopenHistory },
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ModerationEngine", "Reopen moderation case error", {
        error: error.message,
      });
      return { success: false, error: "Failed to reopen moderation case" };
    }

    await logAuditEvent({
      eventType: "moderation.case_reopened",
      entityType: "moderation_cases",
      entityId: caseId,
      userId: performedBy,
      action: "reopen_case",
      details: {
        caseNumber: existing.case_number,
        reason,
        previousAction: existing.action_taken,
      },
    });

    logInfo("ModerationEngine", "Moderation case reopened", { caseId });

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Reopen moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to reopen moderation case" };
  }
}

/**
 * Escalate a moderation case to admin.
 *
 * @param {string} caseId — Case ID
 * @param {string} reason — Reason for escalation
 * @param {string} performedBy — User ID of the person escalating
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function escalateModerationCase(caseId, reason, performedBy) {
  try {
    if (!caseId || !reason || !performedBy) {
      return {
        success: false,
        error: "caseId, reason, and performedBy are required",
      };
    }

    logInfo("ModerationEngine", "Escalating moderation case", {
      caseId,
      performedBy: performedBy.substring(0, 8) + "...",
    });

    // Fetch existing case
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("moderation_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Moderation case not found" };
    }

    if (existing.status === MODERATION_STATUSES.RESOLVED) {
      return {
        success: false,
        error: `Cannot escalate case in '${existing.status}' status. Reopen it first.`,
      };
    }

    // Escalation history in metadata
    const escalationHistory = existing.metadata?.escalation_history || [];
    escalationHistory.push({
      escalatedBy: performedBy,
      reason,
      escalatedAt: new Date().toISOString(),
    });

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .update({
        status: MODERATION_STATUSES.ESCALATED,
        action_taken: MODERATION_ACTIONS.ESCALATED_TO_ADMIN,
        priority: MODERATION_PRIORITIES.CRITICAL,
        escalation_reason: reason,
        escalated_at: new Date().toISOString(),
        escalated_by: performedBy,
        metadata: {
          ...existing.metadata,
          escalation_history: escalationHistory,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId)
      .select()
      .single();

    if (error) {
      logError("ModerationEngine", "Escalate moderation case error", {
        error: error.message,
      });
      return { success: false, error: "Failed to escalate moderation case" };
    }

    await logAuditEvent({
      eventType: "moderation.case_escalated",
      entityType: "moderation_cases",
      entityId: caseId,
      userId: performedBy,
      action: "escalate_case",
      details: {
        caseNumber: existing.case_number,
        reason,
        previousStatus: existing.status,
      },
    });

    logInfo("ModerationEngine", "Moderation case escalated", { caseId });

    return { success: true, data };
  } catch (err) {
    logError("ModerationEngine", "Escalate moderation case error", {
      error: err.message,
    });
    return { success: false, error: "Failed to escalate moderation case" };
  }
}

// ─── Statistics ───

/**
 * Get aggregated moderation statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getModerationStats() {
  try {
    logInfo("ModerationEngine", "Fetching moderation stats");

    const { data, error } = await supabaseAdmin
      .from("moderation_cases")
      .select("status, case_type, action_taken, priority");

    if (error) {
      logError("ModerationEngine", "Fetch moderation stats error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch moderation stats" };
    }

    const cases = data || [];

    const stats = {
      total: cases.length,
      open: 0,
      byType: {},
      byAction: {},
      byPriority: {},
    };

    for (const c of cases) {
      // Count open cases (open, in_review, reopened)
      if (
        c.status === MODERATION_STATUSES.OPEN ||
        c.status === MODERATION_STATUSES.IN_REVIEW ||
        c.status === MODERATION_STATUSES.REOPENED
      ) {
        stats.open++;
      }

      // Count by type
      stats.byType[c.case_type] = (stats.byType[c.case_type] || 0) + 1;

      // Count by action
      if (c.action_taken) {
        stats.byAction[c.action_taken] =
          (stats.byAction[c.action_taken] || 0) + 1;
      }

      // Count by priority
      stats.byPriority[c.priority] = (stats.byPriority[c.priority] || 0) + 1;
    }

    return { success: true, data: stats };
  } catch (err) {
    logError("ModerationEngine", "Get moderation stats error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch moderation stats" };
  }
}

// ─── Content Classification ───

/**
 * Classify content for moderation purposes.
 *
 * @param {Object} params
 * @param {string} params.entityType — Entity type (campaign, comment, message, user_profile)
 * @param {string} params.entityId — Entity ID
 * @param {string} params.content — Content to classify
 * @param {string} [params.title] — Content title
 * @param {string} params.classifiedBy — User performing classification
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function classifyContent({
  entityType,
  entityId,
  content,
  title,
  classifiedBy,
}) {
  try {
    if (!entityType || !entityId || !content) {
      return {
        success: false,
        error: "entityType, entityId, and content are required",
      };
    }

    logInfo("ModerationEngine", "Classifying content", {
      entityType,
      entityId,
      contentLength: content.length,
    });

    // Create a moderation case for classified content
    const caseResult = await createModerationCase({
      caseType: MODERATION_CASE_TYPES.OTHER,
      entityType,
      entityId,
      reason: `AI classification: ${title || "content"}`,
      description: content.substring(0, 500),
      reportedBy: classifiedBy,
    });

    if (!caseResult.success) {
      return { success: false, error: caseResult.error };
    }

    return {
      success: true,
      data: {
        caseId: caseResult.data.id,
        caseNumber: caseResult.data.caseNumber,
        classification: "pending_review",
        confidence: 0,
      },
    };
  } catch (err) {
    logError("ModerationEngine", "classifyContent error", {
      entityType,
      entityId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Detect suspicious content (spam, abuse, etc).
 *
 * @param {Object} params
 * @param {string} params.content — Content to analyze
 * @param {string} params.authorId — Author user ID
 * @param {Object} [params.context] — Additional context
 * @param {string} params.detectedBy — User performing detection
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectSuspiciousContent({
  content,
  authorId,
  context,
  detectedBy,
}) {
  try {
    if (!content || !authorId) {
      return { success: false, error: "content and authorId are required" };
    }

    logInfo("ModerationEngine", "Detecting suspicious content", {
      authorId,
      contentLength: content.length,
    });

    // Create a moderation case for suspicious content
    const caseResult = await createModerationCase({
      caseType: MODERATION_CASE_TYPES.SPAM,
      entityType: "user_profile",
      entityId: authorId,
      reason: "Suspicious content detected",
      description: content.substring(0, 500),
      reportedBy: detectedBy,
    });

    if (!caseResult.success) {
      return { success: false, error: caseResult.error };
    }

    return {
      success: true,
      data: {
        caseId: caseResult.data.id,
        caseNumber: caseResult.data.caseNumber,
        isSuspicious: true,
        flags: ["suspicious_content"],
      },
    };
  } catch (err) {
    logError("ModerationEngine", "detectSuspiciousContent error", {
      authorId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

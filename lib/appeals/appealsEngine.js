/**
 * Appeals Engine — Appeal lifecycle management for fundora.
 *
 * Manages the full lifecycle of user appeals against platform actions:
 *   draft → submitted → under_review → evidence_requested → decided → closed
 *
 * Features:
 *   - Appeal creation with auto-generated appeal numbers
 *   - Reviewer assignment and evidence requests
 *   - Decision workflow: uphold / overturn / modify / escalate
 *   - Withdrawal support
 *   - Aggregated statistics
 *   - Audit logging for all state transitions
 *
 * Security:
 *   - Appellant can only withdraw their own appeals
 *   - All actions audit-logged
 *   - Appeals have a 7-day review deadline
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent, hashIP } from "../verification/auditLog";

// ─── Constants ───

export const APPEAL_TYPES = {
  ACCOUNT_SUSPENSION: "account_suspension",
  CAMPAIGN_REMOVAL: "campaign_removal",
  PAYMENT_DISPUTE: "payment_dispute",
  FRAUD_ALLEGATION: "fraud_allegation",
  CONTENT_REMOVAL: "content_removal",
  TRUST_SCORE_DISPUTE: "trust_score_dispute",
  MILESTONE_REJECTION: "milestone_rejection",
  PAYOUT_REJECTION: "payout_rejection",
  OTHER: "other",
};

export const APPEAL_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  EVIDENCE_REQUESTED: "evidence_requested",
  DECIDED: "decided",
  CLOSED: "closed",
  WITHDRAWN: "withdrawn",
};

export const APPEAL_DECISIONS = {
  UPHOLD: "uphold",
  OVERTURN: "overturn",
  MODIFY: "modify",
  ESCALATE: "escalate",
};

// ─── Helpers ───

/**
 * Generate a unique appeal number in the format APL-YYYY-NNNNN.
 *
 * @returns {Promise<string>}
 */
async function generateAppealNumber() {
  const year = new Date().getFullYear();
  const prefix = `APL-${year}-`;

  const { data, error } = await supabaseAdmin
    .from("appeals")
    .select("appeal_number")
    .like("appeal_number", `${prefix}%`)
    .order("appeal_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("Failed to generate appeal number");
  }

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].appeal_number.split("-").pop(), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, "0")}`;
}

// ─── Core Functions ───

/**
 * Create a new appeal.
 *
 * @param {Object} params
 * @param {string} params.appealType — Type of appeal (from APPEAL_TYPES)
 * @param {string} params.appellantId — User ID of the appellant
 * @param {string} params.originalAction — Description of the original action
 * @param {string} params.originalActionId — ID of the original action entity
 * @param {string} params.originalActionType — Type of the original action
 * @param {string} params.reason — Reason for the appeal
 * @param {string[]} [params.evidenceUrls] — URLs of supporting evidence
 * @param {Object} [params.metadata] — Additional metadata
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createAppeal({
  appealType,
  appellantId,
  originalAction,
  originalActionId,
  originalActionType,
  reason,
  evidenceUrls = [],
  metadata = {},
}) {
  try {
    if (!appealType || !appellantId || !originalAction || !originalActionId || !originalActionType || !reason) {
      return {
        success: false,
        error: "appealType, appellantId, originalAction, originalActionId, originalActionType, and reason are required",
      };
    }

    const appealNumber = await generateAppealNumber();
    const deadlineAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .insert({
        appeal_number: appealNumber,
        appeal_type: appealType,
        appellant_id: appellantId,
        original_action: originalAction,
        original_action_id: originalActionId,
        original_action_type: originalActionType,
        reason,
        evidence_urls: evidenceUrls,
        metadata,
        status: APPEAL_STATUSES.SUBMITTED,
        deadline_at: deadlineAt,
      })
      .select("*")
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to create appeal", { error: error.message, appellantId });
      return { success: false, error: "Failed to create appeal" };
    }

    logInfo("AppealsEngine", "Appeal created", { appealId: data.id, appealNumber, appellantId });

    await logAuditEvent({
      eventType: "appeal.created",
      entityType: "appeal",
      entityId: data.id,
      userId: appellantId,
      action: "create_appeal",
      details: { appealNumber, appealType, originalActionType },
    });

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error creating appeal", { error: error.message });
    return { success: false, error: "Failed to create appeal" };
  }
}

/**
 * Fetch an appeal by ID.
 *
 * @param {string} appealId
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getAppeal(appealId) {
  try {
    if (!appealId) {
      return { success: false, error: "appealId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .select("*")
      .eq("id", appealId)
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to fetch appeal", { error: error.message, appealId });
      return { success: false, error: "Failed to fetch appeal" };
    }

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error fetching appeal", { error: error.message });
    return { success: false, error: "Failed to fetch appeal" };
  }
}

/**
 * Fetch an appeal by its appeal number.
 *
 * @param {string} appealNumber
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getAppealByNumber(appealNumber) {
  try {
    if (!appealNumber) {
      return { success: false, error: "appealNumber is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .select("*")
      .eq("appeal_number", appealNumber)
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to fetch appeal by number", { error: error.message, appealNumber });
      return { success: false, error: "Appeal not found" };
    }

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error fetching appeal by number", { error: error.message });
    return { success: false, error: "Failed to fetch appeal" };
  }
}

/**
 * List appeals with optional filters.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status
 * @param {string} [params.appealType] — Filter by appeal type
 * @param {string} [params.appellantId] — Filter by appellant
 * @param {string} [params.reviewerId] — Filter by assigned reviewer
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, data?: Object[], total?: number, error?: string}>}
 */
export async function getAppeals({
  status,
  appealType,
  appellantId,
  reviewerId,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("appeals")
      .select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (appealType) query = query.eq("appeal_type", appealType);
    if (appellantId) query = query.eq("appellant_id", appellantId);
    if (reviewerId) query = query.eq("reviewer_id", reviewerId);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("AppealsEngine", "Failed to list appeals", { error: error.message });
      return { success: false, error: "Failed to list appeals" };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (error) {
    logError("AppealsEngine", "Error listing appeals", { error: error.message });
    return { success: false, error: "Failed to list appeals" };
  }
}

/**
 * Assign a reviewer to an appeal.
 *
 * @param {string} appealId
 * @param {string} reviewerId
 * @param {string} assignedBy — User ID of the admin performing assignment
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function assignAppealReviewer(appealId, reviewerId, assignedBy) {
  try {
    if (!appealId || !reviewerId || !assignedBy) {
      return { success: false, error: "appealId, reviewerId, and assignedBy are required" };
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("appeals")
      .select("id, status")
      .eq("id", appealId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Appeal not found" };
    }

    if (existing.status === APPEAL_STATUSES.CLOSED || existing.status === APPEAL_STATUSES.WITHDRAWN) {
      return { success: false, error: `Cannot assign reviewer to appeal in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .update({
        reviewer_id: reviewerId,
        status: APPEAL_STATUSES.UNDER_REVIEW,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appealId)
      .select("*")
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to assign reviewer", { error: error.message, appealId });
      return { success: false, error: "Failed to assign reviewer" };
    }

    logInfo("AppealsEngine", "Reviewer assigned", { appealId, reviewerId, assignedBy });

    await logAuditEvent({
      eventType: "appeal.reviewer_assigned",
      entityType: "appeal",
      entityId: appealId,
      userId: assignedBy,
      action: "assign_reviewer",
      details: { reviewerId },
    });

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error assigning reviewer", { error: error.message });
    return { success: false, error: "Failed to assign reviewer" };
  }
}

/**
 * Request additional evidence from the appellant.
 *
 * @param {string} appealId
 * @param {string} reason — Reason for requesting evidence
 * @param {string} performedBy — User ID of the performer
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function requestEvidence(appealId, reason, performedBy) {
  try {
    if (!appealId || !reason || !performedBy) {
      return { success: false, error: "appealId, reason, and performedBy are required" };
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("appeals")
      .select("id, status")
      .eq("id", appealId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Appeal not found" };
    }

    if (existing.status === APPEAL_STATUSES.CLOSED || existing.status === APPEAL_STATUSES.WITHDRAWN) {
      return { success: false, error: `Cannot request evidence for appeal in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .update({
        status: APPEAL_STATUSES.EVIDENCE_REQUESTED,
        evidence_request_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appealId)
      .select("*")
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to request evidence", { error: error.message, appealId });
      return { success: false, error: "Failed to request evidence" };
    }

    logInfo("AppealsEngine", "Evidence requested", { appealId, performedBy });

    await logAuditEvent({
      eventType: "appeal.evidence_requested",
      entityType: "appeal",
      entityId: appealId,
      userId: performedBy,
      action: "request_evidence",
      details: { reason },
    });

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error requesting evidence", { error: error.message });
    return { success: false, error: "Failed to request evidence" };
  }
}

/**
 * Review an appeal with a decision.
 *
 * @param {string} appealId
 * @param {string} reviewerDecision — Decision: uphold / overturn / modify / escalate
 * @param {string} decisionReason — Reason for the decision
 * @param {string} [reviewerNotes] — Internal reviewer notes
 * @param {string} performedBy — User ID of the reviewer
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function reviewAppeal(appealId, reviewerDecision, decisionReason, reviewerNotes, performedBy) {
  try {
    if (!appealId || !reviewerDecision || !decisionReason || !performedBy) {
      return { success: false, error: "appealId, reviewerDecision, decisionReason, and performedBy are required" };
    }

    const validDecisions = Object.values(APPEAL_DECISIONS);
    if (!validDecisions.includes(reviewerDecision)) {
      return { success: false, error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` };
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("appeals")
      .select("id, status")
      .eq("id", appealId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Appeal not found" };
    }

    if (existing.status === APPEAL_STATUSES.CLOSED || existing.status === APPEAL_STATUSES.WITHDRAWN) {
      return { success: false, error: `Cannot review appeal in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .update({
        status: APPEAL_STATUSES.DECIDED,
        reviewer_decision: reviewerDecision,
        decision_reason: decisionReason,
        reviewer_notes: reviewerNotes || null,
        reviewer_id: performedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", appealId)
      .select("*")
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to review appeal", { error: error.message, appealId });
      return { success: false, error: "Failed to review appeal" };
    }

    logInfo("AppealsEngine", "Appeal reviewed", { appealId, decision: reviewerDecision, performedBy });

    await logAuditEvent({
      eventType: "appeal.reviewed",
      entityType: "appeal",
      entityId: appealId,
      userId: performedBy,
      action: "review_appeal",
      details: { decision: reviewerDecision, decisionReason },
    });

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error reviewing appeal", { error: error.message });
    return { success: false, error: "Failed to review appeal" };
  }
}

/**
 * Withdraw an appeal. Only the appellant can withdraw their own appeal.
 *
 * @param {string} appealId
 * @param {string} performedBy — User ID of the appellant
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function withdrawAppeal(appealId, performedBy) {
  try {
    if (!appealId || !performedBy) {
      return { success: false, error: "appealId and performedBy are required" };
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("appeals")
      .select("id, appellant_id, status")
      .eq("id", appealId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Appeal not found" };
    }

    if (existing.appellant_id !== performedBy) {
      logWarn("AppealsEngine", "Unauthorized withdrawal attempt", { appealId, performedBy, appellantId: existing.appellant_id });
      return { success: false, error: "You can only withdraw your own appeals" };
    }

    if (existing.status === APPEAL_STATUSES.CLOSED || existing.status === APPEAL_STATUSES.WITHDRAWN) {
      return { success: false, error: `Cannot withdraw appeal in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("appeals")
      .update({
        status: APPEAL_STATUSES.WITHDRAWN,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appealId)
      .select("*")
      .single();

    if (error) {
      logError("AppealsEngine", "Failed to withdraw appeal", { error: error.message, appealId });
      return { success: false, error: "Failed to withdraw appeal" };
    }

    logInfo("AppealsEngine", "Appeal withdrawn", { appealId, performedBy });

    await logAuditEvent({
      eventType: "appeal.withdrawn",
      entityType: "appeal",
      entityId: appealId,
      userId: performedBy,
      action: "withdraw_appeal",
      details: {},
    });

    return { success: true, data };
  } catch (error) {
    logError("AppealsEngine", "Error withdrawing appeal", { error: error.message });
    return { success: false, error: "Failed to withdraw appeal" };
  }
}

/**
 * Get aggregated appeals statistics.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getAppealsStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("appeals")
      .select("status, appeal_type");

    if (error) {
      logError("AppealsEngine", "Failed to get appeals stats", { error: error.message });
      return { success: false, error: "Failed to get appeals stats" };
    }

    const appeals = data || [];
    const byStatus = {};
    const byType = {};

    for (const appeal of appeals) {
      byStatus[appeal.status] = (byStatus[appeal.status] || 0) + 1;
      byType[appeal.appeal_type] = (byType[appeal.appeal_type] || 0) + 1;
    }

    const pending = (byStatus[APPEAL_STATUSES.SUBMITTED] || 0)
      + (byStatus[APPEAL_STATUSES.UNDER_REVIEW] || 0)
      + (byStatus[APPEAL_STATUSES.EVIDENCE_REQUESTED] || 0);

    return {
      success: true,
      data: {
        total: appeals.length,
        pending,
        byType,
        byStatus,
      },
    };
  } catch (error) {
    logError("AppealsEngine", "Error getting appeals stats", { error: error.message });
    return { success: false, error: "Failed to get appeals stats" };
  }
}

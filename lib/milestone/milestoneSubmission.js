/**
 * Milestone Submission — Creator evidence submission management.
 *
 * Creators submit evidence (files, links, progress notes) to prove
 * milestone completion. Each submission transitions the parent milestone
 * to 'submitted' status.
 *
 * Features:
 *   - File and link-based evidence submission
 *   - Submission status tracking
 *   - Creator submission history
 *
 * Security:
 *   - Only milestone owners can submit
 *   - Submissions are immutable after creation (status managed by reviewers)
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Configuration ───

const SUBMISSION_STATUSES = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const SUBMISSION_TYPES = {
  PROGRESS: "progress",
  DELIVERABLE: "deliverable",
  FINAL: "final",
  REVISION: "revision",
};

// ─── Core Functions ───

/**
 * Submit evidence for a milestone.
 * Transitions the milestone to 'submitted' status.
 *
 * @param {Object} params
 * @param {string} params.milestoneId — Milestone ID
 * @param {string} params.creatorId — Creator ID (must own the milestone)
 * @param {string} params.title — Submission title
 * @param {string} params.description — Submission description
 * @param {string} params.submissionType — Type: 'progress', 'deliverable', 'final', 'revision'
 * @param {Array<{url: string, name: string, type: string}>} [params.files] — Attached files
 * @param {string[]} [params.links] — External links
 * @param {string} [params.progressNotes] — Additional progress notes
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function submitMilestone({
  milestoneId,
  creatorId,
  title,
  description,
  submissionType,
  files,
  links,
  progressNotes,
}) {
  try {
    if (!milestoneId || !creatorId || !title) {
      return {
        success: false,
        error: "milestoneId, creatorId, and title are required",
      };
    }

    logInfo("MilestoneSubmission", "Submitting milestone evidence", {
      milestoneId,
      creatorId: creatorId.substring(0, 8) + "...",
      submissionType,
    });

    // Verify milestone exists and is owned by creator
    const { data: milestone, error: fetchError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("id, creator_id, status")
      .eq("id", milestoneId)
      .single();

    if (fetchError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    if (milestone.creator_id !== creatorId) {
      return {
        success: false,
        error: "You can only submit evidence for your own milestones",
      };
    }

    if (milestone.status === "completed" || milestone.status === "cancelled") {
      return {
        success: false,
        error: `Cannot submit evidence for milestone in '${milestone.status}' status`,
      };
    }

    // Create submission
    const { data: submission, error: insertError } = await supabaseAdmin
      .from("milestone_submissions")
      .insert({
        milestone_id: milestoneId,
        creator_id: creatorId,
        title,
        description: description || null,
        submission_type: submissionType || SUBMISSION_TYPES.PROGRESS,
        files: files || [],
        links: links || [],
        progress_notes: progressNotes || null,
        status: SUBMISSION_STATUSES.PENDING,
      })
      .select()
      .single();

    if (insertError) {
      logError("MilestoneSubmission", "Create submission error", {
        error: insertError.message,
      });
      return { success: false, error: "Failed to create submission" };
    }

    // Transition milestone to 'submitted'
    const { error: updateError } = await supabaseAdmin
      .from("campaign_milestones")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId);

    if (updateError) {
      logError("MilestoneSubmission", "Update milestone status error", {
        error: updateError.message,
      });
      // Submission was created but milestone update failed — log and continue
    }

    await logAuditEvent({
      eventType: "milestone.submission_created",
      entityType: "milestone_submissions",
      entityId: submission.id,
      userId: creatorId,
      action: "submit_evidence",
      details: {
        milestoneId,
        submissionType: submissionType || SUBMISSION_TYPES.PROGRESS,
        fileCount: (files || []).length,
        linkCount: (links || []).length,
      },
    });

    logInfo("MilestoneSubmission", "Evidence submitted", {
      submissionId: submission.id,
      milestoneId,
    });

    return { success: true, data: submission };
  } catch (err) {
    logError("MilestoneSubmission", "Submit milestone error", {
      error: err.message,
    });
    return { success: false, error: "Failed to submit milestone evidence" };
  }
}

/**
 * Get all submissions for a milestone.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getSubmissions(milestoneId) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_submissions")
      .select("*")
      .eq("milestone_id", milestoneId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("MilestoneSubmission", "Get submissions error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch submissions" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("MilestoneSubmission", "Get submissions error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch submissions" };
  }
}

/**
 * Get a single submission by ID.
 *
 * @param {string} submissionId — Submission ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getSubmission(submissionId) {
  try {
    if (!submissionId) {
      return { success: false, error: "submissionId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_submissions")
      .select("*, milestone: campaign_milestones(id, title, campaign_id)")
      .eq("id", submissionId)
      .single();

    if (error || !data) {
      return { success: false, error: "Submission not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("MilestoneSubmission", "Get submission error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch submission" };
  }
}

/**
 * Update the status of a submission (reviewer action).
 *
 * @param {string} submissionId — Submission ID
 * @param {string} reviewerId — Reviewer ID
 * @param {string} status — New status: 'under_review', 'accepted', 'rejected'
 * @param {string} [reviewNotes] — Review notes
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateSubmissionStatus(
  submissionId,
  reviewerId,
  status,
  reviewNotes,
) {
  try {
    if (!submissionId || !reviewerId || !status) {
      return {
        success: false,
        error: "submissionId, reviewerId, and status are required",
      };
    }

    const validStatuses = Object.values(SUBMISSION_STATUSES);
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      };
    }

    logInfo("MilestoneSubmission", "Updating submission status", {
      submissionId,
      reviewerId: reviewerId.substring(0, 8) + "...",
      status,
    });

    // Fetch existing submission
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("milestone_submissions")
      .select("id, status, milestone_id")
      .eq("id", submissionId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Submission not found" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_submissions")
      .update({
        status,
        review_notes: reviewNotes || null,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select()
      .single();

    if (error) {
      logError("MilestoneSubmission", "Update submission status error", {
        error: error.message,
      });
      return { success: false, error: "Failed to update submission status" };
    }

    await logAuditEvent({
      eventType: "milestone.submission_status_updated",
      entityType: "milestone_submissions",
      entityId: submissionId,
      userId: reviewerId,
      action: "update_submission_status",
      details: {
        previousStatus: existing.status,
        newStatus: status,
        milestoneId: existing.milestone_id,
      },
    });

    logInfo("MilestoneSubmission", "Submission status updated", {
      submissionId,
      previousStatus: existing.status,
      newStatus: status,
    });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneSubmission", "Update submission status error", {
      error: err.message,
    });
    return { success: false, error: "Failed to update submission status" };
  }
}

/**
 * Get all submissions by a creator across all milestones.
 *
 * @param {string} creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCreatorSubmissions(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_submissions")
      .select(
        `
        *,
        milestone: campaign_milestones(id, title, campaign_id, status)
      `,
      )
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("MilestoneSubmission", "Get creator submissions error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch creator submissions" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("MilestoneSubmission", "Get creator submissions error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch creator submissions" };
  }
}

// ─── Configuration Export ───

export { SUBMISSION_STATUSES, SUBMISSION_TYPES };

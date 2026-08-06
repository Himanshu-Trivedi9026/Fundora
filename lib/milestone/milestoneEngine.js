/**
 * Milestone Engine — CRUD and lifecycle management for campaign milestones.
 *
 * Milestones represent funding checkpoints within a campaign.
 * Lifecycle: draft → active → submitted → approved/rejected → completed
 *
 * Features:
 *   - Full CRUD with status-based guards
 *   - Aggregated stats per campaign
 *   - Auto-approval threshold checking
 *   - Audit logging for all state transitions
 *
 * Security:
 *   - Creator can only modify their own milestones
 *   - Only draft milestones can be updated
 *   - All transitions are audit-logged
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Configuration ───

const MILESTONE_STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const VALID_TRANSITIONS = {
  draft: ["active", "cancelled"],
  active: ["submitted", "cancelled"],
  submitted: ["approved", "rejected"],
  rejected: ["active", "cancelled"],
  approved: ["completed"],
  completed: [],
  cancelled: [],
};

// ─── Core Functions ───

/**
 * Create a new milestone for a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID
 * @param {string} params.creatorId — Creator ID
 * @param {string} params.title — Milestone title
 * @param {string} params.description — Milestone description
 * @param {number} params.targetAmount — Target funding amount
 * @param {string} params.targetDate — Target completion date (ISO string)
 * @param {number} params.releaseAmount — Amount to release on approval
 * @param {number} [params.sortOrder=0] — Display order
 * @param {number} [params.autoApproveThreshold=80] — Auto-approval percentage threshold
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createMilestone({
  campaignId,
  creatorId,
  title,
  description,
  targetAmount,
  targetDate,
  releaseAmount,
  sortOrder = 0,
  autoApproveThreshold = 80,
}) {
  try {
    if (!campaignId || !creatorId || !title || !targetAmount) {
      return { success: false, error: "campaignId, creatorId, title, and targetAmount are required" };
    }

    if (targetAmount <= 0) {
      return { success: false, error: "targetAmount must be greater than 0" };
    }

    if (releaseAmount && releaseAmount > targetAmount) {
      return { success: false, error: "releaseAmount cannot exceed targetAmount" };
    }

    logInfo("MilestoneEngine", "Creating milestone", {
      campaignId,
      creatorId: creatorId.substring(0, 8) + "...",
      title,
    });

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .insert({
        campaign_id: campaignId,
        creator_id: creatorId,
        title,
        description: description || null,
        target_amount: targetAmount,
        target_date: targetDate || null,
        release_amount: releaseAmount || targetAmount,
        sort_order: sortOrder,
        auto_approve_threshold: autoApproveThreshold,
        status: MILESTONE_STATUSES.DRAFT,
        approval_percentage: 0,
        total_reviews: 0,
        approval_count: 0,
        rejection_count: 0,
      })
      .select()
      .single();

    if (error) {
      logError("MilestoneEngine", "Create milestone error", { error: error.message });
      return { success: false, error: "Failed to create milestone" };
    }

    await logAuditEvent({
      eventType: "milestone.created",
      entityType: "campaign_milestone",
      entityId: data.id,
      userId: creatorId,
      action: "create",
      details: { campaignId, title, targetAmount, status: MILESTONE_STATUSES.DRAFT },
    });

    logInfo("MilestoneEngine", "Milestone created", { milestoneId: data.id });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneEngine", "Create milestone error", { error: err.message });
    return { success: false, error: "Failed to create milestone" };
  }
}

/**
 * Activate a milestone (draft → active).
 *
 * @param {string} milestoneId — Milestone ID
 * @param {string} creatorId — Creator ID (must own the milestone)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function activateMilestone(milestoneId, creatorId) {
  try {
    if (!milestoneId || !creatorId) {
      return { success: false, error: "milestoneId and creatorId are required" };
    }

    logInfo("MilestoneEngine", "Activating milestone", {
      milestoneId,
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Fetch existing milestone
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("*")
      .eq("id", milestoneId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Milestone not found" };
    }

    if (existing.creator_id !== creatorId) {
      return { success: false, error: "You can only activate your own milestones" };
    }

    if (existing.status !== MILESTONE_STATUSES.DRAFT) {
      return { success: false, error: `Cannot activate milestone in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .update({
        status: MILESTONE_STATUSES.ACTIVE,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) {
      logError("MilestoneEngine", "Activate milestone error", { error: error.message });
      return { success: false, error: "Failed to activate milestone" };
    }

    await logAuditEvent({
      eventType: "milestone.activated",
      entityType: "campaign_milestone",
      entityId: milestoneId,
      userId: creatorId,
      action: "activate",
      details: { previousStatus: MILESTONE_STATUSES.DRAFT, newStatus: MILESTONE_STATUSES.ACTIVE },
    });

    logInfo("MilestoneEngine", "Milestone activated", { milestoneId });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneEngine", "Activate milestone error", { error: err.message });
    return { success: false, error: "Failed to activate milestone" };
  }
}

/**
 * Get a milestone by ID with its reviews.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getMilestone(milestoneId) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .select(`
        *,
        reviews: milestone_reviews(*)
      `)
      .eq("id", milestoneId)
      .single();

    if (error || !data) {
      return { success: false, error: "Milestone not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("MilestoneEngine", "Get milestone error", { error: err.message });
    return { success: false, error: "Failed to fetch milestone" };
  }
}

/**
 * Get all milestones for a campaign.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCampaignMilestones(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .select(`
        *,
        reviews: milestone_reviews(id, decision, vote_weight, reviewer_id)
      `)
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      logError("MilestoneEngine", "Get campaign milestones error", { error: error.message });
      return { success: false, error: "Failed to fetch milestones" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("MilestoneEngine", "Get campaign milestones error", { error: err.message });
    return { success: false, error: "Failed to fetch milestones" };
  }
}

/**
 * Get all milestones across campaigns for a creator.
 *
 * @param {string} creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCreatorMilestones(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .select(`
        *,
        campaign: campaigns(id, title)
      `)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("MilestoneEngine", "Get creator milestones error", { error: error.message });
      return { success: false, error: "Failed to fetch creator milestones" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("MilestoneEngine", "Get creator milestones error", { error: err.message });
    return { success: false, error: "Failed to fetch creator milestones" };
  }
}

/**
 * Update a milestone (only draft status allowed).
 *
 * @param {string} milestoneId — Milestone ID
 * @param {string} creatorId — Creator ID (must own the milestone)
 * @param {Object} updates — Fields to update
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateMilestone(milestoneId, creatorId, updates) {
  try {
    if (!milestoneId || !creatorId) {
      return { success: false, error: "milestoneId and creatorId are required" };
    }

    if (!updates || Object.keys(updates).length === 0) {
      return { success: false, error: "No updates provided" };
    }

    logInfo("MilestoneEngine", "Updating milestone", {
      milestoneId,
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Fetch existing milestone
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("*")
      .eq("id", milestoneId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Milestone not found" };
    }

    if (existing.creator_id !== creatorId) {
      return { success: false, error: "You can only update your own milestones" };
    }

    if (existing.status !== MILESTONE_STATUSES.DRAFT) {
      return { success: false, error: `Cannot update milestone in '${existing.status}' status. Only draft milestones can be updated.` };
    }

    // Filter out immutable fields
    const { id, campaign_id, creator_id, status, created_at, ...allowedUpdates } = updates;

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .update({
        ...allowedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) {
      logError("MilestoneEngine", "Update milestone error", { error: error.message });
      return { success: false, error: "Failed to update milestone" };
    }

    await logAuditEvent({
      eventType: "milestone.updated",
      entityType: "campaign_milestone",
      entityId: milestoneId,
      userId: creatorId,
      action: "update",
      details: { updatedFields: Object.keys(allowedUpdates) },
    });

    logInfo("MilestoneEngine", "Milestone updated", { milestoneId });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneEngine", "Update milestone error", { error: err.message });
    return { success: false, error: "Failed to update milestone" };
  }
}

/**
 * Cancel a milestone.
 *
 * @param {string} milestoneId — Milestone ID
 * @param {string} creatorId — Creator ID (must own the milestone)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function cancelMilestone(milestoneId, creatorId) {
  try {
    if (!milestoneId || !creatorId) {
      return { success: false, error: "milestoneId and creatorId are required" };
    }

    logInfo("MilestoneEngine", "Cancelling milestone", {
      milestoneId,
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Fetch existing milestone
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("*")
      .eq("id", milestoneId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Milestone not found" };
    }

    if (existing.creator_id !== creatorId) {
      return { success: false, error: "You can only cancel your own milestones" };
    }

    const validTransitions = VALID_TRANSITIONS[existing.status] || [];
    if (!validTransitions.includes(MILESTONE_STATUSES.CANCELLED)) {
      return { success: false, error: `Cannot cancel milestone in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .update({
        status: MILESTONE_STATUSES.CANCELLED,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId)
      .select()
      .single();

    if (error) {
      logError("MilestoneEngine", "Cancel milestone error", { error: error.message });
      return { success: false, error: "Failed to cancel milestone" };
    }

    await logAuditEvent({
      eventType: "milestone.cancelled",
      entityType: "campaign_milestone",
      entityId: milestoneId,
      userId: creatorId,
      action: "cancel",
      details: { previousStatus: existing.status },
    });

    logInfo("MilestoneEngine", "Milestone cancelled", { milestoneId });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneEngine", "Cancel milestone error", { error: err.message });
    return { success: false, error: "Failed to cancel milestone" };
  }
}

/**
 * Get aggregated milestone stats for a campaign.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getMilestoneStats(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("campaign_milestones")
      .select("status, target_amount, release_amount, approval_percentage")
      .eq("campaign_id", campaignId);

    if (error) {
      logError("MilestoneEngine", "Get milestone stats error", { error: error.message });
      return { success: false, error: "Failed to fetch milestone stats" };
    }

    const milestones = data || [];

    const stats = {
      total: milestones.length,
      draft: 0,
      active: 0,
      submitted: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0,
      totalTargetAmount: 0,
      completedReleaseAmount: 0,
      pendingReleaseAmount: 0,
      averageApprovalPercentage: 0,
    };

    let approvalSum = 0;
    let approvalCount = 0;

    for (const m of milestones) {
      stats[m.status] = (stats[m.status] || 0) + 1;
      stats.totalTargetAmount += m.target_amount || 0;

      if (m.status === MILESTONE_STATUSES.COMPLETED) {
        stats.completedReleaseAmount += m.release_amount || 0;
      }

      if (m.status === MILESTONE_STATUSES.ACTIVE || m.status === MILESTONE_STATUSES.SUBMITTED) {
        stats.pendingReleaseAmount += m.release_amount || 0;
      }

      if (m.approval_percentage > 0) {
        approvalSum += m.approval_percentage;
        approvalCount++;
      }
    }

    stats.averageApprovalPercentage = approvalCount > 0 ? Math.round(approvalSum / approvalCount) : 0;

    return { success: true, data: stats };
  } catch (err) {
    logError("MilestoneEngine", "Get milestone stats error", { error: err.message });
    return { success: false, error: "Failed to fetch milestone stats" };
  }
}

/**
 * Check if a milestone meets the auto-approval threshold.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function checkAutoApproval(milestoneId) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    const { data: milestone, error: fetchError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("id, status, approval_percentage, auto_approve_threshold, total_reviews, approval_count")
      .eq("id", milestoneId)
      .single();

    if (fetchError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    const qualifies =
      milestone.status === MILESTONE_STATUSES.SUBMITTED &&
      milestone.total_reviews > 0 &&
      milestone.approval_percentage >= (milestone.auto_approve_threshold || 80);

    const result = {
      milestoneId,
      qualifies,
      approvalPercentage: milestone.approval_percentage || 0,
      threshold: milestone.auto_approve_threshold || 80,
      totalReviews: milestone.total_reviews || 0,
      approvalCount: milestone.approval_count || 0,
    };

    if (qualifies) {
      logInfo("MilestoneEngine", "Milestone qualifies for auto-approval", {
        milestoneId,
        approvalPercentage: milestone.approval_percentage,
        threshold: milestone.auto_approve_threshold,
      });
    }

    return { success: true, data: result };
  } catch (err) {
    logError("MilestoneEngine", "Check auto-approval error", { error: err.message });
    return { success: false, error: "Failed to check auto-approval" };
  }
}

// ─── Configuration Export ───

export { MILESTONE_STATUSES, VALID_TRANSITIONS };

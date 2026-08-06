/**
 * Milestone Review — Donor review and voting management.
 *
 * Donors who have contributed to a campaign can review milestones.
 * Reviews include a decision (approve/reject), vote weight based on
 * donation amount, and optional comments.
 *
 * Features:
 *   - One review per user per milestone (enforced at application + DB level)
 *   - Vote weight proportional to donation amount
 *   - Aggregated review stats (approval percentage, total votes)
 *   - Triggers milestone approval recalculation after each review
 *
 * Security:
 *   - Reviewers can only modify/delete their own reviews
 *   - Audit-logged on every change
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Configuration ───

const REVIEW_DECISIONS = {
  APPROVE: "approve",
  REJECT: "reject",
  ABSTAIN: "abstain",
};

// ─── Core Functions ───

/**
 * Create a review for a milestone.
 * Checks that the reviewer hasn't already reviewed this milestone.
 * After insert, triggers approval percentage recalculation.
 *
 * @param {Object} params
 * @param {string} params.milestoneId — Milestone ID
 * @param {string} params.reviewerId — Reviewer (donor) ID
 * @param {string} params.decision — 'approve', 'reject', or 'abstain'
 * @param {string} [params.comment] — Review comment
 * @param {number} [params.voteWeight=1] — Weight of this vote
 * @param {number} [params.donationAmount=0] — Donation amount for weight calculation
 * @param {string} [params.submissionId] — Associated submission ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createReview({
  milestoneId,
  reviewerId,
  decision,
  comment,
  voteWeight = 1,
  donationAmount = 0,
  submissionId,
}) {
  try {
    if (!milestoneId || !reviewerId || !decision) {
      return { success: false, error: "milestoneId, reviewerId, and decision are required" };
    }

    const validDecisions = Object.values(REVIEW_DECISIONS);
    if (!validDecisions.includes(decision)) {
      return { success: false, error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` };
    }

    logInfo("MilestoneReview", "Creating review", {
      milestoneId,
      reviewerId: reviewerId.substring(0, 8) + "...",
      decision,
    });

    // Check if reviewer has already reviewed this milestone
    const { data: existingReview, error: checkError } = await supabaseAdmin
      .from("milestone_reviews")
      .select("id")
      .eq("milestone_id", milestoneId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();

    if (checkError) {
      logError("MilestoneReview", "Check existing review error", { error: checkError.message });
      return { success: false, error: "Failed to check existing review" };
    }

    if (existingReview) {
      return { success: false, error: "You have already reviewed this milestone" };
    }

    // Verify milestone exists and is in a reviewable state
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("id, status, campaign_id")
      .eq("id", milestoneId)
      .single();

    if (milestoneError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    if (milestone.status !== "submitted" && milestone.status !== "active") {
      return { success: false, error: `Cannot review milestone in '${milestone.status}' status` };
    }

    // Vote weight is derived from the donor's VERIFIED contributions to the
    // milestone's campaign. Client-supplied voteWeight/donationAmount are
    // deliberately ignored — trusting them would let a donor forge an
    // arbitrarily large vote and force milestone approval.
    const { data: donations, error: donError } = await supabaseAdmin
      .from("public_donations")
      .select("amount")
      .eq("payer_id", reviewerId)
      .eq("project_id", milestone.campaign_id)
      .in("status", ["paid", "success", "captured"]);

    if (donError) {
      logError("MilestoneReview", "Fetch donations error", { error: donError.message });
      return { success: false, error: "Failed to verify contribution" };
    }

    const verifiedAmount =
      (donations || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || 0;
    const effectiveWeight = Math.max(1, Math.floor(verifiedAmount / 100));

    // Create review
    const { data: review, error: insertError } = await supabaseAdmin
      .from("milestone_reviews")
      .insert({
        milestone_id: milestoneId,
        reviewer_id: reviewerId,
        decision,
        comment: comment || null,
        vote_weight: effectiveWeight,
        donation_amount: verifiedAmount,
        submission_id: submissionId || null,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation at DB level
      if (insertError.code === "23505") {
        return { success: false, error: "You have already reviewed this milestone" };
      }
      logError("MilestoneReview", "Create review error", { error: insertError.message });
      return { success: false, error: "Failed to create review" };
    }

    // Trigger recalculation of approval percentage
    await recalculateApproval(milestoneId);

    await logAuditEvent({
      eventType: "milestone.review_created",
      entityType: "milestone_reviews",
      entityId: review.id,
      userId: reviewerId,
      action: "create_review",
      details: {
        milestoneId,
        decision,
        voteWeight: effectiveWeight,
        donationAmount,
        hasComment: !!comment,
      },
    });

    logInfo("MilestoneReview", "Review created", {
      reviewId: review.id,
      milestoneId,
      decision,
      voteWeight: effectiveWeight,
    });

    return { success: true, data: review };
  } catch (err) {
    logError("MilestoneReview", "Create review error", { error: err.message });
    return { success: false, error: "Failed to create review" };
  }
}

/**
 * Get all reviews for a milestone.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getMilestoneReviews(milestoneId) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_reviews")
      .select(`
        *,
        reviewer: profiles(id, full_name, avatar_url)
      `)
      .eq("milestone_id", milestoneId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("MilestoneReview", "Get milestone reviews error", { error: error.message });
      return { success: false, error: "Failed to fetch reviews" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("MilestoneReview", "Get milestone reviews error", { error: err.message });
    return { success: false, error: "Failed to fetch reviews" };
  }
}

/**
 * Get aggregated review stats for a milestone.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getReviewStats(milestoneId) {
  try {
    if (!milestoneId) {
      return { success: false, error: "milestoneId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_reviews")
      .select("decision, vote_weight, donation_amount")
      .eq("milestone_id", milestoneId);

    if (error) {
      logError("MilestoneReview", "Get review stats error", { error: error.message });
      return { success: false, error: "Failed to fetch review stats" };
    }

    const reviews = data || [];

    const stats = {
      totalReviews: reviews.length,
      approveCount: 0,
      rejectCount: 0,
      abstainCount: 0,
      totalVoteWeight: 0,
      approveWeight: 0,
      rejectWeight: 0,
      totalDonationAmount: 0,
      approvalPercentage: 0,
    };

    for (const r of reviews) {
      stats.totalVoteWeight += r.vote_weight || 0;
      stats.totalDonationAmount += r.donation_amount || 0;

      if (r.decision === REVIEW_DECISIONS.APPROVE) {
        stats.approveCount++;
        stats.approveWeight += r.vote_weight || 0;
      } else if (r.decision === REVIEW_DECISIONS.REJECT) {
        stats.rejectCount++;
        stats.rejectWeight += r.vote_weight || 0;
      } else {
        stats.abstainCount++;
      }
    }

    // Calculate approval percentage based on weighted votes
    const totalDecisionWeight = stats.approveWeight + stats.rejectWeight;
    stats.approvalPercentage =
      totalDecisionWeight > 0 ? Math.round((stats.approveWeight / totalDecisionWeight) * 100) : 0;

    return { success: true, data: stats };
  } catch (err) {
    logError("MilestoneReview", "Get review stats error", { error: err.message });
    return { success: false, error: "Failed to fetch review stats" };
  }
}

/**
 * Check if a user has already reviewed a milestone.
 *
 * @param {string} milestoneId — Milestone ID
 * @param {string} reviewerId — Reviewer ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getUserReview(milestoneId, reviewerId) {
  try {
    if (!milestoneId || !reviewerId) {
      return { success: false, error: "milestoneId and reviewerId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("milestone_reviews")
      .select("*")
      .eq("milestone_id", milestoneId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();

    if (error) {
      logError("MilestoneReview", "Get user review error", { error: error.message });
      return { success: false, error: "Failed to check user review" };
    }

    return {
      success: true,
      data: {
        hasReviewed: !!data,
        review: data || null,
      },
    };
  } catch (err) {
    logError("MilestoneReview", "Get user review error", { error: err.message });
    return { success: false, error: "Failed to check user review" };
  }
}

/**
 * Update a review (only own review allowed).
 *
 * @param {string} reviewId — Review ID
 * @param {string} reviewerId — Reviewer ID (must own the review)
 * @param {Object} updates — Fields to update (decision, comment, voteWeight)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateReview(reviewId, reviewerId, updates) {
  try {
    if (!reviewId || !reviewerId) {
      return { success: false, error: "reviewId and reviewerId are required" };
    }

    if (!updates || Object.keys(updates).length === 0) {
      return { success: false, error: "No updates provided" };
    }

    logInfo("MilestoneReview", "Updating review", {
      reviewId,
      reviewerId: reviewerId.substring(0, 8) + "...",
    });

    // Fetch existing review
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("milestone_reviews")
      .select("*")
      .eq("id", reviewId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Review not found" };
    }

    if (existing.reviewer_id !== reviewerId) {
      return { success: false, error: "You can only update your own reviews" };
    }

    // Validate decision if being updated
    if (updates.decision) {
      const validDecisions = Object.values(REVIEW_DECISIONS);
      if (!validDecisions.includes(updates.decision)) {
        return { success: false, error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}` };
      }
    }

    // Filter out immutable fields
    const { id, milestone_id, reviewer_id, donation_amount, submission_id, created_at, ...allowedUpdates } = updates;

    const { data, error } = await supabaseAdmin
      .from("milestone_reviews")
      .update({
        ...allowedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select()
      .single();

    if (error) {
      logError("MilestoneReview", "Update review error", { error: error.message });
      return { success: false, error: "Failed to update review" };
    }

    // Recalculate approval if decision changed
    if (updates.decision && updates.decision !== existing.decision) {
      await recalculateApproval(existing.milestone_id);
    }

    await logAuditEvent({
      eventType: "milestone.review_updated",
      entityType: "milestone_reviews",
      entityId: reviewId,
      userId: reviewerId,
      action: "update_review",
      details: { updatedFields: Object.keys(allowedUpdates), milestoneId: existing.milestone_id },
    });

    logInfo("MilestoneReview", "Review updated", { reviewId });

    return { success: true, data };
  } catch (err) {
    logError("MilestoneReview", "Update review error", { error: err.message });
    return { success: false, error: "Failed to update review" };
  }
}

/**
 * Delete a review (only own review allowed).
 *
 * @param {string} reviewId — Review ID
 * @param {string} reviewerId — Reviewer ID (must own the review)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteReview(reviewId, reviewerId) {
  try {
    if (!reviewId || !reviewerId) {
      return { success: false, error: "reviewId and reviewerId are required" };
    }

    logInfo("MilestoneReview", "Deleting review", {
      reviewId,
      reviewerId: reviewerId.substring(0, 8) + "...",
    });

    // Fetch existing review
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("milestone_reviews")
      .select("id, reviewer_id, milestone_id")
      .eq("id", reviewId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Review not found" };
    }

    if (existing.reviewer_id !== reviewerId) {
      return { success: false, error: "You can only delete your own reviews" };
    }

    const { error } = await supabaseAdmin
      .from("milestone_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      logError("MilestoneReview", "Delete review error", { error: error.message });
      return { success: false, error: "Failed to delete review" };
    }

    // Recalculate approval after deletion
    await recalculateApproval(existing.milestone_id);

    await logAuditEvent({
      eventType: "milestone.review_deleted",
      entityType: "milestone_reviews",
      entityId: reviewId,
      userId: reviewerId,
      action: "delete_review",
      details: { milestoneId: existing.milestone_id },
    });

    logInfo("MilestoneReview", "Review deleted", { reviewId });

    return { success: true };
  } catch (err) {
    logError("MilestoneReview", "Delete review error", { error: err.message });
    return { success: false, error: "Failed to delete review" };
  }
}

// ─── Internal Helpers ───

/**
 * Recalculate and update the approval percentage on a milestone.
 * Called after every review create, update, or delete.
 *
 * @param {string} milestoneId — Milestone ID
 * @returns {Promise<void>}
 */
async function recalculateApproval(milestoneId) {
  try {
    const { data: reviews, error: fetchError } = await supabaseAdmin
      .from("milestone_reviews")
      .select("decision, vote_weight")
      .eq("milestone_id", milestoneId);

    if (fetchError) {
      logError("MilestoneReview", "Recalculate approval fetch error", { error: fetchError.message });
      return;
    }

    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;
    let approvalCount = 0;
    let rejectionCount = 0;

    for (const r of reviews || []) {
      const weight = r.vote_weight || 1;
      totalWeight += weight;

      if (r.decision === REVIEW_DECISIONS.APPROVE) {
        approveWeight += weight;
        approvalCount++;
      } else if (r.decision === REVIEW_DECISIONS.REJECT) {
        rejectWeight += weight;
        rejectionCount++;
      }
    }

    const decisionWeight = approveWeight + rejectWeight;
    const approvalPercentage = decisionWeight > 0 ? Math.round((approveWeight / decisionWeight) * 100) : 0;

    const { error: updateError } = await supabaseAdmin
      .from("campaign_milestones")
      .update({
        approval_percentage: approvalPercentage,
        total_reviews: (reviews || []).length,
        approval_count: approvalCount,
        rejection_count: rejectionCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestoneId);

    if (updateError) {
      logError("MilestoneReview", "Recalculate approval update error", { error: updateError.message });
    } else {
      logInfo("MilestoneReview", "Approval recalculated", {
        milestoneId,
        approvalPercentage,
        totalReviews: (reviews || []).length,
      });
    }
  } catch (err) {
    logError("MilestoneReview", "Recalculate approval error", { error: err.message });
  }
}

// ─── Configuration Export ───

export { REVIEW_DECISIONS };

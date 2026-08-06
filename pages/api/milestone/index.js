/**
 * Milestone API — Campaign milestone management.
 *
 * GET — List milestones or get single milestone
 * POST — Create milestone
 * PUT — Update milestone
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  createMilestone,
  getCampaignMilestones,
  getMilestone,
  updateMilestone,
  activateMilestone,
  cancelMilestone,
} from "../../../lib/milestone/milestoneEngine";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { milestoneId, campaignId } = req.query;

      if (milestoneId) {
        const result = await getMilestone(milestoneId);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }
        return res
          .status(200)
          .json({ success: true, milestone: result.milestone });
      }

      if (campaignId) {
        const result = await getCampaignMilestones(campaignId);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res
          .status(200)
          .json({ success: true, milestones: result.milestones });
      }

      return res
        .status(400)
        .json({ error: "milestoneId or campaignId is required" });
    } catch (err) {
      logError("MilestoneAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch milestones" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const {
        campaignId,
        title,
        description,
        targetAmount,
        targetDate,
        releaseAmount,
        sortOrder,
        autoApproveThreshold,
        action,
      } = req.body;

      if (action === "activate") {
        const { milestoneId } = req.body;
        if (!milestoneId) {
          return res.status(400).json({ error: "milestoneId is required" });
        }
        const result = await activateMilestone(milestoneId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        return res
          .status(200)
          .json({ success: true, milestone: result.milestone });
      }

      if (action === "cancel") {
        const { milestoneId } = req.body;
        if (!milestoneId) {
          return res.status(400).json({ error: "milestoneId is required" });
        }
        const result = await cancelMilestone(milestoneId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        return res
          .status(200)
          .json({ success: true, message: "Milestone cancelled" });
      }

      if (!campaignId || !title || !targetAmount || !releaseAmount) {
        return res.status(400).json({
          error:
            "campaignId, title, targetAmount, and releaseAmount are required",
        });
      }

      const result = await createMilestone({
        campaignId,
        creatorId: user.id,
        title,
        description,
        targetAmount: parseFloat(targetAmount),
        targetDate,
        releaseAmount: parseFloat(releaseAmount),
        sortOrder: sortOrder || 0,
        autoApproveThreshold: autoApproveThreshold || 60.0,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res
        .status(201)
        .json({ success: true, milestone: result.milestone });
    } catch (err) {
      logError("MilestoneAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to create milestone" });
    }
  }

  if (req.method === "PUT") {
    if (!rl(req, res)) return;

    try {
      const {
        milestoneId,
        title,
        description,
        targetAmount,
        targetDate,
        releaseAmount,
        sortOrder,
      } = req.body;

      if (!milestoneId) {
        return res.status(400).json({ error: "milestoneId is required" });
      }

      const updates = {};
      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (targetAmount) updates.target_amount = parseFloat(targetAmount);
      if (targetDate) updates.target_date = targetDate;
      if (releaseAmount) updates.release_amount = parseFloat(releaseAmount);
      if (sortOrder !== undefined) updates.sort_order = sortOrder;

      const result = await updateMilestone(milestoneId, user.id, updates);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res
        .status(200)
        .json({ success: true, milestone: result.milestone });
    } catch (err) {
      logError("MilestoneAPI", "PUT error", { error: err.message });
      return res.status(500).json({ error: "Failed to update milestone" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

/**
 * Milestone Submission API — Creator evidence submissions.
 *
 * GET — List submissions for a milestone
 * POST — Submit evidence for milestone
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  submitMilestone,
  getSubmissions,
} from "../../../lib/milestone/milestoneSubmission";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { milestoneId } = req.query;

      if (!milestoneId) {
        return res.status(400).json({ error: "milestoneId is required" });
      }

      const result = await getSubmissions(milestoneId);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res
        .status(200)
        .json({ success: true, submissions: result.submissions });
    } catch (err) {
      logError("MilestoneSubmitAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch submissions" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const {
        milestoneId,
        title,
        description,
        submissionType,
        files,
        links,
        progressNotes,
      } = req.body;

      if (!milestoneId || !title) {
        return res
          .status(400)
          .json({ error: "milestoneId and title are required" });
      }

      const result = await submitMilestone({
        milestoneId,
        creatorId: user.id,
        title,
        description,
        submissionType: submissionType || "progress_report",
        files: files || [],
        links: links || [],
        progressNotes,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res
        .status(201)
        .json({ success: true, submission: result.submission });
    } catch (err) {
      logError("MilestoneSubmitAPI", "POST error", { error: err.message });
      return res
        .status(500)
        .json({ error: "Failed to submit milestone evidence" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

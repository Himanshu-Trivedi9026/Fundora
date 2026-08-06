/**
 * Admin Appeals Dashboard API — Appeals center for admins.
 *
 * GET — Appeals overview, list, detail
 * POST — Assign reviewer, review appeal, request evidence
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import {
  getAppeal,
  getAppeals,
  assignAppealReviewer,
  requestEvidence,
  reviewAppeal,
  getAppealsStats,
} from "../../../lib/appeals/appealsEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const { mode, status, appealType, limit, offset, appealId } = req.query;

        if (mode === "overview" || !mode) {
          const stats = await getAppealsStats();
          const pendingAppeals = await getAppeals({
            status: "submitted",
            limit: parseInt(limit, 10) || 20,
            offset: 0,
          });

          return res.status(200).json({
            success: true,
            stats: stats.success ? stats.data : { total: 0, pending: 0 },
            pendingAppeals: pendingAppeals.success
              ? pendingAppeals.data.appeals
              : [],
          });
        }

        if (mode === "list") {
          const result = await getAppeals({
            status,
            appealType,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
          });
          return res.status(200).json({
            success: true,
            ...(result.success ? result.data : { appeals: [], total: 0 }),
          });
        }

        if (mode === "detail") {
          if (!appealId)
            return res.status(400).json({ error: "appealId is required" });
          const result = await getAppeal(appealId);
          return res.status(200).json({
            success: true,
            ...(result.success
              ? { data: result.data }
              : { error: result.error }),
          });
        }

        return res.status(400).json({ error: "Invalid mode" });
      } catch (err) {
        logError("AppealsDashboardAPI", "GET error", { error: err.message });
        return res
          .status(500)
          .json({ error: "Failed to fetch appeals dashboard" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const { action, ...params } = req.body;

        if (action === "assign_reviewer") {
          const { appealId, reviewerId } = params;
          if (!appealId || !reviewerId)
            return res
              .status(400)
              .json({ error: "appealId and reviewerId are required" });
          const result = await assignAppealReviewer(
            appealId,
            reviewerId,
            user.id,
          );
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "review_appeal") {
          const { appealId, reviewerDecision, decisionReason, reviewerNotes } =
            params;
          if (!appealId || !reviewerDecision)
            return res
              .status(400)
              .json({ error: "appealId and reviewerDecision are required" });
          const result = await reviewAppeal(
            appealId,
            reviewerDecision,
            decisionReason,
            reviewerNotes,
            user.id,
          );
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "request_evidence") {
          const { appealId, reason } = params;
          if (!appealId || !reason)
            return res
              .status(400)
              .json({ error: "appealId and reason are required" });
          const result = await requestEvidence(appealId, reason, user.id);
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(200).json({ success: true, data: result.data });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("AppealsDashboardAPI", "POST error", { error: err.message });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);

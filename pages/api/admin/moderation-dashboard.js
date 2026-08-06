/**
 * Admin Moderation Dashboard API — Content and user moderation.
 *
 * GET — Moderation dashboard overview, cases list, stats
 * POST — Assign, resolve, escalate, reopen moderation cases
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  getModerationCases,
  assignModerationCase,
  resolveModerationCase,
  reopenModerationCase,
  escalateModerationCase,
  getModerationStats,
} from "../../../lib/moderation";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    // Admin-only (see middleware + withRole in lib/withAuth.js).

    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const { mode, status, caseType, priority, limit, offset } = req.query;

        // Overview mode
        if (mode === "overview" || !mode) {
          const statsResult = await getModerationStats();
          if (!statsResult.success) {
            return res.status(500).json({ error: statsResult.error });
          }

          // Open cases
          const openCasesResult = await getModerationCases({
            status: "open",
            limit: 20,
            offset: 0,
          });

          // In-review cases
          const inReviewResult = await getModerationCases({
            status: "in_review",
            limit: 20,
            offset: 0,
          });

          // Recent reports (newest first)
          const recentResult = await getModerationCases({
            limit: 20,
            offset: 0,
          });

          // Action distribution
          const { data: allCases } = await supabaseAdmin
            .from("moderation_cases")
            .select("action_taken");

          const actionDistribution = {};
          (allCases || []).forEach((c) => {
            if (c.action_taken) {
              actionDistribution[c.action_taken] =
                (actionDistribution[c.action_taken] || 0) + 1;
            }
          });

          return res.status(200).json({
            success: true,
            stats: statsResult.data,
            openCases: openCasesResult.data || [],
            inReviewCases: inReviewResult.data || [],
            recentReports: recentResult.data || [],
            actionDistribution,
          });
        }

        // Cases mode
        if (mode === "cases") {
          const result = await getModerationCases({
            status,
            caseType,
            priority,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
          });

          if (!result.success) {
            return res.status(500).json({ error: result.error });
          }

          return res.status(200).json({
            success: true,
            cases: result.data,
            total: result.total,
          });
        }

        // Stats mode
        if (mode === "stats") {
          const statsResult = await getModerationStats();
          if (!statsResult.success) {
            return res.status(500).json({ error: statsResult.error });
          }

          return res.status(200).json({
            success: true,
            stats: statsResult.data,
          });
        }

        return res.status(400).json({ error: "Invalid mode" });
      } catch (err) {
        logError("ModerationDashboardAPI", "GET error", { error: err.message });
        return res
          .status(500)
          .json({ error: "Failed to fetch moderation dashboard" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const {
          action,
          caseId,
          moderatorId,
          actionTaken,
          resolution,
          moderatorNotes,
          reason,
        } = req.body;

        if (action === "assign_case") {
          if (!caseId || !moderatorId) {
            return res
              .status(400)
              .json({ error: "caseId and moderatorId are required" });
          }

          const result = await assignModerationCase(
            caseId,
            moderatorId,
            user.id,
          );

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "resolve_case") {
          if (!caseId || !actionTaken || !resolution) {
            return res.status(400).json({
              error: "caseId, actionTaken, and resolution are required",
            });
          }

          const result = await resolveModerationCase(
            caseId,
            actionTaken,
            resolution,
            moderatorNotes || null,
            user.id,
          );

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "escalate_case") {
          if (!caseId || !reason) {
            return res
              .status(400)
              .json({ error: "caseId and reason are required" });
          }

          const result = await escalateModerationCase(caseId, reason, user.id);

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "reopen_case") {
          if (!caseId || !reason) {
            return res
              .status(400)
              .json({ error: "caseId and reason are required" });
          }

          const result = await reopenModerationCase(caseId, reason, user.id);

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("ModerationDashboardAPI", "POST error", {
          error: err.message,
        });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);

/**
 * Admin Compliance Dashboard API — Compliance case management.
 *
 * GET — Compliance dashboard overview, cases list, case events
 * POST — Create, update, assign, resolve, escalate, reopen cases
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  createComplianceCase,
  getComplianceCase,
  getComplianceCases,
  updateComplianceCase,
  assignComplianceCase,
  resolveComplianceCase,
  reopenComplianceCase,
  escalateComplianceCase,
  getComplianceStats,
} from "../../../lib/compliance";
import { getComplianceEvents } from "../../../lib/compliance/complianceEvents";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    // Admin-only (see middleware + withRole in lib/withAuth.js).

    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const { mode, status, caseType, priority, limit, offset, caseId } =
          req.query;

        // Overview mode
        if (mode === "overview" || !mode) {
          const statsResult = await getComplianceStats();
          if (!statsResult.success) {
            return res.status(500).json({ error: statsResult.error });
          }

          // Recent cases
          const recentResult = await getComplianceCases({
            limit: 20,
            offset: 0,
          });

          // Escalation queue (escalated status)
          const escalationResult = await getComplianceCases({
            status: "escalated",
            limit: 20,
            offset: 0,
          });

          return res.status(200).json({
            success: true,
            stats: statsResult.data,
            recentCases: recentResult.data || [],
            escalationQueue: escalationResult.data || [],
          });
        }

        // Cases mode
        if (mode === "cases") {
          const result = await getComplianceCases({
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

        // Events mode
        if (mode === "events") {
          if (!caseId) {
            return res
              .status(400)
              .json({ error: "caseId is required for events mode" });
          }

          const result = await getComplianceEvents({
            complianceCaseId: caseId,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
          });

          if (!result.success) {
            return res.status(500).json({ error: result.error });
          }

          return res.status(200).json({
            success: true,
            events: result.data,
            total: result.total,
          });
        }

        return res.status(400).json({ error: "Invalid mode" });
      } catch (err) {
        logError("ComplianceDashboardAPI", "GET error", { error: err.message });
        return res
          .status(500)
          .json({ error: "Failed to fetch compliance dashboard" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const {
          action,
          caseId,
          caseType,
          subjectUserId,
          subjectCampaignId,
          priority,
          description,
          evidenceUrls,
          metadata,
          assignTo,
          resolutionType,
          resolution,
          reason,
          updates,
        } = req.body;

        if (action === "create_case") {
          if (!caseType) {
            return res.status(400).json({ error: "caseType is required" });
          }

          const result = await createComplianceCase({
            caseType,
            subjectUserId,
            subjectCampaignId,
            priority: priority || "medium",
            description,
            evidenceUrls: evidenceUrls || [],
            metadata: metadata || {},
          });

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(201).json({ success: true, data: result.data });
        }

        if (action === "update_case") {
          if (!caseId || !updates) {
            return res
              .status(400)
              .json({ error: "caseId and updates are required" });
          }

          const result = await updateComplianceCase(caseId, updates, user.id);

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "assign_case") {
          if (!caseId || !assignTo) {
            return res
              .status(400)
              .json({ error: "caseId and assignTo are required" });
          }

          const result = await assignComplianceCase(caseId, assignTo, user.id);

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "resolve_case") {
          if (!caseId || !resolutionType || !resolution) {
            return res.status(400).json({
              error: "caseId, resolutionType, and resolution are required",
            });
          }

          const result = await resolveComplianceCase(
            caseId,
            resolutionType,
            resolution,
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

          const result = await escalateComplianceCase(caseId, reason, user.id);

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

          const result = await reopenComplianceCase(caseId, reason, user.id);

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res.status(200).json({ success: true, data: result.data });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("ComplianceDashboardAPI", "POST error", {
          error: err.message,
        });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);

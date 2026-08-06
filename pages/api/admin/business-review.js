import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import {
  approveBusinessVerification,
  rejectBusinessVerification,
  requestResubmission,
} from "../../../lib/verification/manualReview";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

/**
 * Admin business verification review.
 * POST: Approve, reject, or request resubmission.
 */
export default withRole(
  async function handler(req, res, user) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!rl(req, res)) return;

    try {
      const { action, verificationId, reason, notes } = req.body;

      if (!action || !verificationId) {
        return res
          .status(400)
          .json({ error: "Action and verification ID are required" });
      }

      let result;

      switch (action) {
        case "approve":
          result = await approveBusinessVerification(
            verificationId,
            user.id,
            notes,
            user.id,
          );
          break;
        case "reject":
          if (!reason) {
            return res
              .status(400)
              .json({ error: "Rejection reason is required" });
          }
          result = await rejectBusinessVerification(
            verificationId,
            user.id,
            reason,
            user.id,
          );
          break;
        case "resubmit":
          if (!reason) {
            return res
              .status(400)
              .json({ error: "Resubmission reason is required" });
          }
          result = await requestResubmission(
            verificationId,
            user.id,
            reason,
            user.id,
          );
          break;
        default:
          return res.status(400).json({
            error: "Invalid action. Must be: approve, reject, resubmit",
          });
      }

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },
  [ROLES.ADMIN],
);

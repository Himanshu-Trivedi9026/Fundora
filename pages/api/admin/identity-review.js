import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import {
  approveRequest,
  rejectRequest,
  requestResubmission,
  suspendVerification,
} from "../../../lib/verification/manualReview";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

/**
 * Admin identity verification review.
 * POST: Approve, reject, request more documents (resubmit), or suspend.
 *
 * Operates on verification_requests rows (the identity lifecycle). Every
 * action updates Supabase, writes an audit log, syncs the creator's overall
 * verification status, and sends an in-app notification.
 */
export default withRole(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const { action, verificationId, reason, notes } = req.body;

    if (!action || !verificationId) {
      return res.status(400).json({ error: "Action and verification ID are required" });
    }

    let result;

    switch (action) {
      case "approve":
        result = await approveRequest(verificationId, user.id, notes, user.id);
        break;
      case "reject":
        if (!reason) {
          return res.status(400).json({ error: "Rejection reason is required" });
        }
        result = await rejectRequest(verificationId, user.id, reason, user.id);
        break;
      case "resubmit":
        if (!reason) {
          return res.status(400).json({ error: "Reason is required" });
        }
        result = await requestResubmission(verificationId, user.id, reason, user.id);
        break;
      case "suspend":
        result = await suspendVerification(verificationId, user.id, reason, user.id);
        break;
      default:
        return res.status(400).json({ error: "Invalid action. Must be: approve, reject, resubmit, suspend" });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}, [ROLES.ADMIN]);

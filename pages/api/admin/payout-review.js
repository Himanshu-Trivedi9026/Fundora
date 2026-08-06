/**
 * Admin Payout Review API — Approve/reject payout requests.
 *
 * GET — List pending payouts
 * POST — Approve, reject, or process payout
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { getPendingPayouts, approvePayout, rejectPayout, processPayout } from "../../../lib/payout/payoutEngine";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(async function handler(req, res, user) {
  // Admin-only (see middleware + withRole in lib/withAuth.js).

  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { limit, offset } = req.query;

      const result = await getPendingPayouts({
        limit: parseInt(limit, 10) || 20,
        offset: parseInt(offset, 10) || 0,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({
        success: true,
        payouts: result.payouts,
        total: result.total,
      });
    } catch (err) {
      logError("PayoutReviewAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch payouts" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, payoutRequestId, reason } = req.body;

      if (!payoutRequestId || !action) {
        return res.status(400).json({ error: "payoutRequestId and action are required" });
      }

      if (action === "approve") {
        const result = await approvePayout(payoutRequestId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        return res.status(200).json({ success: true, payout: result.payout });
      }

      if (action === "reject") {
        if (!reason) {
          return res.status(400).json({ error: "reason is required for rejection" });
        }
        const result = await rejectPayout(payoutRequestId, user.id, reason);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        return res.status(200).json({ success: true, payout: result.payout });
      }

      if (action === "process") {
        const result = await processPayout(payoutRequestId);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        return res.status(200).json({ success: true, transaction: result.transaction });
      }

      return res.status(400).json({ error: "Invalid action. Use 'approve', 'reject', or 'process'" });
    } catch (err) {
      logError("PayoutReviewAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process payout request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}, [ROLES.ADMIN]);

/**
 * Payout Status API — Check payout status and history.
 *
 * GET — Get payout request details and transaction history
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getPayoutRequest, getPayoutHistory } from "../../../lib/payout/payoutEngine";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { payoutRequestId, mode, limit, offset } = req.query;

      if (mode === "history") {
        const result = await getPayoutHistory(user.id, parseInt(limit, 10) || 20, parseInt(offset, 10) || 0);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({
          success: true,
          requests: result.requests,
          total: result.total,
        });
      }

      if (payoutRequestId) {
        const result = await getPayoutRequest(payoutRequestId);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }

        // Sanitize
        const safe = { ...result.request };
        delete safe.metadata;
        delete safe.fraud_risk_score;
        delete safe.fraud_decision;

        return res.status(200).json({ success: true, request: safe });
      }

      return res.status(400).json({ error: "payoutRequestId or mode=history is required" });
    } catch (err) {
      logError("PayoutStatusAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch payout status" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

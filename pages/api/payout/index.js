/**
 * Payout API — Creator payout requests.
 *
 * GET — List payout requests or get balance
 * POST — Create payout request
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { createPayoutRequest, getCreatorPayoutRequests, getCreatorBalance } from "../../../lib/payout/payoutEngine";
import { logError } from "../../../lib/verification/secureLogger";
import { isCreatorVerified } from "../../../lib/verification/status";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { mode, limit, offset } = req.query;

      if (mode === "balance") {
        const result = await getCreatorBalance(user.id);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({ success: true, balance: result.balance });
      }

      const result = await getCreatorPayoutRequests(user.id);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Sanitize: remove internal fraud details
      const safeRequests = (result.requests || []).map((r) => {
        const safe = { ...r };
        delete safe.metadata;
        delete safe.fraud_risk_score;
        delete safe.fraud_decision;
        return safe;
      });

      return res.status(200).json({ success: true, requests: safeRequests });
    } catch (err) {
      logError("PayoutAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch payout requests" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { escrowAccountId, bankAccountId, amount } = req.body;

      if (!escrowAccountId || !bankAccountId || !amount) {
        return res.status(400).json({ error: "escrowAccountId, bankAccountId, and amount are required" });
      }

      /* A creator may only withdraw funds when their verification is approved. */
      if (!(await isCreatorVerified(user.id))) {
        return res.status(403).json({ error: "VerificationRequired" });
      }

      const result = await createPayoutRequest({
        creatorId: user.id,
        escrowAccountId,
        bankAccountId,
        amount: parseFloat(amount),
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Sanitize response
      const safe = { ...result.request };
      delete safe.fraud_risk_score;
      delete safe.fraud_decision;
      delete safe.metadata;

      return res.status(201).json({ success: true, request: safe });
    } catch (err) {
      logError("PayoutAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to create payout request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

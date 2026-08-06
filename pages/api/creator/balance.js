/**
 * Creator Balance API — Creator earnings and balance overview.
 *
 * GET — Get creator's balance across all campaigns
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getCreatorBalance } from "../../../lib/payout/payoutEngine";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const result = await getCreatorBalance(user.id);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ success: true, balance: result.balance });
    } catch (err) {
      logError("CreatorBalanceAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch balance" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

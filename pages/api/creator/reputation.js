/**
 * Creator Reputation API — Creator's own reputation view.
 *
 * GET — Get own reputation scores
 * POST — Trigger reputation recalculation
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import { getCreatorReputation, calculateCreatorReputation } from "../../../lib/reputation/reputationEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const result = await getCreatorReputation(user.id);
      if (!result.success) {
        // Try calculating fresh
        const calcResult = await calculateCreatorReputation(user.id);
        return res.status(200).json({ success: true, data: calcResult.success ? calcResult.data : null });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      logError("CreatorReputationAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch reputation" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const result = await calculateCreatorReputation(user.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      logError("CreatorReputationAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to calculate reputation" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

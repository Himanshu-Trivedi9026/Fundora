/**
 * Appeals API — Submit and view appeals.
 *
 * POST — Submit an appeal
 * GET — Get own appeals
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import {
  createAppeal,
  getAppeals,
  withdrawAppeal,
} from "../../../lib/appeals/appealsEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, ...params } = req.body;

      if (action === "withdraw") {
        const { appealId } = params;
        if (!appealId) return res.status(400).json({ error: "appealId is required" });
        const result = await withdrawAppeal(appealId, user.id);
        if (!result.success) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, data: result.data });
      }

      const { appealType, originalAction, originalActionId, originalActionType, reason, evidenceUrls, metadata } = req.body;
      if (!appealType || !originalAction || !reason) {
        return res.status(400).json({ error: "appealType, originalAction, and reason are required" });
      }

      const result = await createAppeal({
        appealType,
        appellantId: user.id,
        originalAction,
        originalActionId,
        originalActionType,
        reason,
        evidenceUrls: evidenceUrls || [],
        metadata,
      });

      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      logError("AppealsAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to submit appeal" });
    }
  }

  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { limit, offset } = req.query;
      const result = await getAppeals({
        appellantId: user.id,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      });
      return res.status(200).json({ success: true, ...(result.success ? result.data : { appeals: [], total: 0 }) });
    } catch (err) {
      logError("AppealsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch appeals" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

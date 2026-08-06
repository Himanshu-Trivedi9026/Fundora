// POST /api/mobile/sync — Process sync batch from mobile client
// GET /api/mobile/sync — Get changes since timestamp
import { withAuth } from "../../../lib/withAuth.js";
import {
  processSyncBatch,
  getChangesSince,
} from "../../../lib/mobile/offlineSync.js";

async function handler(req, res, user) {
  try {
    switch (req.method) {
      case "GET": {
        const { since, tables } = req.query;
        if (!since)
          return res
            .status(400)
            .json({ success: false, error: "since timestamp required" });

        const result = await getChangesSince(user?.id, since, {
          tables: tables ? tables.split(",") : undefined,
        });
        if (!result.success)
          return res.status(400).json({ success: false, error: result.error });
        return res.status(200).json(result);
      }

      case "POST": {
        const { operations, conflictStrategy } = req.body;
        if (!operations || !Array.isArray(operations)) {
          return res
            .status(400)
            .json({ success: false, error: "operations array required" });
        }

        const result = await processSyncBatch(operations, {
          conflictStrategy,
          userId: user?.id,
        });
        return res.status(200).json(result);
      }

      default:
        return res
          .status(405)
          .json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);

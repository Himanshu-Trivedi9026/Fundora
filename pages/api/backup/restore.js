// POST /api/backup/restore — Initiate restore operation
// GET /api/backup/restore — List restore operations
import { withAuth } from "../../../lib/withAuth.js";
import {
  initiateRestore,
  listRestoreOperations,
  getRestoreOperation,
} from "../../../lib/backup/restoreEngine.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { restoreId } = req.query;
        if (restoreId) {
          const result = await getRestoreOperation(restoreId);
          return res.status(200).json(result);
        }
        const result = await listRestoreOperations({
          organizationId: req.user?.organizationId,
        });
        return res.status(200).json(result);
      }

      case "POST": {
        const result = await initiateRestore({
          ...req.body,
          initiatedBy: req.user?.id,
          organizationId: req.user?.organizationId,
        });
        return res.status(result.success ? 201 : 400).json(result);
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

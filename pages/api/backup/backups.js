// GET /api/backup/backups — List backups
// POST /api/backup/backups — Create backup
// DELETE /api/backup/backups — Delete backup
import { withAuth } from "../../../lib/withAuth.js";
import {
  createBackup,
  listBackups,
  deleteBackup,
  getBackupStats,
} from "../../../lib/backup/backupEngine.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { stats, status } = req.query;
        if (stats) {
          const result = await getBackupStats();
          return res.status(200).json(result);
        }
        const result = await listBackups({
          status,
          organizationId: req.user?.organizationId,
        });
        return res.status(200).json(result);
      }

      case "POST": {
        const result = await createBackup({
          ...req.body,
          createdBy: req.user?.id,
          organizationId: req.user?.organizationId,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "DELETE": {
        const { backupId } = req.body;
        if (!backupId)
          return res
            .status(400)
            .json({ success: false, error: "backupId required" });
        const result = await deleteBackup(backupId);
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

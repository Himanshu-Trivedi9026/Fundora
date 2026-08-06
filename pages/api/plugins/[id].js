// GET /api/plugins/[id] — Get plugin details
// PUT /api/plugins/[id] — Update plugin
// DELETE /api/plugins/[id] — Uninstall plugin
import { withAuth } from "../../../lib/withAuth.js";
import { getPluginRegistry } from "../../../lib/plugins/pluginRegistry.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";

async function handler(req, res) {
  const { id } = req.query;
  const registry = getPluginRegistry();

  try {
    switch (req.method) {
      case "GET": {
        const plugin = registry.getPlugin(id);
        if (!plugin) return res.status(404).json({ success: false, error: "Plugin not found" });
        return res.status(200).json({ success: true, data: plugin });
      }

      case "PUT": {
        const updates = req.body;
        // In production: update plugin in DB
        await logAuditEvent({
          action: "plugin.update",
          actorId: req.user?.id,
          targetType: "plugin",
          targetId: id,
          metadata: updates,
        });
        return res.status(200).json({ success: true, data: { id, ...updates } });
      }

      case "DELETE": {
        // In production: uninstall plugin, update DB status
        await logAuditEvent({
          action: "plugin.uninstall",
          actorId: req.user?.id,
          targetType: "plugin",
          targetId: id,
        });
        return res.status(200).json({ success: true, data: { id, status: "uninstalled" } });
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);

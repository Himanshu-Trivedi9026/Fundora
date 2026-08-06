// POST /api/plugins/submit — Submit a new plugin
import { withAuth } from "../../../lib/withAuth.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";
import { logError } from "../../../lib/verification/secureLogger.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { name, description, version, hooks, permissions } = req.body;
    const userId = req.user?.id;

    if (!name || !description || !version) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, description, version",
      });
    }

    // Plugin submission logic (simplified — full flow via PluginEngine)
    const pluginRecord = {
      name,
      description,
      version,
      hooks: hooks || [],
      permissions: permissions || [],
      status: "pending_review",
      author_id: userId,
      created_at: new Date().toISOString(),
    };

    // In production, persist to DB via supabaseAdmin
    await logAuditEvent({
      action: "plugin.submit",
      actorId: userId,
      targetType: "plugin",
      metadata: { name, version },
    });

    return res.status(201).json({
      success: true,
      data: { ...pluginRecord, id: `plugin_${Date.now()}` },
    });
  } catch (err) {
    logError("Plugin submission error", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);

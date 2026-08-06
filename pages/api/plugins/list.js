// GET /api/plugins/list — List plugins (with optional filters)
import { withAuth } from "../../../lib/withAuth.js";
import { getPluginRegistry } from "../../../lib/plugins/pluginRegistry.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { status, authorId } = req.query;
    const registry = getPluginRegistry();
    const plugins = registry.listPlugins({ status, authorId });

    return res.status(200).json({ success: true, data: plugins });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);

// API — MCP Server endpoint
// Exposes the MCP server via HTTP for AI agent access

import { withAuth } from "../../../lib/withAuth.js";
import { listTools, executeTool, getServerInfo, buildContext } from "../../../lib/mcp/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "GET": {
        if (req.query.info) {
          return res.status(200).json({ success: true, data: getServerInfo() });
        }
        return res.status(200).json({ success: true, data: { tools: listTools() } });
      }

      case "POST": {
        const { tool, args } = req.body;
        if (!tool) return res.status(400).json({ success: false, error: "tool name required" });

        const context = buildContext(req.user, req.user?.organization_id);
        const result = await executeTool(tool, args || {}, context);
        return res.status(result.success ? 200 : 400).json(result);
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler);

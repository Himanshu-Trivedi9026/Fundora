// API — Agents CRUD

import { withAuth } from "../../../lib/withAuth.js";
import {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
} from "../../../lib/agents/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const result = await createAgent({
          ...req.body,
          ownerId: req.user.id,
          organizationId: req.user.organization_id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        if (req.query.id) {
          const result = await getAgent(req.query.id);
          return res.status(result.success ? 200 : 404).json(result);
        }
        const result = await listAgents({
          agentType: req.query.agentType,
          status: req.query.status,
          organizationId: req.user.organization_id,
          ownerId: req.query.ownerId,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
      }

      case "PUT": {
        if (!req.query.id)
          return res
            .status(400)
            .json({ success: false, error: "Agent ID required" });
        const result = await updateAgent(req.query.id, req.body);
        return res.status(result.success ? 200 : 400).json(result);
      }

      case "DELETE": {
        if (!req.query.id)
          return res
            .status(400)
            .json({ success: false, error: "Agent ID required" });
        const result = await deleteAgent(req.query.id);
        return res.status(result.success ? 200 : 400).json(result);
      }

      default:
        return res
          .status(405)
          .json({ success: false, error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler);

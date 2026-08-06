// API — Enterprise Connectors

import { withAuth } from "../../../lib/withAuth.js";
import {
  registerConnector,
  connectConnector,
  disconnectConnector,
  sendConnectorMessage,
  getConnectorStatus,
  listConnectors,
  deleteConnector,
  getAvailableProviders,
} from "../../../lib/connectors/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const result = await registerConnector({
          ...req.body,
          createdBy: req.user.id,
          organizationId: req.user.organization_id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        if (req.query.providers) {
          return res
            .status(200)
            .json({ success: true, data: getAvailableProviders() });
        }
        if (req.query.id) {
          const result = await getConnectorStatus(req.query.id);
          return res.status(result.success ? 200 : 404).json(result);
        }
        const result = await listConnectors({
          provider: req.query.provider,
          status: req.query.status,
          organizationId: req.user.organization_id,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
      }

      case "PUT": {
        if (!req.query.id)
          return res
            .status(400)
            .json({ success: false, error: "Connector ID required" });

        const { action, channel, message } = req.body;
        let result;

        switch (action) {
          case "connect":
            result = await connectConnector(req.query.id);
            break;
          case "disconnect":
            result = await disconnectConnector(req.query.id);
            break;
          case "send":
            if (!channel || !message)
              return res.status(400).json({
                success: false,
                error: "channel and message required",
              });
            result = await sendConnectorMessage(req.query.id, channel, message);
            break;
          default:
            return res
              .status(400)
              .json({ success: false, error: `Unknown action: ${action}` });
        }

        return res.status(result.success ? 200 : 400).json(result);
      }

      case "DELETE": {
        if (!req.query.id)
          return res
            .status(400)
            .json({ success: false, error: "Connector ID required" });
        const result = await deleteConnector(req.query.id);
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

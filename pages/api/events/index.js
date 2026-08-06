// API — Event Bus

import { withAuth } from "../../../lib/withAuth.js";
import {
  publish,
  queryEvents,
  createSubscription,
  listSubscriptions,
  processScheduledEvents,
  processDeadLetterQueue,
  EVENT_PRIORITIES,
} from "../../../lib/events/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const { eventType, payload, options } = req.body;
        if (!eventType || !payload) {
          return res
            .status(400)
            .json({ success: false, error: "eventType and payload required" });
        }
        const result = await publish(eventType, payload, {
          ...options,
          source: "api",
          organizationId: req.user?.organization_id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        const result = await queryEvents({
          eventType: req.query.eventType,
          status: req.query.status,
          correlationId: req.query.correlationId,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
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

// GET /api/observability/alerts — List/get alerts
// POST /api/observability/alerts — Create alert
// PUT /api/observability/alerts — Acknowledge/resolve/silence alert
import { withAuth } from "../../../lib/withAuth.js";
import {
  getAlerts,
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  silenceAlert,
  getAlertStats,
} from "../../../lib/observability/alertManager.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { stats, id, status, severity, organizationId } = req.query;

        if (stats) {
          const result = await getAlertStats();
          return res.status(200).json(result);
        }

        const result = await getAlerts({ status, severity, organizationId });
        return res.status(200).json(result);
      }

      case "POST": {
        const result = await createAlert(req.body);
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "PUT": {
        const { action, alertId } = req.body;
        if (!alertId)
          return res
            .status(400)
            .json({ success: false, error: "alertId required" });

        let result;
        switch (action) {
          case "acknowledge":
            result = await acknowledgeAlert(alertId, req.user?.id);
            break;
          case "resolve":
            result = await resolveAlert(alertId);
            break;
          case "silence":
            result = await silenceAlert(alertId);
            break;
          default:
            return res
              .status(400)
              .json({ success: false, error: "Invalid action" });
        }

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

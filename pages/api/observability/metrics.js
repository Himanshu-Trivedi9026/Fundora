// GET /api/observability/metrics — Query platform metrics
// POST /api/observability/metrics — Record a metric
import { withAuth } from "../../../lib/withAuth.js";
import { recordMetric, queryMetrics, getMetricSummary, getDashboardMetrics } from "../../../lib/observability/metricsEngine.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { metricName, since, until, source, summary, dashboard, organizationId } = req.query;

        if (dashboard) {
          const result = await getDashboardMetrics(organizationId, { since });
          return res.status(200).json(result);
        }

        if (summary && metricName) {
          const result = await getMetricSummary(metricName, { since, until });
          return res.status(200).json(result);
        }

        if (metricName) {
          const result = await queryMetrics(metricName, { since, until, source });
          return res.status(200).json(result);
        }

        return res.status(400).json({ success: false, error: "metricName is required" });
      }

      case "POST": {
        const { metricName, value, metricType, tags, source } = req.body;
        if (!metricName || value === undefined) {
          return res.status(400).json({ success: false, error: "metricName and value required" });
        }
        const result = await recordMetric(metricName, value, metricType || "counter", tags || {}, { source });
        return res.status(result.success ? 201 : 400).json(result);
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);

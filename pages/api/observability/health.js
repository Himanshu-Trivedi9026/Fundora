// GET /api/observability/health — Health check status
import {
  runAllHealthChecks,
  getHealthSummary,
  getComponents,
} from "../../../lib/observability/healthMonitor.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { summary, components } = req.query;

    if (components) {
      return res.status(200).json({ success: true, data: getComponents() });
    }

    if (summary !== "false") {
      const result = await getHealthSummary();
      return res.status(200).json(result);
    }

    const result = await runAllHealthChecks();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

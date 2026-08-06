// API — Database health check
import { checkDatabaseHealth, getPoolStats } from "../../../lib/performance/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const result = await checkDatabaseHealth();

    if (!result.success) {
      return res.status(503).json({
        status: "unhealthy",
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: result.data.reachable ? "healthy" : "degraded",
      reachable: result.data.reachable,
      responseTime: `${result.data.responseTime}ms`,
      lastCheck: result.data.lastCheck,
      connectionPool: result.data.connectionPool,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({ status: "unhealthy", error: err.message });
  }
}

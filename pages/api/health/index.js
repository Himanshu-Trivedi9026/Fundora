// API — Health check endpoint
// Used by Docker HEALTHCHECK, K8s liveness/readiness/startup probes, and load balancers

import { checkDatabaseHealth, getPoolStats } from "../../../lib/performance/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const dbHealth = await checkDatabaseHealth();

    const isHealthy = dbHealth.success && dbHealth.data.reachable;

    const health = {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: dbHealth.success ? { status: "ok", responseTime: dbHealth.data.responseTime } : { status: "error" },
        memory: {
          status: "ok",
          usage: process.memoryUsage(),
        },
        pool: getPoolStats(),
      },
    };

    const statusCode = isHealthy ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (err) {
    return res.status(503).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

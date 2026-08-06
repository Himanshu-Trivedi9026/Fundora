// API — System diagnostics endpoint
// Provides comprehensive system health and performance diagnostics

import { checkDatabaseHealth, getPoolStats, getEndpointMetrics } from "../../../lib/performance/index.js";
import { getStats } from "../../../lib/cache/index.js";
import { getActiveJobCount } from "../../../lib/jobs/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const dbHealth = await checkDatabaseHealth();
    const poolStats = getPoolStats();
    const cacheStats = getStats();
    const endpointMetrics = getEndpointMetrics();
    const activeJobs = getActiveJobCount();
    const memUsage = process.memoryUsage();

    const diagnostics = {
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: Math.floor(process.uptime()),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      database: {
        status: dbHealth.success ? (dbHealth.data.reachable ? "connected" : "unreachable") : "error",
        responseTimeMs: dbHealth.data?.responseTime || null,
        lastCheck: dbHealth.data?.lastCheck || null,
        pool: poolStats,
      },
      cache: {
        memoryItems: cacheStats.memory.size,
        activeLocks: cacheStats.locks.active,
        rateLimiters: cacheStats.rateLimiters.active,
      },
      jobs: {
        active: activeJobs,
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
        rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
        external: Math.round(memUsage.external / 1024 / 1024) + "MB",
      },
      endpoints: {
        tracked: endpointMetrics.length,
        details: endpointMetrics.slice(0, 20), // Top 20
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        cacheBackend: process.env.CACHE_BACKEND || "memory",
        tracing: process.env.ENABLE_TRACING === "true",
        metrics: process.env.ENABLE_METRICS === "true",
      },
    };

    return res.status(200).json({
      success: true,
      data: diagnostics,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// API — Infrastructure health dashboard data
import { checkDatabaseHealth, getPoolStats, getEndpointMetrics } from "../../../lib/performance/index.js";
import { getStats } from "../../../lib/cache/index.js";
import { getActiveJobCount, listHandlers } from "../../../lib/jobs/index.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const [dbHealth, systemHealth, deploymentResult] = await Promise.all([
      checkDatabaseHealth(),
      supabaseAdmin
        .from("system_health")
        .select("component, status, checked_at, metric_value, threshold_value")
        .order("checked_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("deployment_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const poolStats = getPoolStats();
    const cacheStats = getStats();
    const activeJobs = getActiveJobCount();
    const handlers = listHandlers();

    return res.status(200).json({
      success: true,
      data: {
        database: {
          reachable: dbHealth.data?.reachable,
          responseTime: dbHealth.data?.responseTime,
          pool: poolStats,
        },
        systemHealth: systemHealth.data || [],
        recentDeployments: deploymentResult.data || [],
        cache: {
          memoryItems: cacheStats.memory.size,
          activeLocks: cacheStats.locks.active,
        },
        jobs: {
          active: activeJobs,
          handlers: handlers.length,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

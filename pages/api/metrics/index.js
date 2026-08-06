// API — Metrics endpoint
// Exposes metrics in Prometheus format for scraping

import {
  getEndpointMetrics,
  getPoolStats,
} from "../../../lib/performance/index.js";
import { getStats } from "../../../lib/cache/index.js";
import { formatMetricsForExport } from "../../../lib/observability/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const format = req.query.format || "prometheus";
    const endpoints = getEndpointMetrics();
    const poolStats = getPoolStats();
    const cacheStats = getStats();

    // Build metrics array
    const metrics = [
      // Connection pool metrics
      {
        name: "fundora_db_pool_active",
        help: "Active database connections",
        type: "gauge",
        value: poolStats.active,
      },
      {
        name: "fundora_db_pool_idle",
        help: "Idle database connections",
        type: "gauge",
        value: poolStats.idle,
      },
      {
        name: "fundora_db_pool_waiting",
        help: "Waiting database connections",
        type: "gauge",
        value: poolStats.waiting,
      },
      {
        name: "fundora_db_pool_acquired_total",
        help: "Total connections acquired",
        type: "counter",
        value: poolStats.acquired,
      },
      {
        name: "fundora_db_pool_timed_out_total",
        help: "Total connection timeouts",
        type: "counter",
        value: poolStats.timedOut,
      },
      // Cache metrics
      {
        name: "fundora_cache_items",
        help: "Number of cached items",
        type: "gauge",
        value: cacheStats.memory.size,
      },
      {
        name: "fundora_cache_locks_active",
        help: "Active distributed locks",
        type: "gauge",
        value: cacheStats.locks.active,
      },
      // Endpoint metrics
      ...endpoints.map((ep) => ({
        name: "fundora_endpoint_requests_total",
        help: "Total requests per endpoint",
        type: "counter",
        value: ep.count,
        labels: { method: ep.method, path: ep.path },
      })),
      ...endpoints.map((ep) => ({
        name: "fundora_endpoint_duration_ms",
        help: "Average endpoint duration in ms",
        type: "gauge",
        value: ep.avgDuration,
        labels: { method: ep.method, path: ep.path },
      })),
      // System metrics
      {
        name: "fundora_memory_heap_bytes",
        help: "Heap memory usage in bytes",
        type: "gauge",
        value: process.memoryUsage().heapUsed,
      },
      {
        name: "fundora_memory_rss_bytes",
        help: "RSS memory in bytes",
        type: "gauge",
        value: process.memoryUsage().rss,
      },
      {
        name: "fundora_uptime_seconds",
        help: "Application uptime in seconds",
        type: "counter",
        value: Math.floor(process.uptime()),
      },
    ];

    const output = formatMetricsForExport(metrics, format);

    if (format === "prometheus") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    } else {
      res.setHeader("Content-Type", "application/json");
    }

    return res.status(200).send(output);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

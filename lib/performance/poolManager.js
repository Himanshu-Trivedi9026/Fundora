// Pool Manager — connection pooling and database optimization
// Manages database connection pools, query optimization, and API performance metrics

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logWarn, logError } from "../verification/secureLogger.js";
import { recordMetric } from "../analytics/index.js";

const _poolMetrics = {
  active: 0,
  idle: 0,
  waiting: 0,
  max: 100,
  acquired: 0,
  released: 0,
  timedOut: 0,
};

// ——————————————————————————————————————
// Connection Pool Management
// ——————————————————————————————————————

export function configurePool(options = {}) {
  _poolMetrics.max = options.maxConnections || 100;
  _poolMetrics.idleTimeout = options.idleTimeout || 30000;
  _poolMetrics.acquireTimeout = options.acquireTimeout || 10000;
  return { success: true, data: { ..._poolMetrics } };
}

export function acquireConnection() {
  if (_poolMetrics.active >= _poolMetrics.max) {
    _poolMetrics.waiting++;
    _poolMetrics.timedOut++;
    return { success: false, error: "Connection pool exhausted" };
  }

  _poolMetrics.active++;
  _poolMetrics.acquired++;
  return { success: true, data: { poolActive: _poolMetrics.active } };
}

export function releaseConnection() {
  _poolMetrics.active = Math.max(0, _poolMetrics.active - 1);
  _poolMetrics.released++;
  return { success: true };
}

export function getPoolStats() {
  return { ..._poolMetrics };
}

export function resetPoolMetrics() {
  _poolMetrics.active = 0;
  _poolMetrics.idle = 0;
  _poolMetrics.waiting = 0;
  _poolMetrics.acquired = 0;
  _poolMetrics.released = 0;
  _poolMetrics.timedOut = 0;
  return { success: true };
}

// ——————————————————————————————————————
// Query Optimization
// ——————————————————————————————————————

const _queryCache = new Map();
let _slowQueryThreshold = 500; // ms

export async function trackQuery(name, queryFn) {
  const start = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    // Track slow queries
    if (duration > _slowQueryThreshold) {
      logWarn("Slow query detected", {
        queryName: name,
        duration,
        threshold: _slowQueryThreshold,
      });
    }

    // Record metric
    await recordMetric(`query.${name}`, duration, {
      labels: { type: "database" },
    });

    return result;
  } catch (err) {
    const duration = Date.now() - start;
    logError("Query failed", { queryName: name, duration, error: err.message });
    throw err;
  }
}

export function setSlowQueryThreshold(ms) {
  _slowQueryThreshold = ms;
}

// ——————————————————————————————————————
// API Performance Metrics
// ——————————————————————————————————————

const _endpointMetrics = new Map();

export function trackEndpoint(method, path, statusCode, durationMs) {
  const key = `${method}:${path}`;
  const existing = _endpointMetrics.get(key) || {
    method,
    path,
    count: 0,
    totalDuration: 0,
    maxDuration: 0,
    minDuration: Infinity,
    statusCodes: {},
    lastCalled: null,
  };

  existing.count++;
  existing.totalDuration += durationMs;
  existing.maxDuration = Math.max(existing.maxDuration, durationMs);
  existing.minDuration = Math.min(existing.minDuration, durationMs);
  existing.statusCodes[statusCode] =
    (existing.statusCodes[statusCode] || 0) + 1;
  existing.lastCalled = new Date().toISOString();

  _endpointMetrics.set(key, existing);
}

export function getEndpointMetrics() {
  return Array.from(_endpointMetrics.values()).map((m) => ({
    ...m,
    avgDuration: m.count > 0 ? Math.round(m.totalDuration / m.count) : 0,
    minDuration: m.minDuration === Infinity ? 0 : m.minDuration,
  }));
}

export function resetEndpointMetrics() {
  _endpointMetrics.clear();
}

// ——————————————————————————————————————
// Database Health Check
// ——————————————————————————————————————

export async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    const { data, error } = await supabaseAdmin
      .from("system_health")
      .select("component, status, checked_at")
      .order("checked_at", { ascending: false })
      .limit(1);

    const duration = Date.now() - start;

    return {
      success: true,
      data: {
        reachable: !error,
        responseTime: duration,
        lastCheck: data?.[0]?.checked_at || null,
        error: error?.message || null,
        connectionPool: getPoolStats(),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Connection Pool Metrics Persistence
// ——————————————————————————————————————

export async function persistPoolMetrics() {
  try {
    const stats = getPoolStats();
    const { error } = await supabaseAdmin
      .from("connection_pool_metrics")
      .insert({
        pool_name: "default",
        active_connections: stats.active,
        idle_connections: stats.idle,
        waiting_connections: stats.waiting,
        max_connections: stats.max,
        acquired_count: stats.acquired,
        released_count: stats.released,
        timed_out_count: stats.timedOut,
      });

    if (error)
      logError("Failed to persist pool metrics", { error: error.message });
    return { success: !error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

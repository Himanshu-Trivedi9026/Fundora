import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

const StatCard = ({ label, value, sub }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-lg font-semibold text-white mt-1">{value ?? "—"}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

export default function PerformanceMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/diagnostics");
      const json = await res.json();
      if (json.success) setMetrics(json.data);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchMetrics());
    const interval = setInterval(() => {
      fetchMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-800 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const {
    uptime,
    node,
    platform,
    memory,
    database,
    cache,
    jobs,
    endpoints,
  } = metrics || {};

  return (
    <div className="space-y-6">
      {/* System Info */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">System Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Uptime" value={uptime ? `${Math.floor(uptime / 60)}m` : "—"} />
          <StatCard label="Node.js" value={node} />
          <StatCard label="Platform" value={platform} />
          <StatCard label="Environment" value={metrics?.environment} />
        </div>
      </div>

      {/* Memory */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Memory Usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Heap Used" value={memory?.heapUsed} />
          <StatCard label="Heap Total" value={memory?.heapTotal} />
          <StatCard label="RSS" value={memory?.rss} />
          <StatCard label="External" value={memory?.external} />
        </div>
      </div>

      {/* Database & Cache */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Database & Cache</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="DB Status" value={database?.status} />
          <StatCard
            label="DB Response"
            value={database?.responseTimeMs ? `${database.responseTimeMs}ms` : "—"}
            sub={database?.lastCheck ? new Date(database.lastCheck).toLocaleString() : ""}
          />
          <StatCard label="Cache Items" value={cache?.memoryItems ?? 0} />
          <StatCard label="Active Locks" value={cache?.activeLocks ?? 0} />
          <StatCard label="Active Jobs" value={jobs?.active ?? 0} />
          <StatCard label="Tracked Endpoints" value={endpoints?.tracked ?? 0} />
        </div>
      </div>

      {/* Pool Stats */}
      {database?.pool && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Connection Pool</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Active" value={database.pool.active} />
            <StatCard label="Idle" value={database.pool.idle} />
            <StatCard label="Waiting" value={database.pool.waiting} />
            <StatCard label="Acquired" value={database.pool.acquired} />
            <StatCard label="Timeouts" value={database.pool.timedOut} />
          </div>
        </div>
      )}

      {/* Endpoint Metrics */}
      {endpoints?.details && endpoints.details.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Endpoint Metrics (Top 20)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2">Endpoint</th>
                  <th className="text-right py-2">Count</th>
                  <th className="text-right py-2">Avg (ms)</th>
                  <th className="text-right py-2">Max (ms)</th>
                  <th className="text-right py-2">Min (ms)</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.details.map((ep, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-300">{ep.method} {ep.path}</td>
                    <td className="py-2 text-right text-gray-400">{ep.count}</td>
                    <td className="py-2 text-right text-gray-400">{ep.avgDuration}</td>
                    <td className="py-2 text-right text-gray-400">{ep.maxDuration}</td>
                    <td className="py-2 text-right text-gray-400">{ep.minDuration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

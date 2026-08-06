import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

const MetricCard = ({ label, value, status }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
    <p className="text-sm text-gray-400">{label}</p>
    <p
      className={`text-2xl font-bold mt-1 ${status === "ok" ? "text-green-400" : status === "warn" ? "text-yellow-400" : "text-blue-400"}`}
    >
      {value}
    </p>
  </div>
);

export default function SystemHealthPanel() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/infrastructure/health");
      const json = await res.json();
      if (json.success) setHealthData(json.data);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchHealth());
    const interval = setInterval(() => {
      fetchHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <p className="text-red-400">Failed to load health data: {error}</p>
        <button
          onClick={fetchHealth}
          className="mt-2 text-sm text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const { database, systemHealth, recentDeployments, cache, jobs } =
    healthData || {};

  return (
    <div className="space-y-6">
      {/* Database Status */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">
          Database Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Reachable"
            value={database?.reachable ? "Connected" : "Disconnected"}
            status={database?.reachable ? "ok" : "warn"}
          />
          <MetricCard
            label="Response Time"
            value={
              database?.responseTime ? `${database.responseTime}ms` : "N/A"
            }
            status={database?.responseTime < 200 ? "ok" : "warn"}
          />
          <MetricCard
            label="Active Connections"
            value={database?.pool?.active ?? 0}
          />
          <MetricCard
            label="Pool Size"
            value={`${database?.pool?.active ?? 0}/${database?.pool?.max ?? 100}`}
          />
        </div>
      </div>

      {/* Cache Status */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Cache Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard label="Cached Items" value={cache?.memoryItems ?? 0} />
          <MetricCard label="Active Locks" value={cache?.activeLocks ?? 0} />
          <MetricCard label="Active Jobs" value={jobs?.active ?? 0} />
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Handlers registered: {jobs?.handlers ?? 0}
        </p>
      </div>

      {/* System Health Checks */}
      {systemHealth && systemHealth.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">
            Component Health
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2">Component</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Value</th>
                  <th className="text-left py-2">Threshold</th>
                  <th className="text-left py-2">Last Check</th>
                </tr>
              </thead>
              <tbody>
                {systemHealth.slice(0, 10).map((check, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-300">{check.component}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${check.status === "healthy" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}
                      >
                        {check.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">
                      {check.metric_value ?? "—"}
                    </td>
                    <td className="py-2 text-gray-400">
                      {check.threshold_value ?? "—"}
                    </td>
                    <td className="py-2 text-gray-400">
                      {check.checked_at
                        ? new Date(check.checked_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Deployments */}
      {recentDeployments && recentDeployments.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">
            Recent Deployments
          </h3>
          <div className="space-y-3">
            {recentDeployments.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {dep.version}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dep.environment} · {dep.branch}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${dep.status === "deployed" || dep.status === "healthy" ? "bg-green-900/50 text-green-400" : dep.status === "deploying" ? "bg-blue-900/50 text-blue-400" : dep.status === "failed" ? "bg-red-900/50 text-red-400" : "bg-gray-800 text-gray-400"}`}
                  >
                    {dep.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(dep.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

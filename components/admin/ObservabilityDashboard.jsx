// ObservabilityDashboard — platform monitoring, health, alerts, and metrics
import { useState, useEffect } from "react";
import { authFetch } from "../../lib/authFetch";

export default function ObservabilityDashboard() {
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("health");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [healthRes, alertsRes, metricsRes] = await Promise.all([
        authFetch("/api/observability/health"),
        authFetch("/api/observability/alerts?limit=20"),
        authFetch("/api/observability/metrics?dashboard=true"),
      ]);

      const healthData = await healthRes.json();
      const alertsData = await alertsRes.json();
      const metricsData = await metricsRes.json();

      if (healthData.success) setHealth(healthData.data);
      if (alertsData.success) setAlerts(alertsData.data || []);
      if (metricsData.success) setMetrics(metricsData.data || {});
    } catch (err) {
      console.error("Failed to fetch observability data", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "health", label: "Health" },
    { id: "alerts", label: "Alerts" },
    { id: "metrics", label: "Metrics" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={fetchAll}
          className="ml-auto px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-400 hover:bg-gray-700"
        >
          Refresh
        </button>
      </div>

      {/* Health tab */}
      {tab === "health" && (
        <div className="space-y-4">
          {health ? (
            <>
              <div
                className={`p-4 rounded-xl border ${
                  health.healthy
                    ? "bg-green-900/20 border-green-800"
                    : "bg-red-900/20 border-red-800"
                }`}
              >
                <p className="text-lg font-bold text-white">
                  System Status:{" "}
                  {health.healthy
                    ? "✅ All Systems Operational"
                    : "⚠️ Issues Detected"}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {health.healthyCount || 0}/{health.totalComponents || 0}{" "}
                  components healthy
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(health.checks || health.data
                  ? Object.entries(health.data)
                  : []
                ).map(([component, status]) => (
                  <div
                    key={component}
                    className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium capitalize">
                        {component}
                      </p>
                      <p className="text-xs text-gray-500">
                        {status.latencyMs ? `${status.latencyMs}ms` : ""}
                        {status.lastChecked
                          ? ` · ${new Date(status.lastChecked).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        status.status === "healthy" ||
                        status.status === "healthy"
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {status.status || "unknown"}
                    </span>
                  </div>
                )) || (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    No health data available
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No health data available
            </div>
          )}
        </div>
      )}

      {/* Alerts tab */}
      {tab === "alerts" && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No active alerts
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {alerts.map((alert, i) => (
                <div
                  key={alert.id || i}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-medium">{alert.alert_name}</p>
                    <p className="text-sm text-gray-400">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.severity === "critical"
                          ? "bg-red-900/50 text-red-400"
                          : alert.severity === "warning"
                            ? "bg-yellow-900/50 text-yellow-400"
                            : "bg-blue-900/50 text-blue-400"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {alert.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metrics tab */}
      {tab === "metrics" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(metrics).length === 0 ? (
            <div className="col-span-3 text-center py-8 text-gray-500">
              No metrics data available
            </div>
          ) : (
            Object.entries(metrics).map(([name, stats]) => (
              <div
                key={name}
                className="bg-gray-900/60 border border-gray-800 rounded-xl p-4"
              >
                <p className="text-gray-400 text-sm mb-1">{name}</p>
                <p className="text-2xl font-bold text-white">
                  {stats.last?.toLocaleString() || "—"}
                </p>
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>Avg: {stats.avg?.toFixed(1) || "—"}</span>
                  <span>Total: {stats.total || "—"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

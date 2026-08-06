// GlobalAnalyticsDashboard — platform-wide analytics overview
import { useState, useEffect } from "react";
import { authFetch } from "../../lib/authFetch";

export default function GlobalAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const [metricsRes, alertsRes, backupRes] = await Promise.all([
          authFetch("/api/observability/metrics?dashboard=true"),
          authFetch("/api/observability/alerts?stats=true"),
          authFetch("/api/backup/backups?stats=true"),
        ]);

        const metrics = await metricsRes.json();
        const alerts = await alertsRes.json();
        const backups = await backupRes.json();

        setAnalytics({ metrics: metrics.data, alerts: alerts.data, backups: backups.data });
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: "Active Metrics", value: analytics?.metrics ? Object.keys(analytics.metrics).length : 0, color: "text-blue-400" },
    { label: "Total Alerts", value: analytics?.alerts?.total || 0, color: "text-yellow-400" },
    { label: "Total Backups", value: analytics?.backups?.total || 0, color: "text-green-400" },
    { label: "Backup Size", value: analytics?.backups?.totalSizeBytes ? `${(analytics.backups.totalSizeBytes / 1048576).toFixed(1)} MB` : "0 MB", color: "text-purple-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Key stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Alert breakdown */}
      {analytics?.alerts?.byStatus && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Alert Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(analytics.alerts.byStatus).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-gray-800/50 rounded-lg">
                <p className={`text-lg font-bold ${
                  status === "active" ? "text-red-400" :
                  status === "acknowledged" ? "text-yellow-400" :
                  status === "resolved" ? "text-green-400" : "text-gray-400"
                }`}>{count}</p>
                <p className="text-xs text-gray-500 capitalize">{status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics summary */}
      {analytics?.metrics && Object.keys(analytics.metrics).length > 0 && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Metrics Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.metrics).slice(0, 12).map(([name, stats]) => (
              <div key={name} className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1 truncate">{name}</p>
                <p className="text-white font-medium">{stats.last?.toLocaleString() || "—"}</p>
                <p className="text-gray-500 text-xs mt-1">Total: {stats.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backup stats */}
      {analytics?.backups?.byStatus && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Backup Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(analytics.backups.byStatus).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-gray-800/50 rounded-lg">
                <p className={`text-lg font-bold capitalize ${
                  status === "completed" ? "text-green-400" :
                  status === "running" ? "text-blue-400" :
                  status === "failed" ? "text-red-400" : "text-gray-400"
                }`}>{count}</p>
                <p className="text-xs text-gray-500 capitalize">{status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

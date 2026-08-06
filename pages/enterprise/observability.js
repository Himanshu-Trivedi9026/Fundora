import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function ObservabilityPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("24h");

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ dashboard: "true" });
        if (timeRange) params.set("since", timeRange);
        const res = await authFetch(`/api/observability/metrics?${params.toString()}`);
        const json = await res.json();
        setMetrics(json.data || json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [timeRange]);

  const extractMetric = (metricName) => {
    if (!metrics) return null;
    if (Array.isArray(metrics)) {
      return metrics.find((m) => m.name === metricName || m.metricName === metricName);
    }
    return metrics[metricName] || null;
  };

  const summaryMetrics = [
    {
      key: "api_calls",
      label: "Total API Calls",
      icon: "api",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "error_rate",
      label: "Error Rate",
      icon: "warning",
      color: "text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      key: "response_time",
      label: "Avg Response Time",
      icon: "timer",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      suffix: "ms",
    },
    {
      key: "active_users",
      label: "Active Users",
      icon: "people",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
  ];

  const formatValue = (value, suffix) => {
    if (value === undefined || value === null) return "--";
    if (typeof value === "number") {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toLocaleString();
    }
    return `${value}${suffix || ""}`;
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Observability Dashboard</h1>
              <p className="text-gray-400 mt-1">System metrics, error rates, and performance monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              {["1h", "6h", "24h", "7d", "30d"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                    timeRange === range
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
                    <div className="h-4 bg-white/[0.06] rounded w-20" />
                  </div>
                  <div className="h-8 bg-white/[0.06] rounded w-16" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load metrics</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && !metrics && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">monitoring</span>
              <p className="text-gray-400 text-lg font-medium">No metrics available</p>
              <p className="text-gray-600 text-sm mt-1">System metrics will appear here once data is collected.</p>
            </GlassCard>
          )}

          {!loading && !error && metrics && (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {summaryMetrics.map((metric) => {
                  const data = extractMetric(metric.key);
                  const value = data?.value ?? data?.count ?? data?.avg ?? null;
                  return (
                    <GlassCard key={metric.key}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                          <span className={`material-symbols-outlined text-xl ${metric.color}`}>{metric.icon}</span>
                        </div>
                        <p className="text-gray-400 text-xs font-medium">{metric.label}</p>
                      </div>
                      <p className={`text-2xl font-bold text-white ${!value ? "opacity-40" : ""}`}>
                        {formatValue(value, metric.suffix)}
                      </p>
                      {data?.change !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            className={`text-[11px] ${
                              data.change >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {data.change >= 0 ? "+" : ""}
                            {data.change}%
                          </span>
                          <span className="text-gray-600 text-[11px]">vs previous period</span>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>

              {/* Detailed Metrics */}
              <h2 className="text-white font-semibold text-sm mb-4">Detailed Metrics</h2>
              <div className="space-y-3">
                {Array.isArray(metrics) ? (
                  metrics.slice(0, 10).map((m, idx) => (
                    <GlassCard key={m.name || idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-gray-400">analytics</span>
                        <div>
                          <h3 className="text-white text-sm">{m.name || m.metricName}</h3>
                          {m.source && <p className="text-gray-600 text-[11px]">Source: {m.source}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">
                          {m.value !== undefined ? formatValue(m.value) : m.count || "--"}
                        </p>
                        {m.timestamp && (
                          <p className="text-gray-600 text-[11px]">
                            {new Date(m.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </GlassCard>
                  ))
                ) : (
                  <GlassCard>
                    <pre className="text-gray-400 text-xs overflow-auto max-h-96">
                      {JSON.stringify(metrics, null, 2)}
                    </pre>
                  </GlassCard>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
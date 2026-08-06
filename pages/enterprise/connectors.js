import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

const PROVIDER_ICONS = {
  slack: "forum",
  github: "code",
  discord: "diversity_3",
  jira: "assignment",
  gitlab: "merge",
  webhook: "webhook",
  stripe: "payments",
  notion: "description",
  default: "link",
};

export default function ConnectorsPage() {
  const [loading, setLoading] = useState(true);
  const [connectors, setConnectors] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/connectors");
        const json = await res.json();
        const items = json.data || [];
        setConnectors(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleConnection = async (id, currentStatus) => {
    const action = currentStatus === "connected" ? "disconnect" : "connect";
    try {
      const res = await authFetch(`/api/connectors?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: action === "connect" ? "connected" : "disconnected" }
              : c
          )
        );
      }
    } catch {
      // silently fail
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Enterprise Connectors</h1>
              <p className="text-gray-400 mt-1">Connect your tools and services</p>
            </div>
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Connector
            </Button>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
                    <div className="h-4 bg-white/[0.06] rounded w-24" />
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load connectors</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && connectors.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">api</span>
              <p className="text-gray-400 text-lg font-medium">No connectors configured</p>
              <p className="text-gray-600 text-sm mt-1">Connect Slack, GitHub, Discord and more to extend your workflow.</p>
            </GlassCard>
          )}

          {!loading && !error && connectors.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectors.map((conn) => (
                <GlassCard key={conn.id} hover className="flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl text-indigo-400">
                          {PROVIDER_ICONS[conn.provider?.toLowerCase()] || PROVIDER_ICONS.default}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm capitalize">{conn.name || conn.provider}</h3>
                        {conn.provider && (
                          <span className="text-[11px] text-gray-500 capitalize">{conn.provider}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        conn.status === "connected"
                          ? "bg-green-500/10 text-green-400"
                          : conn.status === "connecting"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {conn.status || "disconnected"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mb-4 flex-1">
                    {conn.description || `Connect to ${conn.provider || conn.name} services`}
                  </p>
                  <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                    {conn.status !== "connected" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => toggleConnection(conn.id, conn.status)}
                      >
                        Connect
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => toggleConnection(conn.id, conn.status)}
                      >
                        Disconnect
                      </Button>
                    )}
                    <Button variant="ghost" size="icon">
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
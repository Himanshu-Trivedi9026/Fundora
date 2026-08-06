import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function PluginsPage() {
  const [loading, setLoading] = useState(true);
  const [plugins, setPlugins] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/plugins/list");
        const json = await res.json();
        const items = json.data || [];
        setPlugins(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const togglePlugin = async (id, currentEnabled) => {
    const newStatus = currentEnabled ? "disabled" : "active";
    try {
      const res = await authFetch(`/api/plugins/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setPlugins((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, enabled: !currentEnabled, status: newStatus }
              : p,
          ),
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
              <h1 className="text-2xl font-bold text-white">
                Plugin Management
              </h1>
              <p className="text-gray-400 mt-1">
                Manage installed plugins and their settings
              </p>
            </div>
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Install Plugin
            </Button>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
                    <div className="h-4 bg-white/[0.06] rounded w-20" />
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">
                error_outline
              </span>
              <p className="text-red-400 text-lg font-medium">
                Failed to load plugins
              </p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && plugins.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">
                extension
              </span>
              <p className="text-gray-400 text-lg font-medium">
                No plugins installed
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Install plugins from the marketplace to extend functionality.
              </p>
            </GlassCard>
          )}

          {!loading && !error && plugins.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plugins.map((plugin) => (
                <GlassCard key={plugin.id} hover className="flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl text-indigo-400">
                          {plugin.icon || "extension"}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">
                          {plugin.name}
                        </h3>
                        <span className="text-[11px] text-gray-500">
                          v{plugin.version || "1.0.0"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        plugin.enabled || plugin.status === "active"
                          ? "bg-indigo-500"
                          : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          plugin.enabled || plugin.status === "active"
                            ? "translate-x-[18px]"
                            : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs flex-1 mb-4 line-clamp-2">
                    {plugin.description || "No description available."}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        plugin.enabled || plugin.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {plugin.enabled || plugin.status === "active"
                        ? "Enabled"
                        : "Disabled"}
                    </span>
                    <Button variant="ghost" size="sm">
                      <span className="material-symbols-outlined text-[14px]">
                        settings
                      </span>
                      Settings
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

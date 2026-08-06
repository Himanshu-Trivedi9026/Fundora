import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function FeatureFlagsPage() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/flags");
        const json = await res.json();
        const items = json.data || [];
        setFlags(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFlag = async (id, currentEnabled) => {
    const newEnabled = !currentEnabled;
    try {
      const res = await authFetch(`/api/flags?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      const json = await res.json();
      if (json.success) {
        setFlags((prev) =>
          prev.map((f) => (f.id === id ? { ...f, enabled: newEnabled } : f))
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
              <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
              <p className="text-gray-400 mt-1">Toggle and manage feature availability across your platform</p>
            </div>
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Flag
            </Button>
          </div>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-white/[0.06] rounded w-1/4" />
                    <div className="h-5 w-9 bg-white/[0.06] rounded-full" />
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded w-3/4 mt-2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load feature flags</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && flags.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">flag</span>
              <p className="text-gray-400 text-lg font-medium">No feature flags configured</p>
              <p className="text-gray-600 text-sm mt-1">Create feature flags to control feature rollouts.</p>
            </GlassCard>
          )}

          {!loading && !error && flags.length > 0 && (
            <div className="space-y-4">
              {flags.map((flag) => (
                <GlassCard key={flag.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-semibold text-sm truncate">{flag.name || flag.key}</h3>
                      <span className="text-[10px] font-mono text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {flag.key}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">
                      {flag.description || "No description"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    <span
                      className={`text-[11px] font-medium ${
                        flag.enabled ? "text-green-400" : "text-gray-500"
                      }`}
                    >
                      {flag.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      onClick={() => toggleFlag(flag.id, flag.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        flag.enabled ? "bg-indigo-500" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? "translate-x-[18px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
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
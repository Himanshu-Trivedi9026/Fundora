import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function AutomationPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/automation/workflows");
        const json = await res.json();
        const items = json.data || json;
        setRules(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const res = await authFetch(`/api/automation/workflows`, {
        method: "PUT",
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
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
              <h1 className="text-2xl font-bold text-white">Automation Rules</h1>
              <p className="text-gray-400 mt-1">Manage workflow automation and triggers</p>
            </div>
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Rule
            </Button>
          </div>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="h-4 bg-white/[0.06] rounded w-1/3 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-2/3 mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load automation rules</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && rules.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">settings</span>
              <p className="text-gray-400 text-lg font-medium">No automation rules yet</p>
              <p className="text-gray-600 text-sm mt-1">Create your first rule to automate workflows.</p>
            </GlassCard>
          )}

          {!loading && !error && rules.length > 0 && (
            <div className="space-y-4">
              {rules.map((rule) => (
                <GlassCard key={rule.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-semibold text-sm truncate">{rule.name}</h3>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          rule.status === "active"
                            ? "bg-green-500/10 text-green-400"
                            : rule.status === "paused"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {rule.status || "inactive"}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">
                      {rule.description || rule.trigger || "No description"}
                    </p>
                    {rule.trigger && (
                      <p className="text-gray-600 text-[11px] mt-1">
                        Trigger: <span className="text-gray-400">{rule.trigger}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(rule.id, rule.status)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.status === "active" ? "bg-indigo-500" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.status === "active" ? "translate-x-[18px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <span className="material-symbols-outlined text-gray-600 text-[18px] cursor-pointer hover:text-gray-400">
                      more_vert
                    </span>
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
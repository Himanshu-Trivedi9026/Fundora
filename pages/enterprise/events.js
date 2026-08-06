import { useState, useEffect, useCallback } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

const EVENT_TYPES = [
  "",
  "payment",
  "project",
  "user",
  "auth",
  "notification",
  "webhook",
  "system",
  "error",
];

export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");

  const fetchEvents = useCallback(async (type) => {
    queueMicrotask(() => setLoading(true));
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (type) params.set("eventType", type);
      const res = await authFetch(`/api/events?${params.toString()}`);
      const json = await res.json();
      const items = json.data || [];
      setEvents(Array.isArray(items) ? items : []);
    } catch (e) {
      setError(e.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchEvents(filterType));
  }, [fetchEvents, filterType]);

  const handleFilterChange = (type) => {
    setFilterType(type);
    fetchEvents(type);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "--";
    const d = new Date(ts);
    return d.toLocaleString();
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Event Bus</h1>
              <p className="text-gray-400 mt-1">Event history and system activity stream</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => fetchEvents(filterType)}>
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refresh
            </Button>
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  filterType === type
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08]"
                }`}
              >
                {type || "All Events"}
              </button>
            ))}
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-card p-4 animate-pulse flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
                  <div className="flex-1">
                    <div className="h-3 bg-white/[0.06] rounded w-1/4 mb-2" />
                    <div className="h-2 bg-white/[0.04] rounded w-1/2" />
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded w-24" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load events</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => fetchEvents(filterType)}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && events.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">timeline</span>
              <p className="text-gray-400 text-lg font-medium">No events found</p>
              <p className="text-gray-600 text-sm mt-1">
                {filterType
                  ? `No events of type "${filterType}" recorded yet.`
                  : "No events have been recorded yet."}
              </p>
            </GlassCard>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="space-y-2">
              {events.map((evt, idx) => (
                <GlassCard key={evt.id || idx} padding="sm" className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      evt.status === "error"
                        ? "bg-red-500/10"
                        : evt.status === "completed" || evt.status === "success"
                        ? "bg-green-500/10"
                        : "bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        evt.status === "error"
                          ? "text-red-400"
                          : evt.status === "completed" || evt.status === "success"
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {evt.status === "error"
                        ? "error"
                        : evt.status === "completed" || evt.status === "success"
                        ? "check_circle"
                        : "circle"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-medium capitalize">{evt.eventType || evt.type || "unknown"}</span>
                      {evt.source && (
                        <span className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {evt.source}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-[11px] truncate mt-0.5">
                      {evt.payload
                        ? typeof evt.payload === "string"
                          ? evt.payload
                          : JSON.stringify(evt.payload).slice(0, 100)
                        : evt.description || ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-500 text-[11px]">{formatTimestamp(evt.timestamp || evt.createdAt)}</p>
                    <span
                      className={`text-[10px] font-medium ${
                        evt.status === "error"
                          ? "text-red-400"
                          : evt.status === "completed" || evt.status === "success"
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {evt.status || "pending"}
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
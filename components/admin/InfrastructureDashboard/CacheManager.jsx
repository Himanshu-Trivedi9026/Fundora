import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState("");

  const fetchStats = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/infrastructure/cache");
      const json = await res.json();
      if (json.success) setCacheStats(json.data);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchStats());
  }, [fetchStats]);

  const handleAction = async (action) => {
    setActionMsg("");
    try {
      const res = await authFetch("/api/infrastructure/cache", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMsg(`${action} completed`);
        fetchStats();
      } else {
        setActionMsg(`${action} failed: ${json.error}`);
      }
    } catch (err) {
      setActionMsg(err.message);
    }
    setTimeout(() => setActionMsg(""), 3000);
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-16 bg-gray-800 rounded" />
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

  const { memory, locks, rateLimiters } = cacheStats || {};

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Cache Manager</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("cleanup")}
              className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700"
            >
              Cleanup Expired
            </button>
            <button
              onClick={() => handleAction("clear")}
              className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50"
            >
              Clear All
            </button>
          </div>
        </div>
        {actionMsg && (
          <p className="text-sm text-indigo-400 mt-2">{actionMsg}</p>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Memory Cache */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Memory Cache</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Items</span>
                <span className="text-sm font-medium text-white">{memory?.size ?? 0}</span>
              </div>
              {memory?.keys && memory.keys.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-1">Keys:</p>
                  {memory.keys.slice(0, 10).map((key) => (
                    <p key={key} className="text-xs text-gray-400 truncate">{key}</p>
                  ))}
                  {memory.keys.length > 10 && (
                    <p className="text-xs text-gray-600">+{memory.keys.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Locks */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Distributed Locks</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Active Locks</span>
                <span className="text-sm font-medium text-white">{locks?.active ?? 0}</span>
              </div>
              {locks?.active === 0 && (
                <p className="text-xs text-gray-500">No active locks</p>
              )}
            </div>
          </div>

          {/* Rate Limiters */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Rate Limiters</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Active Limiters</span>
                <span className="text-sm font-medium text-white">{rateLimiters?.active ?? 0}</span>
              </div>
              {rateLimiters?.active === 0 && (
                <p className="text-xs text-gray-500">No active rate limiters</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

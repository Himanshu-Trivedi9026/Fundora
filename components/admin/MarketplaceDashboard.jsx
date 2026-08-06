// MarketplaceDashboard — admin panel for marketplace management
import { useState, useEffect } from "react";
import { authFetch } from "../../lib/authFetch";

export default function MarketplaceDashboard() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchPlugins() {
      try {
        const res = await authFetch("/api/marketplace/list?limit=50");
        const data = await res.json();
        if (data.success) setPlugins(data.data.data || []);
      } catch (err) {
        console.error("Failed to fetch marketplace plugins", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlugins();
  }, []);

  const filtered = filter === "all" ? plugins : plugins.filter((p) => p.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Plugins</p>
          <p className="text-2xl font-bold text-white">{plugins.length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Published</p>
          <p className="text-2xl font-bold text-green-400">{plugins.filter((p) => p.status === "published").length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-400">{plugins.filter((p) => p.status === "pending_review").length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Downloads</p>
          <p className="text-2xl font-bold text-blue-400">{plugins.reduce((s, p) => s + (p.downloads || 0), 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "published", "pending_review", "draft", "disabled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-sm ${
              filter === f
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f === "pending_review" ? "Pending" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Plugin list */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400 text-sm">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Rating</th>
                <th className="p-4 font-medium">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No plugins found
                  </td>
                </tr>
              ) : (
                filtered.map((plugin, i) => (
                  <tr key={plugin.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-white font-medium">{plugin.name || "Unnamed Plugin"}</td>
                    <td className="p-4 text-gray-400">{plugin.category || "Uncategorized"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        plugin.status === "published" ? "bg-green-900/50 text-green-400" :
                        plugin.status === "pending_review" ? "bg-yellow-900/50 text-yellow-400" :
                        plugin.status === "disabled" ? "bg-red-900/50 text-red-400" :
                        "bg-gray-700 text-gray-400"
                      }`}>
                        {plugin.status || "unknown"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{plugin.avgRating ? `${plugin.avgRating.toFixed(1)} ⭐` : "N/A"}</td>
                    <td className="p-4 text-gray-400">{(plugin.downloads || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// PluginManager — admin panel for installed plugin management
import { useState, useEffect } from "react";
import { authFetch } from "../../lib/authFetch";

export default function PluginManager() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlugins() {
      try {
        const res = await authFetch("/api/plugins/list");
        const data = await res.json();
        if (data.success) setPlugins(data.data || []);
      } catch (err) {
        console.error("Failed to fetch plugins", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlugins();
  }, []);

  const handleAction = async (pluginId, action) => {
    try {
      const res = await authFetch(`/api/plugins/${action}`, {
        method: "POST",
        body: JSON.stringify({ pluginId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlugins((prev) =>
          prev.map((p) =>
            p.id === pluginId
              ? { ...p, status: action === "enable" ? "active" : "inactive" }
              : p,
          ),
        );
      }
    } catch (err) {
      console.error(`Failed to ${action} plugin`, err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Installed</p>
          <p className="text-2xl font-bold text-white">{plugins.length}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-400">
            {plugins.filter((p) => p.status === "active").length}
          </p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Inactive</p>
          <p className="text-2xl font-bold text-gray-400">
            {plugins.filter((p) => p.status !== "active").length}
          </p>
        </div>
      </div>

      {/* Plugin cards */}
      {plugins.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-lg">No plugins installed yet</p>
          <p className="text-gray-600 text-sm mt-2">
            Plugins will appear here once installed from the marketplace
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((plugin, i) => (
            <div
              key={plugin.id || i}
              className="bg-gray-900/60 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">
                    {plugin.name || "Unnamed Plugin"}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {plugin.description || "No description"}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    plugin.status === "active"
                      ? "bg-green-900/50 text-green-400"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {plugin.status || "unknown"}
                </span>
              </div>
              {plugin.permissions && plugin.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {plugin.permissions.map((perm, j) => (
                    <span
                      key={j}
                      className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleAction(
                      plugin.id,
                      plugin.status === "active" ? "disable" : "enable",
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    plugin.status === "active"
                      ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                      : "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                  }`}
                >
                  {plugin.status === "active" ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => handleAction(plugin.id, "uninstall")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

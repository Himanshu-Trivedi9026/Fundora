// Admin — Enterprise Connector Status
// Shows connected/disconnected status for all enterprise integrations

import React, { useState, useEffect } from "react";
import { authFetch } from "../../../lib/authFetch";

const PROVIDER_ICONS = {
  slack: "💬",
  teams: "📋",
  discord: "🎮",
  google_workspace: "📧",
  github: "🐙",
  jira: "📊",
  notion: "📝",
};

const STATUS_STYLES = {
  connected: "bg-green-500/20 text-green-400 border-green-500/30",
  disconnected: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  connecting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function ConnectorStatus() {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    fetchConnectors();
  }, []);

  async function fetchConnectors() {
    setLoading(true);
    try {
      const res = await authFetch("/api/connectors");
      const json = await res.json();
      if (json.success) setConnectors(json.data || []);
    } catch (err) {
      console.error("Failed to fetch connectors:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(id, action) {
    setConnecting(id);
    try {
      const res = await authFetch(`/api/connectors?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) await fetchConnectors();
    } catch (err) {
      console.error("Connector action failed:", err);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Enterprise Connectors</h2>
        <button
          onClick={fetchConnectors}
          className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : connectors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No connectors configured</p>
          <p className="text-gray-600 text-sm">
            Configure connectors to integrate with external services
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((connector) => (
            <div
              key={connector.id}
              className="bg-gray-900 rounded-xl p-4 border border-gray-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {PROVIDER_ICONS[connector.provider] || "🔌"}
                  </span>
                  <span className="text-white font-medium">
                    {connector.label || connector.provider}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLES[connector.status] || STATUS_STYLES.disconnected}`}
                >
                  {connector.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs capitalize">
                  {connector.provider?.replace("_", " ")}
                </span>
                <div className="flex gap-2">
                  {connector.status !== "connected" && (
                    <button
                      onClick={() => handleConnect(connector.id, "connect")}
                      disabled={connecting === connector.id}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs"
                    >
                      {connecting === connector.id ? "..." : "Connect"}
                    </button>
                  )}
                  {connector.status === "connected" && (
                    <button
                      onClick={() => handleConnect(connector.id, "disconnect")}
                      disabled={connecting === connector.id}
                      className="px-3 py-1 bg-red-600/50 text-red-300 rounded-lg hover:bg-red-600 disabled:opacity-50 text-xs"
                    >
                      {connecting === connector.id ? "..." : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {connector.last_error && (
                <p className="text-red-400 text-xs mt-2 truncate">
                  {connector.last_error}
                </p>
              )}
              {connector.last_connected_at && (
                <p className="text-gray-600 text-xs mt-2">
                  Last: {new Date(connector.last_connected_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

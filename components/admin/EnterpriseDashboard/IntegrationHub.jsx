// Admin — Integration Hub
// Central panel for adding and managing all enterprise integrations

import React, { useState } from "react";
import { authFetch } from "../../../lib/authFetch";

const AVAILABLE_PROVIDERS = [
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    description: "Messaging & collaboration",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    icon: "📋",
    description: "Team chat & meetings",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    description: "Community communication",
  },
  {
    id: "google_workspace",
    name: "Google Workspace",
    icon: "📧",
    description: "Docs, Drive, Gmail",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "Code & project management",
  },
  {
    id: "jira",
    name: "Jira",
    icon: "📊",
    description: "Issue & project tracking",
  },
  { id: "notion", name: "Notion", icon: "📝", description: "Knowledge & docs" },
];

export default function IntegrationHub() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(null);
  const [formData, setFormData] = useState({
    provider: "",
    label: "",
    webhookUrl: "",
    config: "",
    credentials: "",
  });

  async function handleAdd(provider) {
    setAdding(provider.id);
    try {
      const res = await authFetch("/api/connectors", {
        method: "POST",
        body: JSON.stringify({
          provider: provider.id,
          label: formData.label || provider.name,
          webhookUrl: formData.webhookUrl || undefined,
          config: formData.config ? JSON.parse(formData.config) : {},
          credentials: formData.credentials
            ? JSON.parse(formData.credentials)
            : {},
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setFormData({
          provider: "",
          label: "",
          webhookUrl: "",
          config: "",
          credentials: "",
        });
      }
    } catch (err) {
      console.error("Failed to add connector:", err);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Integration Hub</h2>
          <p className="text-gray-500 text-sm mt-1">
            Add and manage external integrations
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          + Add Integration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {AVAILABLE_PROVIDERS.map((provider) => (
          <div
            key={provider.id}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
            onClick={() => {
              setFormData({ ...formData, provider: provider.id });
              setShowAddModal(true);
            }}
          >
            <div className="text-3xl mb-3">{provider.icon}</div>
            <h3 className="text-white font-semibold mb-1">{provider.name}</h3>
            <p className="text-gray-500 text-sm">{provider.description}</p>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Integration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  <option value="">Select provider...</option>
                  {AVAILABLE_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="My integration"
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  Webhook URL (optional)
                </label>
                <input
                  type="text"
                  value={formData.webhookUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, webhookUrl: e.target.value })
                  }
                  placeholder="https://hooks.example.com/..."
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  Config (JSON, optional)
                </label>
                <textarea
                  value={formData.config}
                  onChange={(e) =>
                    setFormData({ ...formData, config: e.target.value })
                  }
                  placeholder='{"key": "value"}'
                  rows={2}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">
                  Credentials (JSON)
                </label>
                <textarea
                  value={formData.credentials}
                  onChange={(e) =>
                    setFormData({ ...formData, credentials: e.target.value })
                  }
                  placeholder='{"token": "..."}'
                  rows={2}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    provider: "",
                    label: "",
                    webhookUrl: "",
                    config: "",
                    credentials: "",
                  });
                }}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleAdd(
                    AVAILABLE_PROVIDERS.find((p) => p.id === formData.provider),
                  )
                }
                disabled={!formData.provider || adding}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add Integration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

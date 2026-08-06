// Admin — Feature Flag List
// CRUD management for all feature flags with toggle and edit capabilities

import React, { useState, useEffect } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function FlagList() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchFlags();
  }, []);

  async function fetchFlags() {
    setLoading(true);
    try {
      const res = await authFetch("/api/flags");
      const json = await res.json();
      if (json.success) setFlags(json.data || []);
    } catch (err) {
      console.error("Failed to fetch flags:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFlag(flagId, enabled) {
    try {
      const res = await authFetch(`/api/flags?id=${flagId}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (json.success) await fetchFlags();
    } catch (err) {
      console.error("Failed to toggle flag:", err);
    }
  }

  async function deleteFlag(flagId) {
    if (!confirm("Delete this feature flag?")) return;
    try {
      const res = await authFetch(`/api/flags?id=${flagId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) await fetchFlags();
    } catch (err) {
      console.error("Failed to delete flag:", err);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Feature Flags</h2>
          <p className="text-gray-500 text-sm mt-1">{flags.length} flags configured</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          + Create Flag
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No feature flags found</p>
          <p className="text-gray-600 text-sm mt-1">Create your first flag to start managing features</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={() => toggleFlag(flag.id, !flag.enabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      flag.enabled ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      flag.enabled ? "left-7" : "left-1"
                    }`} />
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-white font-mono text-sm">{flag.key}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        flag.enabled ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
                      }`}>
                        {flag.enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{flag.description || "No description"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{flag.rollout_percentage}% rollout</span>
                  <button
                    onClick={() => setEditing(editing === flag.id ? null : flag.id)}
                    className="text-gray-400 hover:text-white"
                  >
                    {editing === flag.id ? "▲" : "▼"}
                  </button>
                  <button
                    onClick={() => deleteFlag(flag.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    ×
                  </button>
                </div>
              </div>

              {editing === flag.id && (
                <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Environments</p>
                    <p className="text-white">{flag.environments?.join(", ") || "all"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Organizations</p>
                    <p className="text-white">{flag.organization_ids?.length || "all"}</p>
                  </div>
                  {flag.targeting_rules?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-gray-500">Targeting Rules</p>
                      <pre className="text-gray-300 text-xs mt-1 bg-gray-800 p-2 rounded">
                        {JSON.stringify(flag.targeting_rules, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateFlagModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchFlags(); }}
        />
      )}
    </div>
  );
}

function CreateFlagModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    enabled: true,
    rolloutPercentage: 100,
    environments: "development,staging,production",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch("/api/flags", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          environments: form.environments.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.success) onCreated();
    } catch (err) {
      console.error("Failed to create flag:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Create Feature Flag</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Key *</label>
            <input
              type="text"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="my-feature-flag"
              required
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 font-mono"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Feature Flag"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">Rollout %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.rolloutPercentage}
                onChange={(e) => setForm({ ...form, rolloutPercentage: parseInt(e.target.value) })}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">Enabled</label>
              <select
                value={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.value === "true" })}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Environments (comma separated)</label>
            <input
              type="text"
              value={form.environments}
              onChange={(e) => setForm({ ...form, environments: e.target.value })}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={!form.key || saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Creating..." : "Create Flag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

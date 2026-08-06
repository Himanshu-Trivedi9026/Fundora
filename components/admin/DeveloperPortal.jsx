// DeveloperPortal — plugin developer dashboard
import { useState, useEffect } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/authFetch";

export default function DeveloperPortal() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", version: "1.0.0" });

  useEffect(() => {
    fetchMyPlugins();
  }, []);

  async function fetchMyPlugins() {
    try {
      const res = await authFetch("/api/developer/my-plugins");
      const data = await res.json();
      if (data.success) setPlugins(data.data || []);
    } catch (err) {
      console.error("Failed to fetch plugins", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch("/api/plugins/submit", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setForm({ name: "", description: "", version: "1.0.0" });
        fetchMyPlugins();
      }
    } catch (err) {
      console.error("Failed to submit plugin", err);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Developer Portal</h1>
          <p className="text-gray-400 mt-1">Build and manage your Fundora plugins</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "New Plugin"}
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">Submit New Plugin</h3>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Version *</label>
            <input
              type="text"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              required
              pattern="^\d+\.\d+\.\d+$"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Submit Plugin
          </button>
        </form>
      )}

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-lg">No plugins yet</p>
          <p className="text-gray-600 text-sm mt-2">Create your first plugin to get started</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
            >
              Create Plugin
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((plugin, i) => (
            <div key={plugin.id || i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold">{plugin.name}</h3>
              <p className="text-gray-400 text-sm mt-1">{plugin.description}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-gray-500">v{plugin.version}</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-400">
                  {plugin.status || "pending_review"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documentation links */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3">Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/docs/PLUGIN_PLATFORM.md" className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
            <p className="text-purple-400 font-medium text-sm">Plugin Platform Docs</p>
            <p className="text-gray-500 text-xs mt-1">Learn how to build plugins</p>
          </a>
          <a href="/docs/MARKETPLACE.md" className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
            <p className="text-purple-400 font-medium text-sm">Marketplace Guide</p>
            <p className="text-gray-500 text-xs mt-1">Publish and distribute plugins</p>
          </a>
          <Link href="/api/developer/register" className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
            <p className="text-purple-400 font-medium text-sm">API Reference</p>
            <p className="text-gray-500 text-xs mt-1">Developer API documentation</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

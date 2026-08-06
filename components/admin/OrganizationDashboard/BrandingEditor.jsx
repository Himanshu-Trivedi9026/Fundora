// Admin — Branding Editor
// Edit organization branding: logo, colors, fonts

import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function BrandingEditor() {
  const [branding, setBranding] = useState({
    logo_url: "",
    primary_color: "#6366f1",
    secondary_color: "#8b5cf6",
    font_family: "Inter",
    favicon_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchBranding = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/tenants/branding");
      const json = await res.json();
      if (json.success) setBranding({ ...branding, ...json.data });
    } catch (err) {
      console.error("Failed to fetch branding:", err);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [branding]);

  useEffect(() => {
    queueMicrotask(() => fetchBranding());
  }, [fetchBranding]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/tenants/branding", {
        method: "PUT",
        body: JSON.stringify(branding),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: "Branding updated" });
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Branding</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4">Colors</h3>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Primary Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={branding.primary_color}
                  onChange={(e) =>
                    setBranding({ ...branding, primary_color: e.target.value })
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.primary_color}
                  onChange={(e) =>
                    setBranding({ ...branding, primary_color: e.target.value })
                  }
                  className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Secondary Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={branding.secondary_color}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      secondary_color: e.target.value,
                    })
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.secondary_color}
                  onChange={(e) =>
                    setBranding({
                      ...branding,
                      secondary_color: e.target.value,
                    })
                  }
                  className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4">Assets</h3>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Logo URL
              </label>
              <input
                type="text"
                value={branding.logo_url}
                onChange={(e) =>
                  setBranding({ ...branding, logo_url: e.target.value })
                }
                placeholder="https://example.com/logo.png"
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Favicon URL
              </label>
              <input
                type="text"
                value={branding.favicon_url}
                onChange={(e) =>
                  setBranding({ ...branding, favicon_url: e.target.value })
                }
                placeholder="https://example.com/favicon.ico"
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">
                Font Family
              </label>
              <input
                type="text"
                value={branding.font_family}
                onChange={(e) =>
                  setBranding({ ...branding, font_family: e.target.value })
                }
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-6 bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 className="text-white font-semibold mb-4">Preview</h3>
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: branding.primary_color + "20",
            border: `1px solid ${branding.primary_color}40`,
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            {branding.logo_url && (
              <Image
                src={branding.logo_url}
                alt="Logo"
                width={40}
                height={40}
                className="w-10 h-10 rounded"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <div>
              <h4
                className="text-white font-semibold"
                style={{ fontFamily: branding.font_family }}
              >
                Organization Name
              </h4>
              <p className="text-gray-400 text-sm">Branding Preview</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span
              className="px-4 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: branding.primary_color }}
            >
              Primary Button
            </span>
            <span
              className="px-4 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: branding.secondary_color }}
            >
              Secondary Button
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

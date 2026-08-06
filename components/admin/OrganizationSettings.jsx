/**
 * OrganizationSettings — Settings form for an organization.
 *
 * Allows editing organization details and key-value settings.
 */

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

export default function OrganizationSettings({ organizationId }) {
  const [org, setOrg] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    website: "",
    contact_email: "",
    contact_phone: "",
    industry: "",
    size: "",
  });

  const fetchData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const [orgRes, settingsRes] = await Promise.all([
        authFetch(`/api/organization?orgId=${organizationId}`),
        authFetch(`/api/organization/settings?organizationId=${organizationId}`),
      ]);

      const orgJson = await orgRes.json();
      const settingsJson = await settingsRes.json();

      if (orgJson.success && orgJson.data) {
        setOrg(orgJson.data);
        setForm({
          name: orgJson.data.name || "",
          description: orgJson.data.description || "",
          website: orgJson.data.website || "",
          contact_email: orgJson.data.contact_email || "",
          contact_phone: orgJson.data.contact_phone || "",
          industry: orgJson.data.industry || "",
          size: orgJson.data.size || "",
        });
      }

      if (settingsJson.success && settingsJson.data) {
        setSettings(settingsJson.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      queueMicrotask(() => fetchData());
    }
  }, [fetchData, organizationId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await authFetch("/api/organization", {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          orgId: organizationId,
          updates: form,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Settings saved successfully");
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSettingChange(key, value) {
    try {
      const res = await authFetch("/api/organization/settings", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          key,
          value,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSettings((prev) => ({ ...prev, [key]: value }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organization Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
              <select
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select...</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="501-1000">501-1000</option>
                <option value="1000+">1000+</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

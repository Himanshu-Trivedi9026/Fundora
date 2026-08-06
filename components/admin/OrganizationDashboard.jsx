/**
 * OrganizationDashboard — Admin organization management dashboard.
 *
 * Displays organization list, stats, member counts, and management actions.
 */

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TYPE_COLORS = {
  company: "bg-blue-100 text-blue-800",
  incubator: "bg-purple-100 text-purple-800",
  university: "bg-green-100 text-green-800",
  ngo: "bg-orange-100 text-orange-800",
  government: "bg-red-100 text-red-800",
  accelerator: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

const STATUS_COLORS = {
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-800",
};

export default function OrganizationDashboard() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    type: "company",
    description: "",
    website: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);

      const res = await authFetch(`/api/organization?${params}`);
      const json = await res.json();
      if (json.success) {
        setOrgs(json.data || []);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    queueMicrotask(() => fetchOrganizations());
  }, [fetchOrganizations]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await authFetch("/api/organization", {
        method: "POST",
        body: JSON.stringify({ action: "create", ...createForm }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setCreateForm({ name: "", slug: "", type: "company", description: "", website: "" });
        fetchOrganizations();
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-500 mt-1">Manage enterprise organizations and teams</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + New Organization
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Types</option>
          <option value="company">Company</option>
          <option value="incubator">Incubator</option>
          <option value="university">University</option>
          <option value="ngo">NGO</option>
          <option value="government">Government</option>
          <option value="accelerator">Accelerator</option>
          <option value="other">Other</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Create Form Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create Organization</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.replace(/[^a-z0-9-]/g, "-") })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="company">Company</option>
                  <option value="incubator">Incubator</option>
                  <option value="university">University</option>
                  <option value="ngo">NGO</option>
                  <option value="government">Government</option>
                  <option value="accelerator">Accelerator</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={createForm.website}
                  onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organizations Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading organizations...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No organizations found</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <div key={org.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{org.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[org.status] || STATUS_COLORS.active}`}>
                  {org.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[org.type] || TYPE_COLORS.other}`}>
                  {org.type}
                </span>
                {org.industry && (
                  <span className="text-xs text-gray-500">{org.industry}</span>
                )}
              </div>
              {org.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{org.description}</p>
              )}
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>Created {formatDate(org.created_at)}</span>
                {org.size && <span>{org.size} employees</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

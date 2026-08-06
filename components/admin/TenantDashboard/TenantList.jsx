// Admin — Tenant List
// Organization multi-tenancy management with provisioning and settings

import React, { useState, useEffect, useCallback } from "react";

export default function TenantList() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchTenants = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const url = search ? `/api/tenants?search=${encodeURIComponent(search)}&limit=50` : "/api/tenants?limit=50";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setTenants(json.data || []);
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [search]);

  useEffect(() => {
    queueMicrotask(() => fetchTenants());
  }, [fetchTenants]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Tenants</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants..."
            onKeyDown={(e) => e.key === "Enter" && fetchTenants()}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm w-64"
          />
          <button onClick={fetchTenants} className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm">
            Search
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No tenants found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              onClick={() => setSelected(selected === tenant.id ? null : tenant.id)}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{tenant.name}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">{tenant.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tenant.plan === "enterprise" ? "bg-purple-500/20 text-purple-400" :
                    tenant.plan === "pro" ? "bg-blue-500/20 text-blue-400" :
                    "bg-gray-700 text-gray-400"
                  }`}>
                    {tenant.plan}
                  </span>
                  {tenant.website_url && (
                    <a href={tenant.website_url} target="_blank" rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 text-sm"
                      onClick={(e) => e.stopPropagation()}>
                      Visit →
                    </a>
                  )}
                </div>
              </div>

              {tenant.description && (
                <p className="text-gray-500 text-sm mt-2">{tenant.description}</p>
              )}

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Created: {new Date(tenant.created_at).toLocaleDateString()}</span>
                {tenant.contact_email && <span>Contact: {tenant.contact_email}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

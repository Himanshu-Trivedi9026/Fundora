/**
 * PolicyManagement — Admin policy management panel.
 */

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

export default function PolicyManagement() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const fetchPolicies = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/admin/policy-management?mode=list");
      const json = await res.json();
      if (json.success) setPolicies(json.policies || []);
      else setError(json.error);
    } catch {
      setError("Network error");
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchPolicies());
  }, [fetchPolicies]);

  async function initDefaults() {
    try {
      const res = await authFetch("/api/admin/policy-management", {
        method: "POST",
        body: JSON.stringify({ action: "initialize_defaults" }),
      });
      const json = await res.json();
      if (json.success) fetchPolicies();
      else alert(json.error);
    } catch {
      alert("Failed to initialize defaults");
    }
  }

  if (loading)
    return <div className="h-64 bg-white rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Policy Management</h1>
        <button
          onClick={initDefaults}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          Initialize Defaults
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Active
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {policies.map((p) => (
              <tr
                key={p.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedPolicy(p)}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {p.policy_key}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {p.category}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {p.policy_type}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  {JSON.stringify(p.value)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${p.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {policies.length === 0 && (
          <p className="p-6 text-gray-500 text-center">
            No policies configured. Click &ldquo;Initialize Defaults&rdquo; to
            set up default policies.
          </p>
        )}
      </div>

      {selectedPolicy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedPolicy(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{selectedPolicy.name}</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Key:</span>{" "}
                {selectedPolicy.policy_key}
              </p>
              <p>
                <span className="font-medium">Category:</span>{" "}
                {selectedPolicy.category}
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                {selectedPolicy.policy_type}
              </p>
              <p>
                <span className="font-medium">Value:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {JSON.stringify(selectedPolicy.value)}
                </code>
              </p>
              <p>
                <span className="font-medium">Default:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {JSON.stringify(selectedPolicy.default_value)}
                </code>
              </p>
              {selectedPolicy.description && (
                <p>
                  <span className="font-medium">Description:</span>{" "}
                  {selectedPolicy.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedPolicy(null)}
              className="mt-6 w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

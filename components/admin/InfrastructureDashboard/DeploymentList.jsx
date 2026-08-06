import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function DeploymentList() {
  const [deployments, setDeployments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const fetchDeployments = useCallback(async (status) => {
    queueMicrotask(() => setLoading(true));
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status) params.set("status", status);
      const res = await authFetch(`/api/deployments?${params}`);
      const json = await res.json();
      if (json.deployments) {
        setDeployments(json.deployments);
        setTotal(json.total);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchDeployments());
  }, [fetchDeployments]);

  const handleRollback = async (deploymentId) => {
    if (!confirm("Rollback this deployment?")) return;
    try {
      const res = await authFetch("/api/deployments/rollback", {
        method: "POST",
        body: JSON.stringify({ deploymentId }),
      });
      const json = await res.json();
      if (json.success) fetchDeployments(filter);
      else alert(json.error);
    } catch (err) {
      alert(err.message);
    }
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      deployed: "bg-green-900/50 text-green-400",
      healthy: "bg-green-900/50 text-green-400",
      deploying: "bg-blue-900/50 text-blue-400",
      failed: "bg-red-900/50 text-red-400",
      rolled_back: "bg-yellow-900/50 text-yellow-400",
      cancelled: "bg-gray-800 text-gray-400",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs ${colors[status] || "bg-gray-800 text-gray-400"}`}
      >
        {status}
      </span>
    );
  };

  const filters = ["", "deployed", "deploying", "failed", "rolled_back"];
  const getStatusCount = (status) =>
    status
      ? deployments.filter((d) => d.status === status).length
      : deployments.length;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Deployments</h3>
            <p className="text-sm text-gray-400">{total} total deployments</p>
          </div>
          <button
            onClick={() => fetchDeployments(filter)}
            className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f || "all"}
              onClick={() => {
                setFilter(f);
                fetchDeployments(f);
              }}
              className={`px-3 py-1 rounded-lg text-sm ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              {f || "All"} ({getStatusCount(f)})
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse h-16 bg-gray-800 rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && deployments.length === 0 && (
        <div className="p-6 text-center text-gray-500">
          <p>No deployments found</p>
        </div>
      )}

      {/* Deployment List */}
      {!loading && deployments.length > 0 && (
        <div className="divide-y divide-gray-800">
          {deployments.map((dep) => (
            <div
              key={dep.id}
              className="p-4 hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">
                      {dep.version}
                    </span>
                    <StatusBadge status={dep.status} />
                    {dep.health_check_passed && (
                      <span className="text-xs text-green-500">
                        ✓ Health Check
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{dep.environment}</span>
                    <span>{dep.branch}</span>
                    {dep.commit_hash && (
                      <span title={dep.commit_hash}>
                        {dep.commit_hash.substring(0, 7)}
                      </span>
                    )}
                    <span>{new Date(dep.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dep.status !== "rolled_back" &&
                    dep.status !== "cancelled" && (
                      <button
                        onClick={() => handleRollback(dep.id)}
                        className="px-3 py-1 text-xs bg-yellow-900/30 text-yellow-400 rounded hover:bg-yellow-900/50"
                      >
                        Rollback
                      </button>
                    )}
                  {dep.deployed_by && (
                    <span className="text-xs text-gray-600">
                      {dep.deployed_by.substring(0, 8)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

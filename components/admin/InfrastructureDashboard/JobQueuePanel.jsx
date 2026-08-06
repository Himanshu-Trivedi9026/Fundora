import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../lib/authFetch";

const StatCard = ({ label, value, color = "text-blue-400" }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
    <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

export default function JobQueuePanel() {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/infrastructure/queues");
      const json = await res.json();
      if (json.success) setQueueData(json.data);
      else setError(json.error);
    } catch (err) {
      setError(err.message);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchQueue());
    const interval = setInterval(() => {
      fetchQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-gray-800 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const { summary, handlers, recentCompleted } = queueData || {};

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Background Jobs</h3>
            <p className="text-sm text-gray-400">Queue status and worker metrics</p>
          </div>
          <button onClick={fetchQueue} className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Pending" value={summary?.pending} color="text-yellow-400" />
          <StatCard label="Running" value={summary?.running} color="text-blue-400" />
          <StatCard label="Dead Letter" value={summary?.deadLetter} color="text-red-400" />
          <StatCard label="Completed" value={summary?.completed} color="text-green-400" />
          <StatCard label="Active Handlers" value={summary?.activeHandlers} color="text-purple-400" />
        </div>

        {/* Handlers */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Registered Handlers</h4>
          {handlers && handlers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {handlers.map((h) => (
                <span key={h} className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                  {h}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No handlers registered</p>
          )}
        </div>

        {/* Recent Completed Jobs */}
        {recentCompleted && recentCompleted.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Recently Completed</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Queue</th>
                    <th className="text-left py-2">Priority</th>
                    <th className="text-left py-2">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCompleted.map((job) => (
                    <tr key={job.id} className="border-b border-gray-800/50">
                      <td className="py-2 text-gray-300">{job.job_type}</td>
                      <td className="py-2 text-gray-400">{job.queue_name}</td>
                      <td className="py-2 text-gray-400">{job.priority}</td>
                      <td className="py-2 text-gray-400">
                        {job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

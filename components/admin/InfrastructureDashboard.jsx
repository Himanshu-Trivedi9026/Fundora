// InfrastructureDashboard — backup, storage, and system health management
import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

export default function InfrastructureDashboard() {
  const [backups, setBackups] = useState([]);
  const [backupStats, setBackupStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInfraData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const [backupsRes, statsRes] = await Promise.all([
        authFetch("/api/backup/backups?limit=20"),
        authFetch("/api/backup/backups?stats=true"),
      ]);

      const backupsData = await backupsRes.json();
      const statsData = await statsRes.json();

      if (backupsData.success) setBackups(backupsData.data || []);
      if (statsData.success) setBackupStats(statsData.data);
    } catch (err) {
      console.error("Failed to fetch infrastructure data", err);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchInfraData());
  }, [fetchInfraData]);

  const handleCreateBackup = async () => {
    try {
      const res = await authFetch("/api/backup/backups", {
        method: "POST",
        body: JSON.stringify({ type: "full" }),
      });
      const data = await res.json();
      if (data.success) fetchInfraData();
    } catch (err) {
      console.error("Failed to create backup", err);
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Backups</p>
          <p className="text-2xl font-bold text-white">{backupStats?.total || 0}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Size</p>
          <p className="text-2xl font-bold text-blue-400">
            {backupStats?.totalSizeBytes ? `${(backupStats.totalSizeBytes / 1048576).toFixed(1)} MB` : "0 MB"}
          </p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-400">{backupStats?.byStatus?.completed || 0}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Latest Backup</p>
          <p className="text-sm font-bold text-gray-300">
            {backupStats?.latestBackup
              ? new Date(backupStats.latestBackup.created_at).toLocaleDateString()
              : "None"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleCreateBackup}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Create Backup
        </button>
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">
          View Restore Operations
        </button>
      </div>

      {/* Backup list */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Recent Backups</h3>
        </div>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No backups created yet</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {backups.map((backup, i) => (
              <div key={backup.id || i} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium capitalize">{backup.backup_type} Backup</p>
                  <p className="text-xs text-gray-500">{new Date(backup.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {backup.size_bytes ? `${(backup.size_bytes / 1024).toFixed(1)} KB` : "—"}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    backup.status === "completed" ? "bg-green-900/50 text-green-400" :
                    backup.status === "running" ? "bg-blue-900/50 text-blue-400" :
                    backup.status === "failed" ? "bg-red-900/50 text-red-400" :
                    "bg-gray-700 text-gray-400"
                  }`}>
                    {backup.status || "unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

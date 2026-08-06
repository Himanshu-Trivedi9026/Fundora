/**
 * PlatformAnalytics — Platform analytics dashboard.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { authFetch } from "../../lib/authFetch";

function formatNumber(n) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

function formatPercent(n) {
  if (n === undefined || n === null) return "—";
  return `${Number(n).toFixed(1)}%`;
}

function ScoreBar({ label, value, max = 100 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct > 70 ? "bg-green-500" : pct > 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
          className={`h-3 rounded-full ${color}`}
        />
      </div>
      <span className="text-sm font-medium text-gray-900 w-12 text-right">
        {formatPercent(value)}
      </span>
    </div>
  );
}

export default function PlatformAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/admin/platform-analytics?mode=all");
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error);
    } catch {
      setError("Network error");
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchAnalytics());
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        {error}
      </div>
    );

  const health = data?.health || {};
  const trust = data?.trust || {};
  const escrow = data?.escrow || {};
  const milestones = data?.milestones || {};
  const payouts = data?.payouts || {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>

      {/* Health Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Platform Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Users", value: formatNumber(health.totalUsers) },
            { label: "Active Users", value: formatNumber(health.activeUsers) },
            {
              label: "Total Campaigns",
              value: formatNumber(health.totalCampaigns),
            },
            { label: "Total Raised", value: formatNumber(health.totalRaised) },
            {
              label: "Health Score",
              value: formatPercent(health.overallScore),
            },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-2xl font-bold text-blue-600">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trust Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Trust Distribution</h2>
        <div className="space-y-3">
          <ScoreBar label="Low (0-25)" value={trust.low || 0} />
          <ScoreBar label="Medium (26-50)" value={trust.medium || 0} />
          <ScoreBar label="High (51-75)" value={trust.high || 0} />
          <ScoreBar label="Critical (76-100)" value={trust.critical || 0} />
        </div>
      </motion.div>

      {/* Escrow & Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Escrow Utilization</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Locked</span>
              <span className="font-medium">
                {formatNumber(escrow.totalLocked)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Released</span>
              <span className="font-medium">
                {formatNumber(escrow.totalReleased)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Refunded</span>
              <span className="font-medium">
                {formatNumber(escrow.totalRefunded)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Accounts</span>
              <span className="font-medium">
                {formatNumber(escrow.activeAccounts)}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h2 className="text-lg font-semibold mb-4">
            Milestone & Payout Stats
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Milestone Completion</span>
              <span className="font-medium">
                {formatPercent(milestones.completionRate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average Approval</span>
              <span className="font-medium">
                {formatPercent(milestones.averageApproval)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payout Success</span>
              <span className="font-medium">
                {formatPercent(payouts.successRate)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

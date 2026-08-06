/**
 * EscrowDashboard — Admin escrow center dashboard.
 *
 * Displays escrow overview, pending payouts, recent events, risk flags.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { authFetch } from "../../lib/authFetch";

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EscrowDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [releaseForm, setReleaseForm] = useState({ escrowAccountId: "", amount: "", reason: "" });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/escrow-dashboard?mode=overview");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load dashboard");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await authFetch("/api/admin/escrow-dashboard", {
        method: "POST",
        body: JSON.stringify({
          action: "release",
          escrowAccountId: releaseForm.escrowAccountId,
          amount: parseFloat(releaseForm.amount),
          reason: releaseForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReleaseForm({ escrowAccountId: "", amount: "", reason: "" });
        fetchDashboard();
      } else {
        alert(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchDashboard} className="mt-3 text-sm text-blue-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {["overview", "payouts", "events", "release"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Accounts", value: summary.totalAccounts || 0, color: "text-white" },
              { label: "Total Locked", value: formatCurrency(summary.totalLocked), color: "text-yellow-400" },
              { label: "Total Released", value: formatCurrency(summary.totalReleased), color: "text-green-400" },
              { label: "Platform Fees", value: formatCurrency(summary.totalFees), color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Status Breakdown */}
          {summary.byStatus && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">By Status</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.byStatus).map(([status, count]) => (
                  <span key={status} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-xs">
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk Flagged */}
          {data?.riskFlagged?.length > 0 && (
            <div className="bg-red-900/10 border border-red-800/50 rounded-xl p-5">
              <h3 className="text-red-400 font-semibold text-sm mb-3">🔒 Frozen Accounts ({data.riskFlagged.length})</h3>
              <div className="space-y-2">
                {data.riskFlagged.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2">
                    <span className="text-gray-300 text-sm">Campaign: {acc.campaign_id?.substring(0, 8)}...</span>
                    <span className="text-red-400 text-xs">{acc.frozen_reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Payouts Tab */}
      {activeTab === "payouts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm">Pending Payouts ({data?.pendingPayoutCount || 0})</h3>
            </div>
            {data?.pendingPayouts?.length > 0 ? (
              <div className="divide-y divide-gray-800/50">
                {data.pendingPayouts.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">Creator: {p.creator_id?.substring(0, 8)}...</p>
                      <p className="text-gray-500 text-xs">{formatDate(p.created_at)} • {p.priority}</p>
                    </div>
                    <p className="text-green-400 font-semibold">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">No pending payouts</div>
            )}
          </div>
        </motion.div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm">Recent Events</h3>
            </div>
            {data?.recentEvents?.length > 0 ? (
              <div className="divide-y divide-gray-800/50">
                {data.recentEvents.map((ev) => (
                  <div key={ev.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 text-xs font-medium">{ev.event_type}</span>
                      <span className="text-gray-500 text-xs">{formatDate(ev.created_at)}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      {ev.entity_type} → {ev.new_status || "—"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">No recent events</div>
            )}
          </div>
        </motion.div>
      )}

      {/* Release Tab */}
      {activeTab === "release" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <form onSubmit={handleRelease} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Manual Fund Release</h3>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Escrow Account ID</label>
              <input
                type="text"
                value={releaseForm.escrowAccountId}
                onChange={(e) => setReleaseForm({ ...releaseForm, escrowAccountId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                placeholder="UUID"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Amount (₹)</label>
              <input
                type="number"
                value={releaseForm.amount}
                onChange={(e) => setReleaseForm({ ...releaseForm, amount: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Reason</label>
              <textarea
                value={releaseForm.reason}
                onChange={(e) => setReleaseForm({ ...releaseForm, reason: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                rows={3}
                required
              />
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Processing..." : "Release Funds"}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

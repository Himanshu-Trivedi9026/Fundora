/**
 * FraudDashboard — Admin fraud management dashboard.
 *
 * Features:
 *   - Risk score distribution overview
 *   - High-risk user list
 *   - Recent fraud events
 *   - Manual override controls
 *   - Risk trend charts
 *
 * Security:
 *   - Never exposes raw risk formulas or AI analysis
 *   - Admin-only access
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

const RISK_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const DECISION_COLORS = {
  allow: "#10b981",
  monitor: "#3b82f6",
  manual_review: "#f59e0b",
  limit: "#f97316",
  block: "#ef4444",
  escalate: "#dc2626",
};

export default function FraudDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ riskLevel: "", decision: "" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [overrideModal, setOverrideModal] = useState(false);

  const fetchDashboard = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const params = new URLSearchParams();
      if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
      if (filters.decision) params.set("decision", filters.decision);

      const res = await authFetch(`/api/admin/fraud-dashboard?${params}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to load dashboard");
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(() => fetchDashboard());
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400 font-inter">
          Loading fraud dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <p className="text-red-400 font-inter">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 text-sm text-red-300 hover:text-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white font-geist">
          Fraud Center
        </h2>
        <div className="flex gap-3">
          <select
            value={filters.riskLevel}
            onChange={(e) =>
              setFilters((f) => ({ ...f, riskLevel: e.target.value }))
            }
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filters.decision}
            onChange={(e) =>
              setFilters((f) => ({ ...f, decision: e.target.value }))
            }
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Decisions</option>
            <option value="allow">Allow</option>
            <option value="monitor">Monitor</option>
            <option value="manual_review">Manual Review</option>
            <option value="limit">Limit</option>
            <option value="block">Block</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Profiles"
            value={data.summary.totalProfiles || 0}
            icon="people"
          />
          <SummaryCard
            label="Critical Risk"
            value={data.summary.byRiskLevel?.critical || 0}
            color={RISK_COLORS.critical}
            icon="warning"
          />
          <SummaryCard
            label="Blocked"
            value={data.summary.byDecision?.block || 0}
            color={DECISION_COLORS.block}
            icon="block"
          />
          <SummaryCard
            label="Manual Review"
            value={data.summary.byDecision?.manual_review || 0}
            color={DECISION_COLORS.manual_review}
            icon="rate_review"
          />
        </div>
      )}

      {/* Profiles Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white font-geist">
            User Profiles
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-white/5">
                <th className="p-4">User</th>
                <th className="p-4">Risk Score</th>
                <th className="p-4">Level</th>
                <th className="p-4">Decision</th>
                <th className="p-4">Events</th>
                <th className="p-4">Last Evaluated</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.profiles || []).map((profile) => (
                <tr
                  key={profile.id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-4">
                    <span className="text-white font-mono text-sm">
                      {profile.user_id.substring(0, 8)}...
                    </span>
                  </td>
                  <td className="p-4">
                    <RiskScoreBadge score={profile.risk_score} />
                  </td>
                  <td className="p-4">
                    <RiskLevelBadge level={profile.risk_level} />
                  </td>
                  <td className="p-4">
                    <DecisionBadge decision={profile.decision} />
                  </td>
                  <td className="p-4 text-gray-300">{profile.total_events}</td>
                  <td className="p-4 text-gray-400 text-sm">
                    {profile.last_evaluated_at
                      ? new Date(profile.last_evaluated_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedUser(profile)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          userId={selectedUser.user_id}
          onClose={() => setSelectedUser(null)}
          onOverride={(data) => {
            setOverrideModal(data);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Override Modal */}
      {overrideModal && (
        <OverrideModal
          userId={overrideModal.userId}
          onClose={() => setOverrideModal(null)}
          onComplete={() => {
            setOverrideModal(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ───

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span
          className="material-symbols-outlined text-2xl"
          style={{ color: color || "#9ca3af" }}
        >
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-white font-geist">{value}</p>
          <p className="text-sm text-gray-400 font-inter">{label}</p>
        </div>
      </div>
    </div>
  );
}

function RiskScoreBadge({ score }) {
  const level =
    score >= 76
      ? "critical"
      : score >= 51
        ? "high"
        : score >= 26
          ? "medium"
          : "low";
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${RISK_COLORS[level]}20`,
        color: RISK_COLORS[level],
      }}
    >
      {score}
    </span>
  );
}

function RiskLevelBadge({ level }) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize"
      style={{
        backgroundColor: `${RISK_COLORS[level] || "#9ca3af"}20`,
        color: RISK_COLORS[level] || "#9ca3af",
      }}
    >
      {level}
    </span>
  );
}

function DecisionBadge({ decision }) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize"
      style={{
        backgroundColor: `${DECISION_COLORS[decision] || "#9ca3af"}20`,
        color: DECISION_COLORS[decision] || "#9ca3af",
      }}
    >
      {decision?.replace("_", " ")}
    </span>
  );
}

function UserDetailModal({ userId, onClose, onOverride }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/admin/fraud-dashboard", {
        method: "POST",
        body: JSON.stringify({ action: "getProfile", userId }),
      });
      const result = await res.json();
      if (result.success) {
        queueMicrotask(() => setDetail(result));
      }
    } catch {
      // Handle error
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [userId]);

  useEffect(() => {
    queueMicrotask(() => fetchDetail());
  }, [fetchDetail]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white font-geist">
            User Risk Profile
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-400">Loading...</div>
        ) : detail ? (
          <div className="p-6 space-y-4">
            {/* Profile Summary */}
            {detail.profile && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Risk Score</p>
                  <RiskScoreBadge score={detail.profile.risk_score} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Decision</p>
                  <DecisionBadge decision={detail.profile.decision} />
                </div>
              </div>
            )}

            {/* Recent Events */}
            {detail.events?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Recent Events
                </h4>
                <div className="space-y-2">
                  {detail.events.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-300">{event.event_type}</span>
                      <span className="text-gray-500">
                        {new Date(event.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Override Button */}
            <button
              onClick={() => onOverride({ userId })}
              className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Apply Manual Override
            </button>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400">No data found</div>
        )}
      </div>
    </div>
  );
}

function OverrideModal({ userId, onClose, onComplete }) {
  const [form, setForm] = useState({
    overrideType: "decision",
    newValue: "",
    reason: "",
    isPermanent: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await authFetch("/api/admin/fraud-dashboard", {
        method: "POST",
        body: JSON.stringify({
          action: "override",
          userId,
          ...form,
        }),
      });

      const result = await res.json();
      if (result.success) {
        onComplete();
      }
    } catch {
      // Handle error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white font-geist">
            Manual Override
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Override Type
            </label>
            <select
              value={form.overrideType}
              onChange={(e) =>
                setForm((f) => ({ ...f, overrideType: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
            >
              <option value="decision">Decision</option>
              <option value="risk_score">Risk Score</option>
              <option value="block">Block</option>
              <option value="unblock">Unblock</option>
              <option value="whitelist">Whitelist</option>
              <option value="blacklist">Blacklist</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              New Value
            </label>
            <input
              type="text"
              value={form.newValue}
              onChange={(e) =>
                setForm((f) => ({ ...f, newValue: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
              placeholder={
                form.overrideType === "risk_score" ? "0-100" : "allow/block/etc"
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({ ...f, reason: e.target.value }))
              }
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white h-20"
              placeholder="Reason for override..."
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="permanent"
              checked={form.isPermanent}
              onChange={(e) =>
                setForm((f) => ({ ...f, isPermanent: e.target.checked }))
              }
              className="rounded"
            />
            <label htmlFor="permanent" className="text-sm text-gray-400">
              Permanent override
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-lg px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Applying..." : "Apply Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

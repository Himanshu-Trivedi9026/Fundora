/**
 * AppealsDashboard — Admin appeals center.
 *
 * Displays appeal management: overview stats, appeals list,
 * appeal detail with review form, and action controls.
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

export default function AppealsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({ decision: "", rationale: "" });

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/appeals-dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load appeals dashboard");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAppealAction(appealId, action, payload = {}) {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/admin/appeals-dashboard", {
        method: "POST",
        body: JSON.stringify({ action, appealId, ...payload }),
      });
      const json = await res.json();
      if (json.success) {
        fetchDashboard();
        setSelectedAppeal(null);
      } else {
        alert(json.error || "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReview(e) {
    e.preventDefault();
    if (!selectedAppeal) return;
    await handleAppealAction(selectedAppeal.id, "review", {
      decision: reviewForm.decision,
      rationale: reviewForm.rationale,
    });
    setReviewForm({ decision: "", rationale: "" });
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
        <button
          onClick={fetchDashboard}
          className="mt-3 text-sm text-blue-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const appeals = data?.appeals || [];

  const filteredAppeals = appeals.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterType !== "all" && a.appeal_type !== filterType) return false;
    return true;
  });

  const statusColors = {
    pending: "text-yellow-400 bg-yellow-900/30",
    under_review: "text-blue-400 bg-blue-900/30",
    upheld: "text-green-400 bg-green-900/30",
    overturned: "text-purple-400 bg-purple-900/30",
    modified: "text-orange-400 bg-orange-900/30",
    escalated: "text-red-400 bg-red-900/30",
    dismissed: "text-gray-400 bg-gray-800",
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {["overview", "appeals"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedAppeal(null);
            }}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Appeals",
                value: summary.totalAppeals || 0,
                color: "text-white",
              },
              {
                label: "Pending",
                value: summary.pending || 0,
                color: "text-yellow-400",
              },
              {
                label: "Under Review",
                value: summary.underReview || 0,
                color: "text-blue-400",
              },
              {
                label: "Resolved",
                value: summary.resolved || 0,
                color: "text-green-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <p className="text-gray-400 text-xs">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* By Type */}
          {summary.byType && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">
                Appeals by Type
              </h3>
              <div className="space-y-2">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{type}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${summary.totalAppeals ? (count / summary.totalAppeals) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Outcome */}
          {summary.byOutcome && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">
                By Outcome
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.byOutcome).map(([outcome, count]) => (
                  <span
                    key={outcome}
                    className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-xs"
                  >
                    {outcome}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Appeals */}
          {data?.recentAppeals?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-3 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">
                  Recent Appeals
                </h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {data.recentAppeals.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedAppeal(a);
                      setActiveTab("appeals");
                    }}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">
                          {a.appeal_type || a.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${statusColors[a.status] || "bg-gray-800 text-gray-300"}`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {formatDate(a.created_at)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Appeals Tab */}
      {activeTab === "appeals" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {selectedAppeal ? (
            /* Appeal Detail View */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedAppeal(null)}
                className="text-purple-400 text-sm hover:underline flex items-center gap-1"
              >
                ← Back to appeals
              </button>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-bold text-lg">
                        {selectedAppeal.appeal_type || selectedAppeal.type}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${statusColors[selectedAppeal.status] || "bg-gray-800 text-gray-300"}`}
                      >
                        {selectedAppeal.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      ID: {selectedAppeal.id?.substring(0, 8)}... •{" "}
                      {formatDate(selectedAppeal.created_at)}
                    </p>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-4">
                  {selectedAppeal.reason ||
                    selectedAppeal.statement ||
                    "No statement provided."}
                </p>

                {/* Original Action */}
                {selectedAppeal.original_action && (
                  <div className="bg-gray-800 rounded-lg px-4 py-2 mb-4">
                    <p className="text-gray-400 text-xs">Original Action</p>
                    <p className="text-white text-sm">
                      {selectedAppeal.original_action}
                    </p>
                  </div>
                )}

                {/* Appellant */}
                {selectedAppeal.appellant_id && (
                  <p className="text-gray-500 text-xs mb-4">
                    Appellant: {selectedAppeal.appellant_id.substring(0, 8)}...
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {selectedAppeal.status === "pending" && (
                    <>
                      <button
                        onClick={() =>
                          handleAppealAction(
                            selectedAppeal.id,
                            "assign_reviewer",
                          )
                        }
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Assign Reviewer
                      </button>
                      <button
                        onClick={() =>
                          handleAppealAction(selectedAppeal.id, "escalate")
                        }
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Escalate
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Review Form */}
              {["pending", "under_review"].includes(selectedAppeal.status) && (
                <form
                  onSubmit={handleReview}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
                >
                  <h3 className="text-white font-semibold text-sm">
                    Review Decision
                  </h3>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Decision
                    </label>
                    <select
                      value={reviewForm.decision}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          decision: e.target.value,
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="">Select decision...</option>
                      <option value="uphold">Uphold Original Decision</option>
                      <option value="overturn">Overturn Decision</option>
                      <option value="modify">Modify Decision</option>
                      <option value="escalate">
                        Escalate to Senior Reviewer
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Rationale
                    </label>
                    <textarea
                      value={reviewForm.rationale}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          rationale: e.target.value,
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      rows={4}
                      placeholder="Explain the reasoning behind your decision..."
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading || !reviewForm.decision}
                    className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Submit Review"}
                  </button>
                </form>
              )}

              {/* Previous Review */}
              {selectedAppeal.review && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold text-sm mb-3">
                    Previous Review
                  </h3>
                  <div className="bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 text-sm font-medium">
                        Decision: {selectedAppeal.review.decision}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      {selectedAppeal.review.rationale}
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                      {formatDate(selectedAppeal.review.reviewed_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Appeals List with Filters */
            <>
              {/* Filters */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex gap-3 flex-wrap">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="uphold">Upheld</option>
                    <option value="overturned">Overturned</option>
                    <option value="modified">Modified</option>
                    <option value="escalated">Escalated</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Types</option>
                    <option value="account_suspension">
                      Account Suspension
                    </option>
                    <option value="content_removal">Content Removal</option>
                    <option value="campaign_rejection">
                      Campaign Rejection
                    </option>
                    <option value="payout_hold">Payout Hold</option>
                    <option value="verification_denial">
                      Verification Denial
                    </option>
                  </select>
                </div>
              </div>

              {/* Appeals List */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">
                    Appeals ({filteredAppeals.length})
                  </h3>
                </div>
                {filteredAppeals.length > 0 ? (
                  <div className="divide-y divide-gray-800/50">
                    {filteredAppeals.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAppeal(a)}
                        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">
                              {a.appeal_type || a.type}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${statusColors[a.status] || "bg-gray-800 text-gray-300"}`}
                            >
                              {a.status}
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mt-1">
                            {a.reason?.substring(0, 80) || "No reason"}
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            {formatDate(a.created_at)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No appeals match filters
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

/**
 * ModerationDashboard — Admin moderation center.
 *
 * Displays moderation report management: overview stats, cases list,
 * case detail with evidence viewer, and action controls.
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

export default function ModerationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveForm, setResolveForm] = useState({ action: "", notes: "" });

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/moderation-dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load moderation dashboard");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCaseAction(caseId, action, payload = {}) {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/admin/moderation-dashboard", {
        method: "POST",
        body: JSON.stringify({ action, caseId, ...payload }),
      });
      const json = await res.json();
      if (json.success) {
        fetchDashboard();
        setSelectedCase(null);
      } else {
        alert(json.error || "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve(e) {
    e.preventDefault();
    if (!selectedCase) return;
    await handleCaseAction(selectedCase.id, "resolve", { resolutionAction: resolveForm.action, notes: resolveForm.notes });
    setResolveForm({ action: "", notes: "" });
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
  const cases = data?.cases || [];

  const filteredCases = cases.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterType !== "all" && c.report_type !== filterType) return false;
    return true;
  });

  const statusColors = {
    open: "text-blue-400 bg-blue-900/30",
    reviewing: "text-yellow-400 bg-yellow-900/30",
    resolved: "text-green-400 bg-green-900/30",
    dismissed: "text-gray-400 bg-gray-800",
    escalated: "text-orange-400 bg-orange-900/30",
  };

  const severityColors = {
    critical: "text-red-400 bg-red-900/30",
    high: "text-orange-400 bg-orange-900/30",
    medium: "text-yellow-400 bg-yellow-900/30",
    low: "text-gray-400 bg-gray-800",
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {["overview", "cases"].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedCase(null); }}
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
              { label: "Total Reports", value: summary.totalReports || 0, color: "text-white" },
              { label: "Open", value: summary.open || 0, color: "text-blue-400" },
              { label: "Resolved", value: summary.resolved || 0, color: "text-green-400" },
              { label: "Escalated", value: summary.escalated || 0, color: "text-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Action Distribution */}
          {summary.actionDistribution && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">Action Distribution</h3>
              <div className="space-y-2">
                {Object.entries(summary.actionDistribution).map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{action}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${summary.totalReports ? (count / summary.totalReports) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Report Type */}
          {summary.byReportType && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">By Report Type</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.byReportType).map(([type, count]) => (
                  <span key={type} className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-xs">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Reports */}
          {data?.recentCases?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-3 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">Recent Reports</h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {data.recentCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCase(c); setActiveTab("cases"); }}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{c.report_type || c.type}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[c.status] || "bg-gray-800 text-gray-300"}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{formatDate(c.created_at)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${severityColors[c.severity] || "bg-gray-800 text-gray-300"}`}>
                      {c.severity || "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Cases Tab */}
      {activeTab === "cases" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {selectedCase ? (
            /* Case Detail View */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedCase(null)}
                className="text-purple-400 text-sm hover:underline flex items-center gap-1"
              >
                ← Back to cases
              </button>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-bold text-lg">{selectedCase.report_type || selectedCase.type}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs ${statusColors[selectedCase.status] || "bg-gray-800 text-gray-300"}`}>
                        {selectedCase.status}
                      </span>
                      {selectedCase.severity && (
                        <span className={`px-3 py-1 rounded-full text-xs ${severityColors[selectedCase.severity] || "bg-gray-800 text-gray-300"}`}>
                          {selectedCase.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">ID: {selectedCase.id?.substring(0, 8)}... • {formatDate(selectedCase.created_at)}</p>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-4">{selectedCase.description || selectedCase.details || "No description provided."}</p>

                {/* Reporter / Target */}
                <div className="flex gap-4 text-xs text-gray-500 mb-4">
                  {selectedCase.reporter_id && (
                    <span>Reporter: {selectedCase.reporter_id.substring(0, 8)}...</span>
                  )}
                  {selectedCase.target_id && (
                    <span>Target: {selectedCase.target_id.substring(0, 8)}...</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {selectedCase.status !== "resolved" && (
                    <>
                      <button
                        onClick={() => handleCaseAction(selectedCase.id, "assign_moderator")}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Assign Moderator
                      </button>
                      <button
                        onClick={() => handleCaseAction(selectedCase.id, "escalate")}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Escalate
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Evidence Viewer */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">Evidence</h3>
                </div>
                {selectedCase.evidence?.length > 0 ? (
                  <div className="px-5 py-3 space-y-2">
                    {selectedCase.evidence.map((ev, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg px-4 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-400 text-xs font-medium">{ev.type || "Evidence #" + (i + 1)}</span>
                          {ev.url && (
                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 text-xs hover:underline">
                              View
                            </a>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-1">{ev.description || ev.content || "—"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">No evidence attached</div>
                )}
              </div>

              {/* Resolve Form */}
              {selectedCase.status !== "resolved" && (
                <form onSubmit={handleResolve} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-white font-semibold text-sm">Resolve Report</h3>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Resolution Action</label>
                    <select
                      value={resolveForm.action}
                      onChange={(e) => setResolveForm({ ...resolveForm, action: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="">Select action...</option>
                      <option value="no_action">No Action Needed</option>
                      <option value="warning">Issue Warning</option>
                      <option value="content_removed">Remove Content</option>
                      <option value="account_suspended">Suspend Account</option>
                      <option value="account_banned">Ban Account</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Notes</label>
                    <textarea
                      value={resolveForm.notes}
                      onChange={(e) => setResolveForm({ ...resolveForm, notes: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      rows={3}
                      placeholder="Resolution notes..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading || !resolveForm.action}
                    className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Resolve Report"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Cases List with Filters */
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
                    <option value="open">Open</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="escalated">Escalated</option>
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Types</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="misleading_content">Misleading Content</option>
                    <option value="fraudulent_campaign">Fraudulent Campaign</option>
                    <option value="copyright">Copyright</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Cases List */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">Reports ({filteredCases.length})</h3>
                </div>
                {filteredCases.length > 0 ? (
                  <div className="divide-y divide-gray-800/50">
                    {filteredCases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{c.report_type || c.type}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[c.status] || "bg-gray-800 text-gray-300"}`}>
                              {c.status}
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mt-1">{c.description?.substring(0, 80) || "No description"}</p>
                          <p className="text-gray-600 text-xs mt-1">{formatDate(c.created_at)}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${severityColors[c.severity] || "bg-gray-800 text-gray-300"}`}>
                          {c.severity || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">No reports match filters</div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

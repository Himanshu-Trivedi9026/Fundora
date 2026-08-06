/**
 * ComplianceDashboard — Admin compliance center dashboard.
 *
 * Displays compliance case management: overview stats, cases list,
 * case detail with events timeline, and action controls.
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

export default function ComplianceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "",
    description: "",
    priority: "medium",
    relatedEntityType: "",
    relatedEntityId: "",
  });

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await authFetch("/api/admin/compliance-dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load compliance dashboard");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCase(e) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await authFetch("/api/admin/compliance-dashboard", {
        method: "POST",
        body: JSON.stringify({ action: "create_case", ...createForm }),
      });
      const json = await res.json();
      if (json.success) {
        setCreateForm({
          type: "",
          description: "",
          priority: "medium",
          relatedEntityType: "",
          relatedEntityId: "",
        });
        fetchDashboard();
      } else {
        alert(json.error || "Failed to create case");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCaseAction(caseId, action, payload = {}) {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/admin/compliance-dashboard", {
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
  const cases = data?.cases || [];

  const filteredCases = cases.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterType !== "all" && c.type !== filterType) return false;
    if (filterPriority !== "all" && c.priority !== filterPriority) return false;
    return true;
  });

  const priorityColors = {
    critical: "text-red-400 bg-red-900/30",
    high: "text-orange-400 bg-orange-900/30",
    medium: "text-yellow-400 bg-yellow-900/30",
    low: "text-gray-400 bg-gray-800",
  };

  const statusColors = {
    open: "text-blue-400 bg-blue-900/30",
    investigating: "text-yellow-400 bg-yellow-900/30",
    escalated: "text-orange-400 bg-orange-900/30",
    resolved: "text-green-400 bg-green-900/30",
    dismissed: "text-gray-400 bg-gray-800",
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {["overview", "cases", "create"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedCase(null);
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              {
                label: "Total Cases",
                value: summary.totalCases || 0,
                color: "text-white",
              },
              {
                label: "Open",
                value: summary.open || 0,
                color: "text-blue-400",
              },
              {
                label: "Investigating",
                value: summary.investigating || 0,
                color: "text-yellow-400",
              },
              {
                label: "Resolved",
                value: summary.resolved || 0,
                color: "text-green-400",
              },
              {
                label: "Escalation Queue",
                value: summary.escalationQueue || 0,
                color: "text-orange-400",
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
              <h3 className="text-white font-semibold text-sm mb-3">By Type</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <span
                    key={type}
                    className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-xs"
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* By Priority */}
          {summary.byPriority && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3">
                By Priority
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(summary.byPriority).map(([priority, count]) => (
                  <span
                    key={priority}
                    className={`px-3 py-1 rounded-full text-xs ${priorityColors[priority] || "bg-gray-800 text-gray-300"}`}
                  >
                    {priority}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Cases */}
          {data?.recentCases?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-3 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">
                  Recent Cases
                </h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {data.recentCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCase(c);
                      setActiveTab("cases");
                    }}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">
                          {c.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${statusColors[c.status] || "bg-gray-800 text-gray-300"}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${priorityColors[c.priority] || "bg-gray-800 text-gray-300"}`}
                    >
                      {c.priority}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
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
                      <h3 className="text-white font-bold text-lg">
                        {selectedCase.type}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${statusColors[selectedCase.status] || "bg-gray-800 text-gray-300"}`}
                      >
                        {selectedCase.status}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${priorityColors[selectedCase.priority] || "bg-gray-800 text-gray-300"}`}
                      >
                        {selectedCase.priority}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      ID: {selectedCase.id?.substring(0, 8)}... •{" "}
                      {formatDate(selectedCase.created_at)}
                    </p>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-4">
                  {selectedCase.description || "No description provided."}
                </p>

                {selectedCase.related_entity_type && (
                  <p className="text-gray-500 text-xs">
                    Related: {selectedCase.related_entity_type} →{" "}
                    {selectedCase.related_entity_id?.substring(0, 8)}...
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {selectedCase.status !== "resolved" && (
                    <>
                      <button
                        onClick={() =>
                          handleCaseAction(selectedCase.id, "assign", {
                            assignee: "current_admin",
                          })
                        }
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Assign to Me
                      </button>
                      <button
                        onClick={() =>
                          handleCaseAction(selectedCase.id, "resolve")
                        }
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() =>
                          handleCaseAction(selectedCase.id, "escalate")
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

              {/* Events Timeline */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">
                    Events Timeline
                  </h3>
                </div>
                {selectedCase.events?.length > 0 ? (
                  <div className="px-5 py-3 space-y-3">
                    {selectedCase.events.map((ev, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 text-xs font-medium">
                              {ev.event_type || ev.action}
                            </span>
                            <span className="text-gray-600 text-xs">
                              {formatDate(ev.created_at || ev.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {ev.description || ev.details || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No events recorded
                  </div>
                )}
              </div>
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
                    <option value="investigating">Investigating</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Types</option>
                    <option value="aml">AML</option>
                    <option value="kyc">KYC</option>
                    <option value="regulatory">Regulatory</option>
                    <option value="policy_violation">Policy Violation</option>
                    <option value="fraud_referral">Fraud Referral</option>
                  </select>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Cases List */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold text-sm">
                    Cases ({filteredCases.length})
                  </h3>
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
                            <span className="text-white text-sm font-medium">
                              {c.type}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${statusColors[c.status] || "bg-gray-800 text-gray-300"}`}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mt-1">
                            {c.description?.substring(0, 80) ||
                              "No description"}
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            {formatDate(c.created_at)}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${priorityColors[c.priority] || "bg-gray-800 text-gray-300"}`}
                        >
                          {c.priority}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No cases match filters
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Create Tab */}
      {activeTab === "create" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <form
            onSubmit={handleCreateCase}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-white font-semibold text-sm">
              Create New Compliance Case
            </h3>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Type</label>
              <select
                value={createForm.type}
                onChange={(e) =>
                  setCreateForm({ ...createForm, type: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                required
              >
                <option value="">Select type...</option>
                <option value="aml">AML</option>
                <option value="kyc">KYC</option>
                <option value="regulatory">Regulatory</option>
                <option value="policy_violation">Policy Violation</option>
                <option value="fraud_referral">Fraud Referral</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Description
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  Priority
                </label>
                <select
                  value={createForm.priority}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, priority: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  Related Entity Type
                </label>
                <input
                  type="text"
                  value={createForm.relatedEntityType}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      relatedEntityType: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  placeholder="e.g. user, campaign"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">
                  Related Entity ID
                </label>
                <input
                  type="text"
                  value={createForm.relatedEntityId}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      relatedEntityId: e.target.value,
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  placeholder="UUID"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Creating..." : "Create Case"}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

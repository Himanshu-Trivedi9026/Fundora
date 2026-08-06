// Admin — Agent Center Dashboard
// Overview of all AI agents, their status, runs, and performance

import React, { useState, useEffect } from "react";
import { authFetch } from "../../../lib/authFetch";

const STATUS_COLORS = {
  active: "bg-green-500",
  inactive: "bg-gray-500",
  error: "bg-red-500",
  pending: "bg-yellow-500",
};

export default function AgentDashboard() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await authFetch("/api/agents");
      const json = await res.json();
      if (json.success) setAgents(json.data || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Agent Center</h1>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
            {agents.length} agents
          </span>
          <button
            onClick={fetchAgents}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Agents" value={agents.filter(a => a.status === "active").length} color="green" />
        <StatCard label="Total Runs" value={agents.reduce((s, a) => s + (a.run_count || 0), 0)} color="blue" />
        <StatCard label="Pending Approval" value={agents.filter(a => a.status === "pending").length} color="yellow" />
        <StatCard label="Error Rate" value={`${agents.filter(a => a.status === "error").length > 0 ? "⚠" : "0%"}`} color="red" />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Name</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Type</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Model</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Runs</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Last Run</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No agents found. Create your first agent to get started.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 text-white">{agent.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">
                        {agent.agent_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] || "bg-gray-500"}`} />
                        <span className="text-sm text-gray-300 capitalize">{agent.status}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300 text-sm">{agent.model || "default"}</td>
                    <td className="p-4 text-gray-300 text-sm">{agent.run_count || 0}</td>
                    <td className="p-4 text-gray-500 text-sm">
                      {agent.last_run_at ? new Date(agent.last_run_at).toLocaleString() : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    green: "border-green-500/30",
    blue: "border-blue-500/30",
    yellow: "border-yellow-500/30",
    red: "border-red-500/30",
  };

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${colors[color] || "border-gray-800"}`}>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

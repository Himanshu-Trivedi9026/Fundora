/**
 * ReputationCard — Creator reputation display card.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { authFetch } from "../../lib/authFetch";

function ScoreCircle({ score, label }) {
  const tier = score > 60 ? "High" : score > 30 ? "Medium" : "Low";
  const color =
    tier === "High"
      ? "text-green-600"
      : tier === "Medium"
        ? "text-yellow-600"
        : "text-red-600";
  const bgColor =
    tier === "High"
      ? "border-green-500"
      : tier === "Medium"
        ? "border-yellow-500"
        : "border-red-500";
  return (
    <div className="text-center">
      <div
        className={`w-16 h-16 rounded-full border-4 ${bgColor} flex items-center justify-center mx-auto`}
      >
        <span className={`text-lg font-bold ${color}`}>
          {Math.round(score || 0)}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {label} &mdash; {tier}
      </p>
    </div>
  );
}

function ScoreBar({ label, value }) {
  const pct = Math.min(value || 0, 100);
  const color =
    pct > 60 ? "bg-green-500" : pct > 30 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-32">{label}</span>
      <div
        className="flex-1 bg-gray-200 rounded-full h-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
          className={`h-2 rounded-full ${color}`}
          aria-hidden="true"
        />
      </div>
      <span className="text-sm font-medium w-10 text-right">
        {Math.round(pct)}
      </span>
    </div>
  );
}

export default function ReputationCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const fetchReputation = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const res = await authFetch("/api/creator/reputation");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      /* ignore */
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchReputation());
  }, [fetchReputation]);

  async function recalculate() {
    try {
      setRecalculating(true);
      const res = await authFetch("/api/creator/reputation", {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      /* ignore */
    } finally {
      setRecalculating(false);
    }
  }

  if (loading)
    return (
      <div
        className="h-64 bg-white rounded-xl animate-pulse"
        role="status"
        aria-label="Loading reputation data"
      />
    );

  const scores = data?.scores || {};
  const stats = data?.stats || {};

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Your Reputation</h2>
        <button
          onClick={recalculate}
          disabled={recalculating}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          aria-label="Recalculate reputation score"
        >
          {recalculating ? "Recalculating..." : "Recalculate"}
        </button>
      </div>

      {/* Overall Score */}
      <div className="text-center">
        <div className="w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center mx-auto">
          <span className="text-3xl font-bold text-blue-600">
            {Math.round(data?.overallScore || 0)}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">Overall Score</p>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <ScoreCircle score={scores.quality} label="Quality" />
        <ScoreCircle score={scores.reliability} label="Reliability" />
        <ScoreCircle score={scores.communication} label="Communication" />
        <ScoreCircle score={scores.transparency} label="Transparency" />
        <ScoreCircle score={scores.community} label="Community" />
        <ScoreCircle score={scores.verification} label="Verification" />
      </div>

      {/* Score Bars */}
      <div className="space-y-3">
        <ScoreBar label="Quality" value={scores.quality} />
        <ScoreBar label="Reliability" value={scores.reliability} />
        <ScoreBar label="Communication" value={scores.communication} />
        <ScoreBar label="Transparency" value={scores.transparency} />
        <ScoreBar label="Community" value={scores.community} />
        <ScoreBar label="Verification" value={scores.verification} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
        {[
          { label: "Total Campaigns", value: stats.totalCampaigns || 0 },
          { label: "Completed", value: stats.completedCampaigns || 0 },
          {
            label: "Total Raised",
            value: `₹${Number(stats.totalRaised || 0).toLocaleString("en-IN")}`,
          },
          { label: "Donors Served", value: stats.totalDonorsServed || 0 },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

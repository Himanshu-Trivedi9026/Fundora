/**
 * EscrowCard — Displays an escrow account summary for a campaign.
 *
 * Shows status badge, balance breakdown, fees, and earnings.
 */

import { useState } from "react";
import { motion } from "framer-motion";

const STATUS_STYLES = {
  created: { bg: "bg-gray-700", text: "text-gray-300", label: "Created" },
  active: { bg: "bg-green-900/40", text: "text-green-400", label: "Active" },
  partially_released: {
    bg: "bg-blue-900/40",
    text: "text-blue-400",
    label: "Partially Released",
  },
  fully_released: {
    bg: "bg-emerald-900/40",
    text: "text-emerald-400",
    label: "Fully Released",
  },
  refunded: {
    bg: "bg-yellow-900/40",
    text: "text-yellow-400",
    label: "Refunded",
  },
  cancelled: { bg: "bg-red-900/40", text: "text-red-400", label: "Cancelled" },
  closed: { bg: "bg-gray-800", text: "text-gray-500", label: "Closed" },
};

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function EscrowCard({ escrow }) {
  const [expanded, setExpanded] = useState(false);

  if (!escrow) return null;

  const status = STATUS_STYLES[escrow.status] || STATUS_STYLES.created;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">₹</span>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Escrow Account</h3>
            <p className="text-gray-500 text-xs">
              Campaign: {escrow.campaign_id?.substring(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {escrow.frozen && (
            <span className="px-2 py-1 rounded-full bg-red-900/40 text-red-400 text-xs font-medium">
              🔒 Frozen
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Total Donated</p>
          <p className="text-white font-bold text-lg">
            {formatCurrency(escrow.total_donated)}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Locked Balance</p>
          <p className="text-yellow-400 font-bold text-lg">
            {formatCurrency(escrow.locked_balance)}
          </p>
        </div>
      </div>

      {/* Expand Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-gray-400 text-xs hover:text-gray-300 transition-colors py-2 border-t border-gray-800"
        aria-expanded={expanded}
      >
        {expanded ? "Show less ▲" : "Show details ▼"}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-3 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Released</p>
              <p className="text-green-400 font-semibold">
                {formatCurrency(escrow.released_balance)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Refunded</p>
              <p className="text-orange-400 font-semibold">
                {formatCurrency(escrow.refunded_balance)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Platform Fees</p>
              <p className="text-purple-400 font-semibold">
                {formatCurrency(escrow.platform_fees)}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Creator Earnings</p>
              <p className="text-blue-400 font-semibold">
                {formatCurrency(escrow.creator_earnings)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
            <span>Fee: {escrow.fee_percentage}%</span>
            <span>ID: {escrow.id?.substring(0, 8)}...</span>
          </div>

          {escrow.frozen && escrow.frozen_reason && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
              <p className="text-red-400 text-xs font-medium">Freeze Reason</p>
              <p className="text-red-300 text-sm mt-1">
                {escrow.frozen_reason}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

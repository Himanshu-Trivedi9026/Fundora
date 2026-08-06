/**
 * LedgerTable — Displays immutable escrow ledger entries.
 *
 * Shows date, type badge, amount (+/-), description, and running balance.
 */

import { motion } from "framer-motion";

const ENTRY_TYPES = {
  donation: {
    bg: "bg-green-900/40",
    text: "text-green-400",
    label: "Donation",
    icon: "💰",
  },
  refund: {
    bg: "bg-orange-900/40",
    text: "text-orange-400",
    label: "Refund",
    icon: "↩️",
  },
  release: {
    bg: "bg-blue-900/40",
    text: "text-blue-400",
    label: "Release",
    icon: "📤",
  },
  milestone_release: {
    bg: "bg-indigo-900/40",
    text: "text-indigo-400",
    label: "Milestone Release",
    icon: "🎯",
  },
  fee: {
    bg: "bg-purple-900/40",
    text: "text-purple-400",
    label: "Fee",
    icon: "💸",
  },
  adjustment: {
    bg: "bg-gray-700",
    text: "text-gray-300",
    label: "Adjustment",
    icon: "⚖️",
  },
  chargeback: {
    bg: "bg-red-900/40",
    text: "text-red-400",
    label: "Chargeback",
    icon: "🔄",
  },
  payout: {
    bg: "bg-cyan-900/40",
    text: "text-cyan-400",
    label: "Payout",
    icon: "🏦",
  },
};

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  const isNegative = num < 0;
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(num));
  return isNegative ? `-${formatted}` : `+${formatted}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LedgerTable({
  entries = [],
  total = 0,
  onPageChange,
  currentPage = 1,
}) {
  const totalPages = Math.ceil(total / 50);

  if (!entries.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No ledger entries found</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">Transaction Ledger</h3>
        <p className="text-gray-500 text-xs mt-1">
          {total} entries • Append-only
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">
                Date
              </th>
              <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">
                Type
              </th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">
                Amount
              </th>
              <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">
                Description
              </th>
              <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">
                Balance After
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const type =
                ENTRY_TYPES[entry.entry_type] || ENTRY_TYPES.adjustment;
              const isCredit = ["donation"].includes(entry.entry_type);

              return (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-5 py-3 text-gray-300 text-sm whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${type.bg} ${type.text}`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono text-sm font-medium ${isCredit ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(entry.amount)}
                  </td>
                  <td
                    className="px-5 py-3 text-gray-400 text-sm max-w-[200px] truncate"
                    title={entry.description}
                  >
                    {entry.description}
                  </td>
                  <td className="px-5 py-3 text-right text-white font-mono text-sm">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 0,
                    }).format(parseFloat(entry.balance_after) || 0)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-500 text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

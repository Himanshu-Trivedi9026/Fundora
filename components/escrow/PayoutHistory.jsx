/**
 * PayoutHistory — Displays creator's payout request history.
 */

import { motion } from "framer-motion";

const STATUS_STYLES = {
  draft: { bg: "bg-gray-700", text: "text-gray-300", label: "Draft" },
  pending: {
    bg: "bg-yellow-900/40",
    text: "text-yellow-400",
    label: "Pending",
  },
  processing: {
    bg: "bg-blue-900/40",
    text: "text-blue-400",
    label: "Processing",
  },
  completed: {
    bg: "bg-green-900/40",
    text: "text-green-400",
    label: "Completed",
  },
  failed: { bg: "bg-red-900/40", text: "text-red-400", label: "Failed" },
  cancelled: { bg: "bg-gray-800", text: "text-gray-500", label: "Cancelled" },
};

const PRIORITY_STYLES = {
  low: "text-gray-500",
  normal: "text-gray-300",
  high: "text-yellow-400",
  urgent: "text-red-400",
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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PayoutHistory({ requests = [] }) {
  if (!requests.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No payout history</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">Payout History</h3>
      </div>

      <div className="divide-y divide-gray-800/50">
        {requests.map((req, idx) => {
          const status = STATUS_STYLES[req.status] || STATUS_STYLES.draft;
          const priority =
            PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.normal;

          return (
            <motion.div
              key={req.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.03 }}
              className="px-5 py-4 hover:bg-gray-800/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                  >
                    {status.label}
                  </span>
                  {req.priority && req.priority !== "normal" && (
                    <span className={`text-xs font-medium ${priority}`}>
                      {req.priority.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 text-xs">
                  {formatDate(req.created_at)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-xs">Amount</p>
                  <p className="text-white font-semibold">
                    {formatCurrency(req.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Fee</p>
                  <p className="text-orange-400 font-semibold">
                    {formatCurrency(req.fee_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Net Amount</p>
                  <p className="text-green-400 font-semibold">
                    {formatCurrency(req.net_amount)}
                  </p>
                </div>
              </div>

              {req.completed_at && (
                <p className="text-gray-500 text-xs mt-2">
                  Completed: {formatDate(req.completed_at)}
                </p>
              )}
              {req.failed_at && (
                <p className="text-red-400 text-xs mt-2">
                  Failed: {formatDate(req.failed_at)}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";

/**
 * BankAccountCard — Displays a single bank account with masked details.
 *
 * @param {Object} props
 * @param {Object} props.account — Bank account record
 * @param {Function} props.onSetPrimary — Callback to set as primary
 * @param {Function} props.onRemove — Callback to remove account
 * @param {Function} props.onVerify — Callback to initiate penny drop
 */
export default function BankAccountCard({ account, onSetPrimary, onRemove, onVerify }) {
  const statusColors = {
    verified: "success",
    pending: "warning",
    rejected: "danger",
    draft: "on-surface-variant",
  };
  const statusColor = statusColors[account.status] || "on-surface-variant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border transition-colors ${
        account.is_primary ? "border-primary/20 bg-primary/5" : "border-white/5 bg-surface-container-high/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">account_balance</span>
          <span className="text-sm font-semibold text-on-surface">{account.bank_name || "Bank Account"}</span>
          {account.is_primary && (
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">Primary</span>
          )}
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-${statusColor}/10 text-${statusColor}`}>
          {account.status}
        </span>
      </div>

      <div className="text-xs text-on-surface-variant font-inter space-y-1">
        <p>{account.account_type || "Savings"} • {account.account_holder_name || "—"}</p>
        {account.penny_drop_status && (
          <p>
            Penny Drop:{" "}
            <span className={account.penny_drop_status === "success" ? "text-success" : ""}>
              {account.penny_drop_status}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {account.status === "draft" && onVerify && (
          <button
            onClick={() => onVerify(account.id)}
            className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-inter font-medium hover:bg-primary/20 transition-colors"
          >
            Verify
          </button>
        )}
        {account.status === "verified" && !account.is_primary && onSetPrimary && (
          <button
            onClick={() => onSetPrimary(account.id)}
            className="px-3 py-1 rounded-lg bg-surface-container-high/50 text-on-surface-variant text-xs font-inter font-medium hover:bg-surface-container-high transition-colors"
          >
            Set Primary
          </button>
        )}
        {onRemove && account.status !== "verified" && (
          <button
            onClick={() => onRemove(account.id)}
            className="px-3 py-1 rounded-lg bg-danger/10 text-danger text-xs font-inter font-medium hover:bg-danger/20 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </motion.div>
  );
}

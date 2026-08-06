import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACTIONS = {
  approve: {
    label: "Approve",
    icon: "check_circle",
    color: "text-success",
    bg: "bg-success",
    hoverBg: "hover:bg-success/90",
    lightBg: "bg-success-muted",
    border: "border-success/20",
  },
  reject: {
    label: "Reject",
    icon: "cancel",
    color: "text-danger",
    bg: "bg-danger",
    hoverBg: "hover:bg-danger/90",
    lightBg: "bg-danger-muted",
    border: "border-danger/20",
  },
  resubmit: {
    label: "Request More Docs",
    icon: "replay",
    color: "text-warning",
    bg: "bg-warning",
    hoverBg: "hover:bg-warning/90",
    lightBg: "bg-warning-muted",
    border: "border-warning/20",
  },
  suspend: {
    label: "Suspend",
    icon: "pause_circle",
    color: "text-on-surface-variant",
    bg: "bg-on-surface-variant",
    hoverBg: "hover:bg-on-surface-variant/90",
    lightBg: "bg-surface-container-high",
    border: "border-outline-variant/30",
  },
};

/**
 * DecisionPanel — Approve/reject/resubmit panel with notes and confirmation.
 *
 * Props:
 *   onApprove  — (notes: string) => void
 *   onReject   — (reason: string) => void
 *   onResubmit — (reason: string) => void
 *   onSuspend  — (reason: string) => void
 *   loading    — boolean
 *   disabled   — boolean
 */
export default function DecisionPanel({
  onApprove,
  onReject,
  onResubmit,
  onSuspend,
  loading = false,
  disabled = false,
}) {
  const [notes, setNotes] = useState("");
  const [activeAction, setActiveAction] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const isDisabled = loading || disabled;

  const handleActionClick = (action) => {
    if (isDisabled) return;
    setActiveAction(action);
    setConfirming(true);
  };

  const handleConfirm = () => {
    if (!activeAction) return;

    const value = notes.trim();
    if (activeAction === "approve") {
      onApprove?.(value);
    } else if (activeAction === "reject") {
      onReject?.(value);
    } else if (activeAction === "resubmit") {
      onResubmit?.(value);
    } else if (activeAction === "suspend") {
      onSuspend?.(value);
    }

    setConfirming(false);
    setActiveAction(null);
  };

  const handleCancel = () => {
    setConfirming(false);
    setActiveAction(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[20px] text-primary">
            gavel
          </span>
        </div>
        <div>
          <h3 className="text-sm text-on-surface font-inter font-medium">
            Review Decision
          </h3>
          <p className="text-[10px] text-on-surface-variant/50 font-inter">
            Approve, reject, request more documents, or suspend
          </p>
        </div>
      </div>

      {/* Notes textarea */}
      <div>
        <label
          htmlFor="decision-notes"
          className="block text-[11px] text-on-surface-variant/60 font-inter mb-1.5"
        >
          Notes / Reason (optional)
        </label>
        <textarea
          id="decision-notes"
          rows={3}
          maxLength={500}
          disabled={isDisabled}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about your decision..."
          className="w-full rounded-lg bg-surface-container-high border border-outline-variant/50 px-3 py-2.5 text-sm text-on-surface font-inter placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-none transition-colors disabled:opacity-50"
        />
        <p className="text-[10px] text-on-surface-variant/40 font-inter text-right mt-1">
          {notes.length}/500
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ACTIONS).map(([key, config]) => (
          <motion.button
            key={key}
            whileHover={!isDisabled ? { scale: 1.02 } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            disabled={isDisabled}
            onClick={() => handleActionClick(key)}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-inter text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${config.bg} text-white ${config.hoverBg} shadow-sm`}
            aria-label={config.label}
          >
            <span className="material-symbols-outlined text-[18px]">
              {config.icon}
            </span>
            {config.label}
          </motion.button>
        ))}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="material-symbols-outlined text-[16px] text-primary animate-spin">
            progress_activity
          </span>
          <span className="text-xs text-on-surface-variant font-inter">
            Processing decision...
          </span>
        </div>
      )}

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirming && activeAction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`rounded-lg border p-4 space-y-3 ${ACTIONS[activeAction].lightBg} ${ACTIONS[activeAction].border}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[18px] ${ACTIONS[activeAction].color}`}
                >
                  {ACTIONS[activeAction].icon}
                </span>
                <p
                  className={`text-sm font-inter font-medium ${ACTIONS[activeAction].color}`}
                >
                  Confirm {ACTIONS[activeAction].label}
                </p>
              </div>
              <p className="text-xs text-on-surface-variant font-inter">
                Are you sure you want to {activeAction} this verification?
                {notes.trim() && (
                  <span className="block mt-1 text-on-surface-variant/60">
                    Your note: &ldquo;{notes.trim()}&rdquo;
                  </span>
                )}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface-variant font-inter text-xs hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-3 py-1.5 rounded-lg text-white font-inter text-xs font-medium ${ACTIONS[activeAction].bg} ${ACTIONS[activeAction].hoverBg} transition-colors`}
                >
                  Confirm {ACTIONS[activeAction].label}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

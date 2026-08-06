import { motion } from "framer-motion";

/**
 * PendingActions — List of pending verification actions.
 *
 * @param {Object} props
 * @param {Array} props.actions — Array of {type, label, icon}
 * @param {Function} props.onActionClick — Callback with action type
 */
export default function PendingActions({ actions = [], onActionClick }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-geist text-sm font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-warning text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            pending_actions
          </span>
          Pending Actions
        </h3>
        <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-bold">
          {actions.length}
        </span>
      </div>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <motion.button
            key={`${action.type}-${i}`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onActionClick?.(action.type)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container-high/30 border border-white/5 hover:border-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-warning text-[16px]">{action.icon}</span>
            <span className="text-sm font-inter text-on-surface flex-1">{action.label}</span>
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

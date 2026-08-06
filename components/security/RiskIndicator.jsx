import { motion } from "framer-motion";

/**
 * RiskIndicator — Displays risk score with visual indicator.
 *
 * Props:
 *   score    — 0-100 risk score (higher = more risk)
 *   compact  — boolean, compact mode for sidebar (default: false)
 *   className — additional classes
 */
export default function RiskIndicator({
  score = 0,
  compact = false,
  className = "",
}) {
  // Inverse color: low risk = good (green), high risk = bad (red)
  const getColor = (s) => {
    if (s <= 20)
      return { text: "text-success", bg: "bg-success", label: "Low Risk" };
    if (s <= 40)
      return { text: "text-primary", bg: "bg-primary", label: "Moderate" };
    if (s <= 60)
      return { text: "text-warning", bg: "bg-warning", label: "Elevated" };
    return { text: "text-danger", bg: "bg-danger", label: "High Risk" };
  };

  const colors = getColor(score);

  if (compact) {
    return (
      <div className={`text-center space-y-1 ${className}`}>
        <div className={`text-lg font-bold ${colors.text}`}>{score}</div>
        <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest font-inter">
          Risk Score
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel p-4 rounded-xl border border-white/5 space-y-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[16px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          shield
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-inter">
          Risk Assessment
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-end gap-3">
          <div className={`text-3xl font-bold font-geist ${colors.text}`}>
            {score}
          </div>
          <div className="text-xs text-on-surface-variant pb-1">/100</div>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}
        >
          {colors.label}
        </span>
      </div>

      <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colors.bg} rounded-full`}
        />
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";

/**
 * TrustScoreCard — Displays trust score with visual indicator.
 *
 * Props:
 *   score    — 0-100 trust score
 *   compact  — boolean, compact mode for sidebar (default: false)
 *   className — additional classes
 */
export default function TrustScoreCard({ score = 0, compact = false, className = "" }) {
  // Color based on score
  const getColor = (s) => {
    if (s >= 80) return { text: "text-success", bg: "bg-success", ring: "ring-success/20" };
    if (s >= 60) return { text: "text-primary", bg: "bg-primary", ring: "ring-primary/20" };
    if (s >= 40) return { text: "text-warning", bg: "bg-warning", ring: "ring-warning/20" };
    return { text: "text-danger", bg: "bg-danger", ring: "ring-danger/20" };
  };

  const colors = getColor(score);

  if (compact) {
    return (
      <div className={`text-center space-y-1 ${className}`}>
        <div className={`text-lg font-bold ${colors.text}`}>{score}</div>
        <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest font-inter">
          Trust Score
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
        <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
          thumb_up
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-inter">
          Trust Score
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div className={`text-3xl font-bold font-geist ${colors.text}`}>{score}</div>
        <div className="text-xs text-on-surface-variant pb-1">/100</div>
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

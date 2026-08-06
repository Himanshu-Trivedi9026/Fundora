import { motion } from "framer-motion";

/**
 * FundingProgress — Animated progress bar with funding stats.
 */
export default function FundingProgress({
  totalRaised,
  goal,
  progress,
  donorCount,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card p-6 rounded-xl space-y-4"
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-on-surface font-geist">
            ₹{totalRaised.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-on-surface-variant font-inter mt-1">
            Raised
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-primary font-geist">
            ₹{goal.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-on-surface-variant font-inter mt-1">
            Goal
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-on-surface font-geist">
            {donorCount}
          </p>
          <p className="text-xs text-on-surface-variant font-inter mt-1">
            Backers
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/[0.06] h-2.5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: 1.2,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.3,
          }}
          className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Funding progress"
        />
      </div>

      <p className="text-xs text-on-surface-variant/60 text-right font-inter">
        {Math.round(progress)}% of goal reached
      </p>
    </motion.div>
  );
}

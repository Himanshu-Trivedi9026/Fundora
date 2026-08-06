import { motion } from "framer-motion";

/**
 * RewardTierCard — Glass-card tier with select state, metadata, amount.
 */
export default function RewardTierCard({ tier, selected, onSelect }) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={`w-full text-left glass-card p-6 rounded-xl cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-200 ${
        selected
          ? "border-primary !bg-primary/5 shadow-glow"
          : "hover:border-white/[0.12]"
      }`}
    >
      {/* Left content */}
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-on-surface font-geist">
            {tier.title}
          </span>
          {tier.badge && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-bold rounded font-inter">
              {tier.badge}
            </span>
          )}
        </div>
        <p className="text-on-surface-variant text-sm font-inter">
          {tier.desc}
        </p>
        <div className="flex items-center gap-4 mt-3">
          {tier.deliveryDate && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant font-inter">
              <span className="material-symbols-outlined text-sm">
                schedule
              </span>
              {tier.deliveryDate}
            </span>
          )}
          {tier.backers !== undefined && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant font-inter">
              <span className="material-symbols-outlined text-sm">group</span>
              {tier.backers} Backers
            </span>
          )}
        </div>
      </div>

      {/* Right amount */}
      <div className="text-right shrink-0">
        <div className="text-2xl font-bold text-primary font-geist">
          ₹{tier.amount.toLocaleString("en-IN")}
        </div>
        <div className="text-xs text-on-surface-variant font-inter">
          Minimum Contribution
        </div>
      </div>

      {/* Selection indicator */}
      {selected && (
        <motion.div
          layoutId="selectedTierIndicator"
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

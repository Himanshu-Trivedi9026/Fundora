import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";

/**
 * StatCard — glass card with animated counter.
 * icon: Material Symbol name string.
 */
export default function StatCard({ icon, value, label, prefix, suffix, decimals, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.03, y: -4 }}
      className="glass-card p-5 rounded-xl flex flex-col items-center justify-center text-center
                 border border-white/[0.06] hover:border-primary/20 transition-colors"
    >
      <span
        className="material-symbols-outlined text-primary text-2xl mb-2"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <AnimatedCounter
        end={value}
        prefix={prefix}
        suffix={suffix}
        decimals={decimals}
        className="font-geist text-3xl font-bold text-on-surface"
      />
      <span className="text-on-surface-variant text-xs mt-1 font-inter">{label}</span>
    </motion.div>
  );
}

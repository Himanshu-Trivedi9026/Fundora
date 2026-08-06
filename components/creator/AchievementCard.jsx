import { motion } from "framer-motion";

/**
 * AchievementCard — glass card for achievement badges.
 */
export default function AchievementCard({
  icon,
  title,
  description,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className="glass-card p-5 rounded-xl border border-white/[0.06] hover:border-primary/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-geist text-base font-semibold text-on-surface mb-1">
            {title}
          </h4>
          <p className="text-on-surface-variant text-sm font-inter leading-relaxed">
            {description}
          </p>
        </div>
        <span
          className="material-symbols-outlined text-3xl text-primary shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
    </motion.div>
  );
}

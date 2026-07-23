import { motion } from "framer-motion";
import AchievementCard from "./AchievementCard";
import { staggerContainer, staggerItem } from "./SectionReveal";

/**
 * AchievementsBento — 2-column bento grid of AchievementCards.
 */
export default function AchievementsBento({ achievements }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      <motion.h2 variants={staggerItem} className="text-lg font-semibold text-on-surface font-geist mb-4">
        Achievements
      </motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {achievements.map((a, i) => (
          <AchievementCard
            key={a.title}
            icon={a.icon}
            title={a.title}
            description={a.description}
            delay={i * 0.1}
          />
        ))}
      </div>
    </motion.div>
  );
}

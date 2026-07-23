import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "./SectionReveal";

/**
 * SidebarAbout — About section with bio and achievement badge pills.
 */
export default function SidebarAbout({ bio, achievements = [] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className="glass-card p-5 rounded-xl"
    >
      <motion.h3 variants={staggerItem} className="font-geist text-lg font-semibold text-on-surface mb-3">
        About
      </motion.h3>

      <motion.p variants={staggerItem} className="text-on-surface-variant text-sm font-inter leading-relaxed mb-4">
        {bio || "This creator hasn't added a bio yet."}
      </motion.p>

      {achievements.length > 0 && (
        <>
          <div className="border-t border-white/[0.06] my-4" />
          <motion.h4 variants={staggerItem} className="font-geist text-sm font-medium text-on-surface-variant mb-3">
            Badges
          </motion.h4>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <motion.div
                key={a.title}
                variants={staggerItem}
                whileHover={{ scale: 1.05, y: -1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                           bg-primary/10 border border-primary/20
                           hover:bg-primary/15 transition-colors cursor-default"
              >
                <span
                  className="material-symbols-outlined text-sm text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {a.icon}
                </span>
                <span className="text-xs text-primary font-inter font-medium">
                  {a.title}
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "../creator/SectionReveal";

/**
 * TrustIndicators — Verified Project + Payment Protection trust badges.
 */
export default function TrustIndicators() {
  const indicators = [
    {
      icon: "verified",
      title: "Verified Project",
      desc: "Project team passed due diligence review.",
    },
    {
      icon: "security",
      title: "Payment Protection",
      desc: "Funds held in escrow until milestones are met.",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="flex flex-col gap-3"
    >
      {indicators.map((item) => (
        <motion.div
          key={item.title}
          variants={staggerItem}
          className="flex items-center gap-3 p-4 bg-surface-container rounded-xl"
        >
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {item.icon}
          </span>
          <div className="text-xs">
            <p className="font-bold text-on-surface font-inter">{item.title}</p>
            <p className="text-on-surface-variant font-inter">{item.desc}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

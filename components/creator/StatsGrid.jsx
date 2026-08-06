import { motion } from "framer-motion";
import StatCard from "./StatCard";
import { staggerContainer, staggerItem } from "./SectionReveal";

/**
 * StatsGrid — 3-column stat cards with stagger entrance.
 */
export default function StatsGrid({ totalRaised, projectCount, backersCount }) {
  const stats = [
    {
      icon: "payments",
      value: totalRaised,
      prefix: "₹",
      label: "Total Raised",
    },
    { icon: "rocket_launch", value: projectCount, label: "Projects Launched" },
    { icon: "group", value: backersCount, label: "Backers" },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {stats.map((s, i) => (
        <StatCard
          key={s.label}
          icon={s.icon}
          value={s.value}
          prefix={s.prefix}
          label={s.label}
          delay={i * 0.1}
        />
      ))}
    </motion.div>
  );
}

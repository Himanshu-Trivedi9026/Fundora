import { useRef } from "react";
import { motion, useInView } from "framer-motion";

function AnimatedNumber({ value, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.span
      ref={ref}
      className="font-geist text-4xl md:text-5xl font-bold text-primary"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      {prefix}{value}{suffix}
    </motion.span>
  );
}

const stats = [
  { value: "$2.4B+", label: "Capital Raised" },
  { value: "156", label: "Unicorns Minted" },
  { value: "890k", label: "Global Investors" },
  { value: "99.2%", label: "AI Accuracy" },
];

/**
 * StatsBar — Horizontal stat counter bar.
 */
export default function StatsBar() {
  return (
    <section className="py-12 border-y border-white/[0.06] bg-surface-container-lowest/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label} className="space-y-2">
            <AnimatedNumber value={s.value} />
            <p className="font-inter text-xs text-on-surface-variant uppercase tracking-widest">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * HeroSection — Full-screen hero with typing animation, gradient title, CTA, dashboard preview.
 */
export default function HeroSection() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const fullText = "Where AI Meets Venture";

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTyped(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-16 py-24 overflow-hidden">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto z-10"
      >
        {/* Badge */}
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
          <span className="font-inter text-xs text-primary uppercase tracking-wider font-medium">
            AI Evolution in Venture
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1 variants={fadeUp} className="font-geist text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="block text-on-surface">Fundora</span>
          <span className="block bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
            {typed}
            <span className="border-r-2 border-primary animate-pulse ml-0.5">&nbsp;</span>
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          variants={fadeUp}
          className="text-on-surface-variant font-inter text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          The world&apos;s first AI-powered crowdfunding platform for unicorn startups.
          We bridge the gap between visionary founders and sophisticated investors using predictive intelligence.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/create")}
            className="w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-lg font-geist text-lg font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Start Project
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/explore")}
            className="w-full sm:w-auto border border-outline-variant bg-surface-container-low text-on-surface px-8 py-4 rounded-lg font-geist text-lg font-semibold hover:bg-surface-container transition-colors cursor-pointer"
          >
            Explore
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Dashboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="mt-24 relative w-full max-w-5xl mx-auto z-10"
      >
        <div className="glass-card p-4 rounded-xl border border-white/[0.06] shadow-2xl relative overflow-hidden group">
          <div className="w-full h-64 md:h-96 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden">
            {/* Placeholder dashboard visual */}
            <div className="w-full h-full bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-center space-y-4">
                <span className="material-symbols-outlined text-6xl text-primary/30">dashboard</span>
                <p className="text-on-surface-variant/40 font-inter text-sm">Dashboard Preview</p>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dim via-transparent to-transparent" />
        </div>

        {/* Floating Element */}
        <div
          className="absolute -top-12 -left-12 glass-card p-6 rounded-xl hidden lg:block shadow-xl"
          style={{ animation: "bounce 4s infinite" }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                insights
              </span>
            </div>
            <div>
              <p className="text-on-surface-variant font-inter text-xs">AI Prediction</p>
              <p className="text-on-surface font-geist text-lg font-bold">+342% ROI</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

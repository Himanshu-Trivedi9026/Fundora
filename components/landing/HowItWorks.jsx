import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * HowItWorks — Bento grid layout showing the platform ecosystem.
 */
export default function HowItWorks() {
  return (
    <section className="py-24 bg-surface-dim">
      <div className="max-w-6xl mx-auto px-4 md:px-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-geist text-3xl md:text-4xl font-bold text-on-surface mb-4">
            The Intelligent Ecosystem
          </h2>
          <p className="text-on-surface-variant font-inter max-w-xl mx-auto">
            Venture capital is no longer a guessing game. Our platform orchestrates the entire journey from due diligence to exit.
          </p>
        </div>

        {/* Bento Grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto md:h-[600px]"
        >
          {/* Card 1: AI Due Diligence (8 cols) */}
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.01 }}
            className="md:col-span-8 glass-card p-8 rounded-2xl flex flex-col justify-end relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-[200px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                psychology
              </span>
            </div>
            <h4 className="font-geist text-xl font-semibold text-on-surface mb-2">01. AI Due Diligence</h4>
            <p className="text-on-surface-variant font-inter mb-4">
              Our proprietary algorithms analyze 5,000+ data points including founder history, market velocity, and sentiment trends.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Sentiment Analysis", "Velocity Score", "Founder DNA"].map((pill) => (
                <span key={pill} className="bg-surface-container px-3 py-1 rounded text-xs font-inter border border-white/[0.06] text-on-surface-variant">
                  {pill}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Card 2: Secure Escrow (4 cols) */}
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.01 }}
            className="md:col-span-4 glass-card p-8 rounded-2xl bg-primary text-on-primary flex flex-col justify-between"
          >
            <div>
              <span className="material-symbols-outlined text-5xl mb-4 block" aria-hidden="true">verified_user</span>
              <h4 className="font-geist text-xl font-semibold mb-2">02. Secure Escrow</h4>
              <p className="opacity-80 font-inter text-sm">
                All capital is managed via smart-contract escrows, ensuring 100% transparency and goal-based fund release.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Syndicate Power (4 cols) */}
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.01 }}
            className="md:col-span-4 glass-card p-8 rounded-2xl flex flex-col items-center text-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">diversity_3</span>
            </div>
            <h4 className="font-geist text-xl font-semibold text-on-surface mb-2">03. Syndicate Power</h4>
            <p className="text-on-surface-variant font-inter text-sm">
              Join forces with top-tier VCs in exclusive institutional rounds.
            </p>
          </motion.div>

          {/* Card 4: Growth Intelligence (8 cols) */}
          <motion.div
            variants={fadeUp}
            whileHover={{ scale: 1.01 }}
            className="md:col-span-8 glass-card p-8 rounded-2xl flex items-center gap-8"
          >
            <div className="hidden sm:block shrink-0">
              <div className="w-32 h-32 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden">
                <span className="material-symbols-outlined text-4xl text-primary/30" aria-hidden="true">memory</span>
              </div>
            </div>
            <div>
              <h4 className="font-geist text-xl font-semibold text-on-surface mb-2">04. Growth Intelligence</h4>
              <p className="text-on-surface-variant font-inter">
                Post-funding, startups receive AI-driven strategic guidance to scale operations and optimize customer acquisition costs.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../lib/roles";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/**
 * HeroSection — Full-screen hero with typing animation, gradient title, CTA.
 */
export default function HeroSection() {
  const router = useRouter();
  const { user, role, loading } = useRole();
  const [typed, setTyped] = useState("");
  const fullText = "Where AI Meets Venture";

  /**
   * Role-aware CTA buttons derived from the RoleContext (single source of
   * truth: public.profiles.role). Guests get an onboarding path; signed-in
   * users get role-appropriate actions. `loading` keeps the block stable
   * until the session/role is resolved so we never flash a wrong CTA.
   */
  function getCtas() {
    if (loading) return [];

    if (!user) {
      return [
        { label: "Start Your Journey", href: "/get-started", primary: true },
        { label: "Explore Projects", href: "/explore", primary: false },
      ];
    }

    switch (role) {
      case ROLES.ADMIN:
        return [
          { label: "Admin Dashboard", href: "/admin/dashboard", primary: true },
          { label: "Explore Projects", href: "/explore", primary: false },
        ];
      case ROLES.CREATOR:
        return [
          { label: "Start Project", href: "/create", primary: true },
          { label: "Explore Projects", href: "/explore", primary: false },
        ];
      case ROLES.INVESTOR:
      default:
        return [
          { label: "Explore Projects", href: "/explore", primary: false },
          { label: "My Dashboard", href: "/investor/dashboard", primary: true },
        ];
    }
  }

  const ctas = getCtas();

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
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 md:px-16 py-12 md:py-16 overflow-hidden">
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
          <span
            className="material-symbols-outlined text-[18px] text-primary"
            aria-hidden="true"
          >
            auto_awesome
          </span>
          <span className="font-inter text-xs text-primary uppercase tracking-wider font-medium">
            AI Evolution in Venture
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={fadeUp}
          className="font-geist text-5xl md:text-7xl font-bold mb-6 leading-tight"
        >
          <span className="block text-on-surface">Fundora</span>
          <span
            className="block bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent"
            aria-label={fullText}
          >
            {typed}
            <span
              className="border-r-2 border-primary animate-pulse ml-0.5"
              aria-hidden="true"
            >
              &nbsp;
            </span>
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          variants={fadeUp}
          className="text-on-surface-variant font-inter text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          The world&apos;s first AI-powered crowdfunding platform for unicorn
          startups. We bridge the gap between visionary founders and
          sophisticated investors using predictive intelligence.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.8,
          }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          {ctas.map((cta) => (
            <button
              key={cta.label}
              type="button"
              onClick={() => {
                router.push(cta.href);
              }}
              className={
                cta.primary
                  ? "w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-lg font-geist text-lg font-semibold shadow-lg shadow-primary/20 hover:opacity-90 hover:scale-[1.05] active:scale-[0.95] transition-all duration-200 cursor-pointer"
                  : "w-full sm:w-auto border border-outline-variant bg-surface-container-low text-on-surface px-8 py-4 rounded-lg font-geist text-lg font-semibold hover:bg-surface-container hover:scale-[1.05] active:scale-[0.95] transition-all duration-200 cursor-pointer"
              }
            >
              {cta.label}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Platform Stats Preview — real data hint */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        className="mt-12 md:mt-16 relative w-full max-w-3xl mx-auto z-10"
      >
        <div className="glass-card p-6 rounded-xl border border-white/[0.06] shadow-2xl">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="space-y-1">
              <span
                className="material-symbols-outlined text-primary text-2xl"
                aria-hidden="true"
              >
                rocket_launch
              </span>
              <p className="font-geist text-lg font-bold text-on-surface">
                Launch
              </p>
              <p className="text-on-surface-variant font-inter text-xs">
                AI-powered project creation
              </p>
            </div>
            <div className="space-y-1">
              <span
                className="material-symbols-outlined text-primary text-2xl"
                aria-hidden="true"
              >
                trending_up
              </span>
              <p className="font-geist text-lg font-bold text-on-surface">
                Fund
              </p>
              <p className="text-on-surface-variant font-inter text-xs">
                Intelligent crowdfunding
              </p>
            </div>
            <div className="space-y-1">
              <span
                className="material-symbols-outlined text-primary text-2xl"
                aria-hidden="true"
              >
                insights
              </span>
              <p className="font-geist text-lg font-bold text-on-surface">
                Scale
              </p>
              <p className="text-on-surface-variant font-inter text-xs">
                Data-driven growth
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

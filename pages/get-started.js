import { useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import Link from "next/link";
import SEO from "../components/SEO";
import Footer from "../components/Footer";
import { useRole } from "../context/RoleContext";
import { roleHome } from "../lib/roles";

/* ─── Animation Variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/**
 * GetStarted — Landing-page role-selection screen.
 *
 * Entry point reached from the hero "Start Your Journey" CTA. Presents the two
 * Fundora paths (Investor / Creator) to guests. Authenticated users are
 * redirected to their role home instead (roleHome from lib/roles).
 */
export default function GetStarted() {
  const router = useRouter();
  const { user, role, loading } = useRole();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace(roleHome(role));
  }, [loading, user, role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <main className="flex-1 flex items-center justify-center">
          <div role="status" aria-label="Loading" className="text-on-surface-variant text-lg">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (user) return null;

  const roles = [
    {
      key: "investor",
      emoji: "📈",
      title: "I'm an Investor",
      description: "I want to discover and fund innovative startups.",
      buttonLabel: "Continue as Investor",
      href: "/signup?role=donor",
    },
    {
      key: "creator",
      emoji: "🚀",
      title: "I'm a Creator",
      description: "I want to build and raise funds for my startup.",
      buttonLabel: "Continue as Creator",
      href: "/signup?role=creator",
    },
  ];

  return (
    <>
      <SEO
        title="Get Started"
        description="Choose your path on Fundora — invest in the next unicorn or launch your own AI-powered campaign."
        url="/get-started"
        noindex={true}
      />
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative">
          {/* ─── Mesh Accent ─── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/[0.04] rounded-full blur-[120px]" />
            <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-primary-container/[0.03] rounded-full blur-[100px]" />
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="w-full max-w-3xl relative z-10"
          >
            {/* ─── Header ─── */}
            <motion.div variants={fadeUp} className="flex flex-col items-center mb-12 text-center">
              <div className="mb-6 p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  explore
                </span>
              </div>

              <h1 className="font-geist text-4xl md:text-5xl font-bold tracking-tight text-on-surface mb-3">
                Choose how you want to join Fundora
              </h1>
              <p className="font-inter text-base text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Pick the path that fits your goals. You can explore the other
                side anytime after signing up.
              </p>
            </motion.div>

            {/* ─── Role Cards ─── */}
            <div className="grid sm:grid-cols-2 gap-6">
              {roles.map((r) => (
                <motion.button
                  key={r.key}
                  type="button"
                  variants={fadeUp}
                  onClick={() => router.push(r.href)}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.98 }}
                  className="group text-left relative rounded-3xl overflow-hidden p-8 flex flex-col cursor-pointer
                    transition-colors duration-300 hover:border-primary/40"
                  style={{
                    background: "rgba(27, 27, 30, 0.6)",
                    backdropFilter: "blur(24px) saturate(1.2)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                    border: "1px solid rgba(73, 68, 84, 0.3)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Top gradient accent line */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-all duration-300 group-hover:w-full group-hover:via-primary" />

                  {/* Emoji icon tile — scales on hover */}
                  <div className="mb-6 p-4 rounded-2xl w-fit bg-surface-container-high border border-outline-variant/30 text-3xl transition-all duration-300 group-hover:bg-primary/10 group-hover:scale-110 group-hover:-rotate-6">
                    <span role="img" aria-hidden="true">{r.emoji}</span>
                  </div>

                  <h2 className="font-geist text-2xl font-bold text-on-surface mb-2">
                    {r.title}
                  </h2>
                  <p className="font-inter text-sm text-on-surface-variant leading-relaxed mb-8 flex-1">
                    {r.description}
                  </p>

                  {/* Visual CTA pill — the whole card is the clickable target */}
                  <span className="inline-flex items-center justify-center gap-2 font-geist text-sm font-semibold
                    px-6 py-3 rounded-full bg-primary text-on-primary
                    shadow-lg shadow-primary/20
                    transition-all duration-300 group-hover:shadow-primary/40 group-hover:brightness-110
                    w-full sm:w-auto"
                  >
                    {r.buttonLabel}
                    <span className="transition-transform duration-300 group-hover:translate-x-1"><ArrowIcon /></span>
                  </span>
                </motion.button>
              ))}
            </div>

            {/* ─── Existing account link ─── */}
            <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4 text-center">
              <p className="font-inter text-sm text-on-surface-variant">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 ml-1 px-5 py-2.5 rounded-full border border-outline-variant/40 bg-surface-container-low text-on-surface
                    font-geist text-sm font-semibold
                    hover:border-primary/50 hover:bg-surface-container hover:text-on-surface
                    transition-all duration-200"
                >
                  Log In
                  <ArrowIcon />
                </Link>
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 mt-1 font-inter text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span aria-hidden="true">&larr;</span> Back to home
              </Link>
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
}

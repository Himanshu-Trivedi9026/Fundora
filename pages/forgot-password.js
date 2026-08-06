import { useState, useRef, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

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

/* ─── SVG Icons ─── */
function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Input Component ─── */
const FormInput = forwardRef(function FormInput({ id, label, type, placeholder, value, onChange, icon: Icon }, ref) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="font-geist text-xs font-medium text-on-surface-variant uppercase tracking-widest px-1"
      >
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors duration-300 group-focus-within:text-primary">
          <Icon />
        </div>
        <input
          ref={ref}
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete="email"
          className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl py-3.5 pl-12 pr-4 font-inter text-sm text-on-surface placeholder:text-outline/40 transition-all duration-300 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
        />
      </div>
    </div>
  );
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <>
      <SEO
        title="Forgot Password"
        description="Reset your Fundora account password. Enter your email and we'll send you a secure reset link."
        url="/forgot-password"
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
            className="w-full max-w-md relative z-10"
          >
            {/* ─── Brand Identity ─── */}
            <motion.div variants={fadeUp} className="flex flex-col items-center mb-10 text-center">
              <div className="mb-6 p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  lock_reset
                </span>
              </div>
              <h1 className="font-geist text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-2">
                Reset your password
              </h1>
              <p className="font-inter text-base text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Enter your account email and we&apos;ll send you a secure link to set a new password.
              </p>
            </motion.div>

            {/* ─── Glass Card ─── */}
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: "rgba(27, 27, 30, 0.6)",
                backdropFilter: "blur(24px) saturate(1.2)",
                WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                border: "1px solid rgba(73, 68, 84, 0.3)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              <div className="p-8 md:p-10">
                {/* Header */}
                <div className="mb-8">
                  <h2 className="font-geist text-2xl font-bold text-on-surface mb-1.5">
                    Forgot password
                  </h2>
                  <p className="font-inter text-sm text-on-surface-variant">
                    We&apos;ll email you a secure reset link.
                  </p>
                </div>

                {/* Form */}
                {!sent ? (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          className="overflow-hidden"
                          role="alert"
                          aria-live="polite"
                        >
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-muted border border-danger/20">
                            <span className="material-symbols-outlined text-danger text-[18px]" aria-hidden="true">error</span>
                            <p className="text-danger text-sm font-inter">{error}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email */}
                    <FormInput
                      id="forgot-email"
                      label="Email Address"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      icon={MailIcon}
                      ref={emailRef}
                    />

                    {/* Submit */}
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.01 }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      className="w-full bg-primary-container text-on-primary-container font-geist text-base font-semibold
                        py-4 rounded-xl mt-2 flex items-center justify-center gap-2.5
                        hover:brightness-110 transition-all duration-200 cursor-pointer
                        disabled:opacity-60 disabled:cursor-not-allowed
                        shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-on-primary-container/30 border-t-on-primary-container rounded-full animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Send reset link</span>
                          <ArrowIcon />
                        </>
                      )}
                    </motion.button>
                  </form>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="sent"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-4 py-6 text-center"
                      role="status"
                    >
                      <div className="w-14 h-14 rounded-full bg-success-muted border border-success/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-success text-[28px]" aria-hidden="true">mark_email_read</span>
                      </div>
                      <p className="text-on-surface font-inter text-sm leading-relaxed max-w-xs">
                        If an account exists for <span className="text-on-surface font-medium">{email}</span>, a password reset link is on its way. Check your inbox.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSent(false)}
                        className="text-primary hover:text-primary/80 font-inter text-sm font-medium transition-colors"
                      >
                        Use a different email
                      </button>
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Back to login */}
                <div className="mt-8 pt-6 border-t border-outline-variant/20 text-center">
                  <p className="font-inter text-sm text-on-surface-variant">
                    Remembered it?{" "}
                    <Link
                      href="/login"
                      className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 transition-colors"
                    >
                      Back to login
                    </Link>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
}

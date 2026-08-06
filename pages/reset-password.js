import { useState, useRef, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/router";
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
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

/* ─── Input Component (with password visibility toggle) ─── */
const FormInput = forwardRef(function FormInput({ id, label, type, placeholder, value, onChange, icon: Icon, autoComplete }, ref) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

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
          type={isPassword && showPassword ? "text" : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl py-3.5 pl-12 pr-12 font-inter text-sm text-on-surface placeholder:text-outline/40 transition-all duration-300 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors duration-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const passwordRef = useRef(null);

  /* ─── On mount: verify we have a recovery session ───
     A valid password-recovery flow carries a short-lived session scoped to
     updateUser. If none is present, the token was invalid/expired. */
  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        setValidSession(true);
      } else {
        setError(
          "This password reset link is invalid or has expired. Please request a new one.",
        );
      }
      setChecking(false);
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  /* ─── Focus password once a valid session is confirmed ─── */
  useEffect(() => {
    if (validSession) {
      const timer = setTimeout(() => passwordRef.current?.focus(), 400);
      return () => clearTimeout(timer);
    }
  }, [validSession]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      // Covers "Auth session missing" (expired/invalid recovery token)
      setError(
        updateError.message.includes("session")
          ? "This password reset link is invalid or has expired. Please request a new one."
          : updateError.message,
      );
      return;
    }

    setDone(true);
  }

  return (
    <>
      <SEO
        title="Reset Password"
        description="Set a new password for your Fundora account."
        url="/reset-password"
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
                  password
                </span>
              </div>
              <h1 className="font-geist text-3xl md:text-4xl font-bold tracking-tight text-on-surface mb-2">
                Set a new password
              </h1>
              <p className="font-inter text-base text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Choose a strong password to secure your account.
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
                {/* Checking session */}
                {checking && (
                  <div className="flex flex-col items-center gap-3 py-8" role="status">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant animate-spin" aria-hidden="true">
                      progress_activity
                    </span>
                    <p className="text-sm font-inter text-on-surface-variant">Checking your reset link...</p>
                  </div>
                )}

                {/* Invalid / expired token */}
                {!checking && !validSession && (
                  <div className="flex flex-col items-center gap-4 py-6 text-center" role="alert">
                    <div className="w-14 h-14 rounded-full bg-danger-muted border border-danger/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-danger text-[28px]" aria-hidden="true">link_off</span>
                    </div>
                    <p className="text-on-surface-variant font-inter text-sm leading-relaxed max-w-xs">{error}</p>
                    <Link
                      href="/forgot-password"
                      className="text-primary hover:text-primary/80 font-inter text-sm font-medium transition-colors"
                    >
                      Request a new reset link
                    </Link>
                  </div>
                )}

                {/* Valid session — show form */}
                {!checking && validSession && !done && (
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

                    <FormInput
                      id="reset-password"
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={LockIcon}
                      autoComplete="new-password"
                      ref={passwordRef}
                    />

                    <FormInput
                      id="reset-confirm"
                      label="Confirm New Password"
                      type="password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      icon={LockIcon}
                      autoComplete="new-password"
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
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <span>Update password</span>
                          <ArrowIcon />
                        </>
                      )}
                    </motion.button>
                  </form>
                )}

                {/* Success */}
                {!checking && validSession && done && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-4 py-6 text-center"
                      role="status"
                    >
                      <div className="w-14 h-14 rounded-full bg-success-muted border border-success/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-success text-[28px]" aria-hidden="true">check_circle</span>
                      </div>
                      <p className="text-on-surface font-inter text-sm leading-relaxed max-w-xs">
                        Your password has been updated successfully.
                      </p>
                      <Link
                        href="/login"
                        className="text-primary hover:text-primary/80 font-inter text-sm font-medium transition-colors"
                      >
                        Back to login
                      </Link>
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Back to login */}
                {!checking && !done && (
                  <div className="mt-8 pt-6 border-t border-outline-variant/20 text-center">
                    <p className="font-inter text-sm text-on-surface-variant">
                      <Link
                        href="/login"
                        className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 transition-colors"
                      >
                        Back to login
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
}

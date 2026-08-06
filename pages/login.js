import { useRouter } from "next/router";
import { useState, useEffect, useRef, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { roleHome } from "../lib/roles";
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

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

/* ─── SVG Icons ─── */
function MailIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Input Component ─── */
const FormInput = forwardRef(function FormInput(
  { id, label, type, placeholder, value, onChange, icon: Icon },
  ref,
) {
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
          autoComplete={
            type === "password"
              ? "current-password"
              : type === "email"
                ? "email"
                : "off"
          }
          className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl py-3.5 pl-12 pr-4 font-inter text-sm text-on-surface placeholder:text-outline/40 transition-all duration-300 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
        />
      </div>
    </div>
  );
});

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendState, setResendState] = useState(null); // null | "unverified" | "resent"
  const [resending, setResending] = useState(false);
  const emailRef = useRef(null);

  /* ─── Focus email on mount ─── */
  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  /* ─── Login Handler ─── */
  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResendState(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Unverified account — friendly message + resend verification email option
      const unverified =
        error.code === "email_not_confirmed" ||
        /not confirmed|email not verified|verify your email/i.test(
          error.message,
        );

      if (unverified) {
        setError(
          "Your email address has not been verified yet. Check your inbox for the verification link, or resend it below.",
        );
        setResendState("unverified");
        setLoading(false);
        return;
      }

      setError(error.message);
      setLoading(false);
      return;
    }

    // Session established. An explicit ?redirect= target wins (e.g. the
    // Navbar's /login?redirect=/create deep link); otherwise route by role.
    if (router.query.redirect) {
      router.push(String(router.query.redirect));
      setLoading(false);
      return;
    }

    const uid = data.user?.id ?? data.session?.user?.id;

    // No resolvable user (e.g. legacy sessions) — fall back to home.
    if (!uid) {
      router.push("/");
      setLoading(false);
      return;
    }

    // Route by platform role: Creator → /creator/dashboard, Investor (donor) →
    // /investor/dashboard, Admin → /admin/dashboard. roleHome safely defaults
    // to the investor dashboard if the profile role is missing.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    router.push(roleHome(profile?.role));
    setLoading(false);
  }

  /* ─── Resend verification email (for unverified accounts) ─── */
  async function handleResendVerification() {
    setResending(true);
    setError("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setResending(false);

    if (error) {
      setError(error.message);
      return;
    }

    setResendState("resent");
  }

  return (
    <>
      <SEO
        title="Login"
        description="Sign in to your Fundora account. Access your projects, manage campaigns, and track your crowdfunding journey."
        url="/login"
        noindex={true}
      />
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative">
          {/* ─── Mesh Accent (local, subtle) ─── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/[0.04] rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-container/[0.03] rounded-full blur-[100px]" />
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md relative z-10"
          >
            {/* ─── Brand Identity ─── */}
            <motion.div
              variants={fadeUp}
              className="flex flex-col items-center mb-10 text-center"
            >
              <div className="mb-6 p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30">
                <span
                  className="material-symbols-outlined text-primary text-[40px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  architecture
                </span>
              </div>

              <h1 className="font-geist text-4xl md:text-5xl font-bold tracking-tight text-on-surface mb-2">
                Architectural Intelligence.
              </h1>
              <p className="font-inter text-base text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Secure access to the world&apos;s most sophisticated
                crowdfunding ecosystem.
              </p>
            </motion.div>

            {/* ─── Glass Login Card ─── */}
            <motion.div
              variants={fadeUp}
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: "rgba(27, 27, 30, 0.6)",
                backdropFilter: "blur(24px) saturate(1.2)",
                WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                border: "1px solid rgba(73, 68, 84, 0.3)",
                boxShadow:
                  "0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Top gradient accent line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

              <div className="p-8 md:p-10">
                {/* Header */}
                <div className="mb-8">
                  <h2 className="font-geist text-2xl font-bold text-on-surface mb-1.5">
                    Login
                  </h2>
                  <p className="font-inter text-sm text-on-surface-variant">
                    Welcome back. Enter your credentials to continue.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
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
                          <span
                            className="material-symbols-outlined text-danger text-[18px]"
                            aria-hidden="true"
                          >
                            error
                          </span>
                          <p className="text-danger text-sm font-inter">
                            {error}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Email */}
                  <FormInput
                    id="login-email"
                    label="Email Address"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={MailIcon}
                    ref={emailRef}
                  />

                  {/* Password */}
                  <FormInput
                    id="login-password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={LockIcon}
                  />

                  {/* Forgot Password + Resend Verification */}
                  <div className="flex items-center justify-between text-xs -mt-1">
                    {resendState === "unverified" ? (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resending}
                        className="text-primary hover:text-primary/80 font-inter font-medium transition-colors disabled:opacity-50"
                      >
                        {resending
                          ? "Resending..."
                          : "Resend verification email"}
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <Link
                      href="/forgot-password"
                      className="ml-auto text-on-surface-variant hover:text-primary font-inter font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* Resend confirmation */}
                  <AnimatePresence>
                    {resendState === "resent" && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        className="overflow-hidden"
                        role="status"
                      >
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-muted border border-success/20">
                          <span
                            className="material-symbols-outlined text-success text-[18px]"
                            aria-hidden="true"
                          >
                            mark_email_read
                          </span>
                          <p className="text-success text-sm font-inter">
                            Verification email sent. Please check your inbox.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                        <span>Logging in...</span>
                      </>
                    ) : (
                      <>
                        <span>Login</span>
                        <ArrowIcon />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Sign up link */}
                <div className="mt-8 pt-6 border-t border-outline-variant/20 text-center">
                  <p className="font-inter text-sm text-on-surface-variant">
                    Don&apos;t have an account?{" "}
                    <Link
                      href="/signup"
                      className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 transition-colors"
                    >
                      Sign up
                    </Link>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ─── Trust Signals ─── */}
            <motion.div
              variants={fadeIn}
              className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-4 opacity-30 hover:opacity-80 transition-opacity duration-500"
            >
              {[
                { icon: "security", label: "ISO 27001" },
                { icon: "verified_user", label: "Bank-Grade Encryption" },
                { icon: "account_balance", label: "SEC Regulated" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[18px] text-on-surface-variant"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="font-geist text-[11px] font-medium text-on-surface-variant uppercase tracking-widest">
                    {item.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
}

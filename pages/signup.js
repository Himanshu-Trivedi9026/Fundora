import { useState, useEffect, useRef, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { parseSignupRole, roleLabel } from "../lib/roles";
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
function PersonIcon() {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

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
  { id, label, type, placeholder, value, onChange, icon: Icon, hint },
  ref,
) {
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
          autoComplete={
            type === "password"
              ? "new-password"
              : type === "email"
                ? "email"
                : type === "text" && id === "signup-name"
                  ? "name"
                  : "off"
          }
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
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
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
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[12px] text-on-surface-variant/70 px-1 font-inter">
          {hint}
        </p>
      )}
    </div>
  );
});

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const nameRef = useRef(null);

  // Role-first onboarding: the role is read from the URL (/signup?role=donor |
  // /signup?role=creator) and sanitized. It is NOT editable — only the exact
  // string "creator" maps to creator; everything else defaults to investor.
  const signupRole = parseSignupRole(router.query.role);

  /* ─── Focus name on mount ─── */
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  /* ─── Signup Handler ─── */
  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/&role=${signupRole}`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const createdUser = data.user;

    // identities.length === 0  →  an account with this email ALREADY exists
    const isExisting = !createdUser?.identities?.length;

    if (isExisting) {
      if (createdUser?.email_confirmed_at) {
        // Already registered AND verified — Supabase sent no email.
        setError(
          "An account with this email already exists. Please log in instead.",
        );
      } else {
        // Existing unverified account — Supabase already resent the email.
        setSuccess(
          "A verification email has been sent to this address. Please check your inbox before logging in.",
        );
      }
      setLoading(false);
      return;
    }

    // Brand-new account → exactly one verification email was sent.
    setSuccess(
      "Account created! Please verify your email before logging in. A verification link has been sent to your inbox.",
    );
    setLoading(false);
  }

  return (
    <>
      <SEO
        title="Sign Up"
        description="Create your Fundora account. Join the crowdfunding revolution and start backing innovative projects or launch your own campaign."
        url="/signup"
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
                  account_balance
                </span>
              </div>

              <h1 className="font-geist text-4xl md:text-5xl font-bold tracking-tight text-on-surface mb-2">
                Establish your venture
              </h1>
              <p className="font-inter text-base text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Join the architectural intelligence revolution in decentralized
                finance.
              </p>
            </motion.div>

            {/* ─── Glass Signup Card ─── */}
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

              {/* Subtle inner glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/[0.06] blur-[80px] rounded-full pointer-events-none" />

              <div className="p-8 md:p-10 relative z-10">
                {/* Header */}
                <div className="mb-8">
                  <h2 className="font-geist text-2xl font-bold text-on-surface mb-1.5">
                    Create Account
                  </h2>
                  <p className="font-inter text-sm text-on-surface-variant">
                    Start building the future of venture capital.
                  </p>
                </div>

                {/* Read-only role badge — set from the URL, not editable */}
                <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/30">
                  <span
                    className="material-symbols-outlined text-[18px] text-primary"
                    aria-hidden="true"
                  >
                    verified_user
                  </span>
                  <p className="font-inter text-sm text-on-surface-variant">
                    You&apos;re joining as{" "}
                    <span className="font-semibold text-on-surface">
                      {roleLabel(signupRole)}
                    </span>
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSignup} className="space-y-5">
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

                  {/* Success */}
                  <AnimatePresence>
                    {success && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        className="overflow-hidden"
                        role="alert"
                        aria-live="polite"
                      >
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-muted border border-success/20">
                          <span
                            className="material-symbols-outlined text-success text-[18px]"
                            aria-hidden="true"
                          >
                            check_circle
                          </span>
                          <p className="text-success text-sm font-inter">
                            {success}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Full Name */}
                  <FormInput
                    id="signup-name"
                    label="Full Name"
                    type="text"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    icon={PersonIcon}
                    ref={nameRef}
                  />

                  {/* Email */}
                  <FormInput
                    id="signup-email"
                    label="Email Address"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={MailIcon}
                  />

                  {/* Password */}
                  <FormInput
                    id="signup-password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={LockIcon}
                    hint="Must be at least 8 characters with one special symbol."
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
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowIcon />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Login link */}
                <div className="mt-8 pt-6 border-t border-outline-variant/20 text-center">
                  <p className="font-inter text-sm text-on-surface-variant">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 transition-colors"
                    >
                      Log in
                    </Link>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ─── Trust Indicator ─── */}
            <motion.div
              variants={fadeIn}
              className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-30 hover:opacity-80 transition-opacity duration-500"
            >
              <span className="font-geist text-[11px] font-medium text-on-surface-variant uppercase tracking-[0.2em]">
                Backed by leading architects
              </span>
              <div className="hidden sm:block h-px w-8 bg-outline-variant/30" />
              <div className="flex gap-5">
                <span className="font-geist text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-widest">
                  Venture
                </span>
                <span className="font-geist text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-widest">
                  Capital
                </span>
                <span className="font-geist text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-widest">
                  Global
                </span>
              </div>
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
}

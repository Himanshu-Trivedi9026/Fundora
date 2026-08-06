import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useVerification } from "../../context/VerificationContext";

/**
 * EmailVerificationStep — Email verification step.
 *
 * Auto-completes if user email is already verified.
 * Shows verification status with icon and Next button. When the email is NOT
 * verified, the user is pointed to /account (Supabase re-sends the auth
 * confirmation email there) instead of a fake client-side resend.
 */
export default function EmailVerificationStep({ onNext }) {
  const { verification, loading } = useVerification();

  const emailVerified = verification?.email_verified === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Status Card */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              emailVerified ? "bg-success-muted" : "bg-warning-muted"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[24px] ${
                emailVerified ? "text-success" : "text-warning"
              }`}
            >
              {emailVerified ? "mark_email_read" : "mail"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-geist text-lg text-on-surface font-medium">
              Email Verification
            </h3>
            <p className="text-sm text-on-surface-variant font-inter mt-1">
              {emailVerified
                ? "Your email address has been verified successfully."
                : "Check your inbox for a verification link. Click the link to confirm your email address."}
            </p>
          </div>
        </div>

        {/* Verified badge */}
        {emailVerified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success-muted border border-success/20"
          >
            <span className="material-symbols-outlined text-[18px] text-success">
              check_circle
            </span>
            <span className="text-sm text-success font-inter font-medium">
              Email Verified
            </span>
          </motion.div>
        )}

        {/* Pending state */}
        {!emailVerified && !loading && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-warning-muted border border-warning/20">
              <span className="material-symbols-outlined text-[18px] text-warning">
                pending
              </span>
              <span className="text-sm text-warning font-inter">
                Awaiting verification
              </span>
            </div>

            <p className="text-xs text-on-surface-variant/60 font-inter">
              We&apos;ve sent a confirmation link to your email. Check your
              inbox and click the link to verify, or log out and use the
              &quot;Resend verification email&quot; option on the login page.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-inter font-medium transition-colors"
              aria-label="Go to login page to resend verification email"
            >
              Resend verification email
              <span className="material-symbols-outlined text-[14px]">
                arrow_forward
              </span>
            </Link>
          </div>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-on-surface-variant/50">
            <span className="material-symbols-outlined text-[18px] animate-spin">
              progress_activity
            </span>
            <span className="text-sm font-inter">Checking status...</span>
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          aria-label="Continue to phone verification"
        >
          Next
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </button>
      </div>
    </motion.div>
  );
}

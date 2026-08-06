import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { sendOtp, verifyOtp } from "../../lib/verification/verificationApi";

// Mirrors lib/verification/phoneVerification.js OTP_CONFIG — used only for
// client-side display (cooldown/resend countdown). The actual rate-limiting,
// hashing and verification happen server-side.
const OTP_CONFIG = {
  maxAttempts: 3,
  cooldownSeconds: 60,
};

const COUNTRY_CODES = [
  { code: "+91", label: "IN", name: "India" },
  { code: "+1", label: "US", name: "United States" },
  { code: "+44", label: "UK", name: "United Kingdom" },
];

/**
 * PhoneVerificationStep — Phone number + OTP input.
 *
 * Phone input field with country code, send OTP button,
 * 6-digit OTP input boxes, cooldown timer, attempts remaining.
 */
export default function PhoneVerificationStep({ onNext, onBack }) {
  const { verification } = useVerification();

  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const otpRefs = useRef([]);

  const phoneVerified = verification?.phone_verified === true;

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-advance to next OTP input
  const handleOtpChange = useCallback(
    (index, value) => {
      if (!/^\d*$/.test(value)) return;

      const newValues = [...otpValues];
      newValues[index] = value.slice(-1);
      setOtpValues(newValues);
      setError("");

      // Move to next input
      if (value && index < 5) {
        otpRefs.current[index + 1]?.focus();
      }
    },
    [otpValues],
  );

  // Handle backspace
  const handleOtpKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace" && !otpValues[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    },
    [otpValues],
  );

  // Handle paste
  const handleOtpPaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 0) return;

    const newValues = ["", "", "", "", "", ""];
    pasted.split("").forEach((char, i) => {
      if (i < 6) newValues[i] = char;
    });
    setOtpValues(newValues);

    const nextEmpty = newValues.findIndex((v) => !v);
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    otpRefs.current[focusIndex]?.focus();
  }, []);

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const result = await sendOtp({ phone: fullPhone });

      if (result.success) {
        setOtpSent(true);
        setCooldown(OTP_CONFIG.cooldownSeconds);
        setAttemptsUsed(0);
      } else {
        setError(result.error || "Failed to send OTP.");
        if (result.cooldown) {
          setCooldown(result.cooldown);
        }
      }
    } catch (err) {
      setError(
        err?.body?.error ||
          err?.message ||
          "An error occurred. Please try again.",
      );
    }

    setSending(false);
  };

  const handleVerifyOtp = async () => {
    const otp = otpValues.join("");
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const result = await verifyOtp({ phone: fullPhone, otp });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Invalid OTP.");
        setAttemptsUsed((prev) => prev + 1);
        // Clear OTP inputs
        setOtpValues(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(
        err?.body?.error ||
          err?.message ||
          "Verification failed. Please try again.",
      );
    }

    setVerifying(false);
  };

  if (phoneVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-success-muted flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px] text-success">
                phone_in_talk
              </span>
            </div>
            <div>
              <h3 className="font-geist text-lg text-on-surface font-medium">
                Phone Verification
              </h3>
              <p className="text-sm text-on-surface-variant font-inter mt-1">
                Your phone number has been verified successfully.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success-muted border border-success/20">
            <span className="material-symbols-outlined text-[18px] text-success">
              check_circle
            </span>
            <span className="text-sm text-success font-inter font-medium">
              Phone Verified
            </span>
          </div>
        </div>
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface font-inter text-sm transition-all duration-200"
            aria-label="Go back to email verification"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Back
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Continue to identity verification"
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[24px] text-primary">
              phone
            </span>
          </div>
          <div>
            <h3 className="font-geist text-lg text-on-surface font-medium">
              Phone Verification
            </h3>
            <p className="text-sm text-on-surface-variant font-inter mt-1">
              Enter your phone number to receive a verification code.
            </p>
          </div>
        </div>

        {/* Phone Input */}
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-sm font-inter focus:outline-none focus:border-primary transition-colors w-24"
            aria-label="Country code"
          >
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code}>
                {cc.label} {cc.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="Enter phone number"
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface-container border border-outline-variant text-on-surface text-sm font-inter placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
            aria-label="Phone number"
            disabled={otpSent && !success}
          />
        </div>

        {/* Send OTP Button */}
        {!otpSent && (
          <button
            onClick={handleSendOtp}
            disabled={sending || !phoneNumber || phoneNumber.length < 6}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send verification OTP"
          >
            {sending ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                Sending...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  send
                </span>
                Send OTP
              </>
            )}
          </button>
        )}

        {/* OTP Input */}
        <AnimatePresence>
          {otpSent && !success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <p className="text-xs text-on-surface-variant font-inter">
                Enter the 6-digit code sent to {countryCode} {phoneNumber}
              </p>

              {/* OTP Boxes */}
              <div
                className="flex justify-center gap-2"
                onPaste={handleOtpPaste}
              >
                {otpValues.map((value, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 text-center text-lg font-geist font-medium bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:border-primary transition-colors"
                    aria-label={`OTP digit ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Cooldown / Resend */}
              <div className="flex items-center justify-between">
                {cooldown > 0 ? (
                  <span className="text-xs text-on-surface-variant/50 font-inter">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    disabled={sending}
                    className="text-xs text-primary hover:text-primary/80 font-inter font-medium transition-colors disabled:opacity-50"
                    aria-label="Resend OTP"
                  >
                    {sending ? "Resending..." : "Resend OTP"}
                  </button>
                )}

                {attemptsUsed > 0 && (
                  <span className="text-xs text-danger font-inter">
                    {OTP_CONFIG.maxAttempts - attemptsUsed} attempt
                    {OTP_CONFIG.maxAttempts - attemptsUsed !== 1
                      ? "s"
                      : ""}{" "}
                    remaining
                  </span>
                )}
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifyOtp}
                disabled={verifying || otpValues.some((v) => !v)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Verify OTP"
              >
                {verifying ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    Verifying...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      verified
                    </span>
                    Verify
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success-muted border border-success/20"
            >
              <span className="material-symbols-outlined text-[18px] text-success">
                check_circle
              </span>
              <span className="text-sm text-success font-inter font-medium">
                Phone number verified successfully!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-danger-muted border border-danger/20"
            >
              <span className="material-symbols-outlined text-[18px] text-danger">
                error
              </span>
              <span className="text-sm text-danger font-inter">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface font-inter text-sm transition-all duration-200"
          aria-label="Go back to email verification"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!success && !phoneVerified}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Continue to identity verification"
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

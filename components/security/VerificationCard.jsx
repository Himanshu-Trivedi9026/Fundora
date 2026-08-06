import { motion } from "framer-motion";
import VerificationBadge from "./VerificationBadge";
import TrustScoreCard from "./TrustScoreCard";
import RiskIndicator from "./RiskIndicator";

/**
 * VerificationCard — Full verification summary card for creator dashboard.
 *
 * Props:
 *   verification — verification record from context
 *   onNavigate   — function to navigate to verification page
 */
export default function VerificationCard({ verification, onNavigate }) {
  if (!verification) return null;

  const { verification_level, verification_status, trust_score, risk_score } = verification;

  const steps = [
    { label: "Email", verified: verification.email_verified, icon: "mail" },
    { label: "Phone", verified: verification.phone_verified, icon: "phone" },
    { label: "Identity", verified: verification.identity_verified, icon: "badge" },
    { label: "Bank", verified: verification.bank_verified, icon: "account_balance" },
    { label: "Business", verified: verification.business_verified, icon: "business" },
  ];

  const completedSteps = steps.filter(s => s.verified).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
        <h2 className="font-geist text-[20px] flex items-center gap-3 font-semibold">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            shield
          </span>
          Identity Verification
        </h2>
        <VerificationBadge level={verification_level} status={verification_status} size="md" />
      </div>

      {/* Card */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-inter text-on-surface-variant">Verification Progress</span>
            <span className="text-xs font-bold text-primary">{completedSteps}/{steps.length}</span>
          </div>
          <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${progress}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high/30 border border-white/5"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  step.verified ? "text-success" : "text-on-surface-variant/50"
                }`}
                style={step.verified ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {step.verified ? "check_circle" : step.icon}
              </span>
              <span className={`flex-1 text-sm font-inter ${
                step.verified ? "text-on-surface" : "text-on-surface-variant"
              }`}>
                {step.label}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                step.verified ? "text-success" : "text-on-surface-variant/50"
              }`}>
                {step.verified ? "Verified" : "Pending"}
              </span>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
          <TrustScoreCard score={trust_score} compact />
          <RiskIndicator score={risk_score} compact />
        </div>

        {/* CTA */}
        {verification_status === "pending" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNavigate}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-geist font-semibold text-sm
              hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            Complete Verification
          </motion.button>
        )}

        {verification_status === "under_review" && (
          <div className="text-center text-sm text-on-surface-variant font-inter">
            Your verification is being reviewed. This usually takes 1-2 business days.
          </div>
        )}
      </div>
    </motion.div>
  );
}

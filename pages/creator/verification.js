import { useState } from "react";
import { motion } from "framer-motion";
import PageLayout from "../../components/PageLayout";
import SEO from "../../components/SEO";
import { supabase } from "../../lib/supabaseClient";
import { authFetch } from "../../lib/authFetch";
import {
  useVerification,
  VERIFICATION_LEVELS,
} from "../../context/VerificationContext";
import SecurityShield from "../../components/security/SecurityShield";
import VerificationProgress from "../../components/security/VerificationProgress";
import VerificationSteps from "../../components/security/VerificationSteps";
import VerificationStatus from "../../components/security/VerificationStatus";
import TrustScoreCard from "../../components/security/TrustScoreCard";
import RiskIndicator from "../../components/security/RiskIndicator";
import VerificationWizard from "../../components/verification/VerificationWizard";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function CreatorVerification() {
  const {
    verification,
    history,
    loading: contextLoading,
    expiryStatus,
    daysUntilExpiry,
    businessVerification,
    businessDocuments,
    bankAccounts,
    bankVerification,
    completionPercentage,
    pendingActions,
    rejectedDocuments,
    verificationTimeline,
    refreshVerification,
  } = useVerification();
  const loading = contextLoading;

  // Appeal state (must be before early return to obey Rules of Hooks)
  const [appealModal, setAppealModal] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealError, setAppealError] = useState(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  // Wizard state — the real identity-verification upload flow.
  const [showWizard, setShowWizard] = useState(false);

  if (loading) {
    return (
      <PageLayout>
        <main
          className="flex-1 flex items-center justify-center min-h-[60vh]"
          role="status"
          aria-label="Loading verification"
        >
          <span
            className="material-symbols-outlined animate-spin text-primary text-4xl"
            aria-hidden="true"
          >
            progress_activity
          </span>
        </main>
      </PageLayout>
    );
  }

  const level = verification?.verification_level || 0;
  const status = verification?.verification_status || "pending";
  const trustScore = verification?.trust_score || 0;
  const riskScore = verification?.risk_score || 0;

  const currentLevelInfo =
    VERIFICATION_LEVELS.find((l) => l.level === level) ||
    VERIFICATION_LEVELS[0];
  const nextLevelInfo = VERIFICATION_LEVELS.find((l) => l.level === level + 1);

  return (
    <>
      <SEO
        title="Creator Verification"
        description="Verify your identity on Fundora to build trust with backers and unlock higher verification levels."
        url="/creator/verification"
        noindex={true}
      />
      <PageLayout hideFooter={false}>
        <div className="bg-surface-dim">
          <main className="flex-1 pt-24 pb-16 px-4 md:px-6">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="max-w-3xl mx-auto space-y-8"
            >
              {/* ─── Header ─── */}
              <motion.div variants={fadeUp} className="text-center space-y-4">
                <SecurityShield level={level} size="lg" />
                <div>
                  <h1 className="font-geist text-3xl md:text-4xl font-bold text-on-surface mb-2">
                    Identity Verification
                  </h1>
                  <p className="text-on-surface-variant font-inter text-sm max-w-md mx-auto">
                    Verify your identity to build trust with backers and unlock
                    higher platform capabilities.
                  </p>
                </div>
                <VerificationStatus status={status} size="lg" />

                {/* Expiry Status */}
                {expiryStatus && expiryStatus !== "not_verified" && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-inter font-medium ${
                      expiryStatus === "valid"
                        ? "bg-success/10 text-success"
                        : expiryStatus === "expiring_soon"
                          ? "bg-warning/10 text-warning"
                          : "bg-danger/10 text-danger"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${
                        expiryStatus === "valid"
                          ? "text-success"
                          : expiryStatus === "expiring_soon"
                            ? "text-warning"
                            : "text-danger"
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      {expiryStatus === "valid"
                        ? "verified"
                        : expiryStatus === "expiring_soon"
                          ? "warning"
                          : "error"}
                    </span>
                    {expiryStatus === "valid" && "Verification Valid"}
                    {expiryStatus === "expiring_soon" &&
                      `Expires in ${daysUntilExpiry} days`}
                    {expiryStatus === "expired" &&
                      "Verification Expired — Renew Required"}
                  </div>
                )}

                {/* Appeal Button — shown when verification is rejected */}
                {(status === "rejected" ||
                  businessVerification?.status === "rejected" ||
                  bankVerification?.status === "rejected") && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setAppealModal(true);
                        setAppealError(null);
                        setAppealSuccess(false);
                        setAppealReason("");
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all"
                    >
                      <span
                        className="material-symbols-outlined text-[16px]"
                        aria-hidden="true"
                      >
                        gavel
                      </span>
                      Appeal Rejection
                    </button>
                  </div>
                )}
              </motion.div>

              {/* ─── Start Verification CTA ─── */}
              {verification?.identity_verified !== true && !showWizard && (
                <motion.div variants={fadeUp}>
                  <div className="glass-panel p-6 rounded-2xl border border-primary/20 bg-primary/[0.04] space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span
                          className="material-symbols-outlined text-primary text-[24px]"
                          aria-hidden="true"
                        >
                          verified_user
                        </span>
                      </div>
                      <div>
                        <h2 className="font-geist text-lg font-semibold text-on-surface">
                          Verify Your Identity
                        </h2>
                        <p className="text-sm text-on-surface-variant font-inter mt-1">
                          Complete the guided verification wizard to upload your
                          identity documents (PAN, Aadhaar, selfie). This
                          unlocks publishing and receiving funds on Fundora.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowWizard(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        aria-label="Start identity verification wizard"
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          aria-hidden="true"
                        >
                          play_arrow
                        </span>
                        Start Verification
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Wizard ─── */}
              {showWizard && (
                <motion.div variants={fadeUp}>
                  <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
                      <h2 className="font-geist text-lg font-semibold text-on-surface">
                        Identity Verification Wizard
                      </h2>
                      <button
                        onClick={() => setShowWizard(false)}
                        className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                        aria-label="Close verification wizard"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          close
                        </span>
                      </button>
                    </div>
                    <VerificationWizard
                      onClose={() => {
                        setShowWizard(false);
                        refreshVerification();
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* ─── Progress ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
                  <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
                    <h2 className="font-geist text-lg font-semibold flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-primary text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        trending_up
                      </span>
                      Verification Progress
                    </h2>
                    <span className="text-xs font-bold text-primary">
                      Level {level} — {currentLevelInfo.label}
                    </span>
                  </div>

                  {/* Completion Percentage */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg
                        className="w-16 h-16 -rotate-90"
                        viewBox="0 0 36 36"
                        role="img"
                        aria-label={`${completionPercentage}% verification completion`}
                      >
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${completionPercentage}, 100`}
                          className="text-primary transition-all duration-1000"
                          aria-hidden="true"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {completionPercentage}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        Overall Completion
                      </p>
                      <p className="text-xs text-on-surface-variant font-inter">
                        {completionPercentage === 100
                          ? "All verifications complete"
                          : `${6 - Math.round((completionPercentage / 100) * 6)} steps remaining`}
                      </p>
                    </div>
                  </div>

                  <VerificationProgress currentLevel={level} />

                  {nextLevelInfo && (
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span
                          className="material-symbols-outlined text-primary text-[16px]"
                          aria-hidden="true"
                        >
                          arrow_upward
                        </span>
                        <span className="text-sm font-inter text-on-surface">
                          Next:{" "}
                          <span className="font-semibold text-primary">
                            {nextLevelInfo.label}
                          </span>{" "}
                          — {nextLevelInfo.description}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ─── Pending Actions ─── */}
              {pendingActions.length > 0 && (
                <motion.div variants={fadeUp}>
                  <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                      <span
                        className="material-symbols-outlined text-warning text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        pending_actions
                      </span>
                      <h2 className="font-geist text-lg font-semibold">
                        Pending Actions
                      </h2>
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-bold">
                        {pendingActions.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pendingActions.map((action, i) => (
                        <div
                          key={`${action.type}-${i}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high/30 border border-white/5"
                        >
                          <span
                            className="material-symbols-outlined text-warning text-[16px]"
                            aria-hidden="true"
                          >
                            {action.icon}
                          </span>
                          <span className="text-sm font-inter text-on-surface">
                            {action.label}
                          </span>
                          <span
                            className="material-symbols-outlined text-on-surface-variant text-[16px] ml-auto"
                            aria-hidden="true"
                          >
                            chevron_right
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Rejected Documents ─── */}
              {rejectedDocuments.length > 0 && (
                <motion.div variants={fadeUp}>
                  <div className="glass-panel p-6 rounded-2xl border border-danger/10 space-y-4">
                    <div className="flex items-center gap-2 border-b border-danger/20 pb-3">
                      <span
                        className="material-symbols-outlined text-danger text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        error
                      </span>
                      <h2 className="font-geist text-lg font-semibold text-danger">
                        Documents Need Attention
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {rejectedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-danger/5 border border-danger/10"
                        >
                          <span
                            className="material-symbols-outlined text-danger text-[16px]"
                            aria-hidden="true"
                          >
                            upload_file
                          </span>
                          <span className="text-sm font-inter text-on-surface">
                            {doc.document_type?.replace(/_/g, " ")}
                          </span>
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-bold">
                            Rejected
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Business Verification ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                    <span
                      className="material-symbols-outlined text-primary text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      business
                    </span>
                    <h2 className="font-geist text-lg font-semibold">
                      Business Verification
                    </h2>
                    {businessVerification?.status === "verified" && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold">
                        Verified
                      </span>
                    )}
                    {businessVerification?.status === "pending" && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-bold">
                        Pending
                      </span>
                    )}
                    {businessVerification?.status === "rejected" && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-bold">
                        Rejected
                      </span>
                    )}
                  </div>
                  {businessVerification ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm font-inter">
                        <div>
                          <span className="text-on-surface-variant">
                            Business Name
                          </span>
                          <p className="text-on-surface font-medium">
                            {businessVerification.business_name || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">Type</span>
                          <p className="text-on-surface font-medium capitalize">
                            {businessVerification.business_type?.replace(
                              /_/g,
                              " ",
                            ) || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">
                            GST Status
                          </span>
                          <p
                            className={`font-medium ${businessVerification.gst_status === "verified" ? "text-success" : "text-on-surface-variant"}`}
                          >
                            {businessVerification.gst_status || "Not submitted"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant">
                            PAN Status
                          </span>
                          <p
                            className={`font-medium ${businessVerification.pan_status === "verified" ? "text-success" : "text-on-surface-variant"}`}
                          >
                            {businessVerification.pan_status || "Not submitted"}
                          </p>
                        </div>
                      </div>
                      {businessDocuments.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/30">
                          <p className="text-xs text-on-surface-variant mb-2">
                            Documents ({businessDocuments.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {businessDocuments.map((doc) => (
                              <span
                                key={doc.id}
                                className={`px-2 py-1 rounded-lg text-xs font-inter ${
                                  doc.status === "verified"
                                    ? "bg-success/10 text-success"
                                    : doc.status === "rejected"
                                      ? "bg-danger/10 text-danger"
                                      : "bg-surface-container-high/50 text-on-surface-variant"
                                }`}
                              >
                                {doc.document_type?.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant font-inter">
                      No business verification started yet.
                    </p>
                  )}
                </div>
              </motion.div>

              {/* ─── Bank Verification ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                    <span
                      className="material-symbols-outlined text-primary text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      account_balance
                    </span>
                    <h2 className="font-geist text-lg font-semibold">
                      Bank Verification
                    </h2>
                    {bankVerification?.status === "verified" && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold">
                        Verified
                      </span>
                    )}
                  </div>
                  {bankAccounts.length > 0 ? (
                    <div className="space-y-3">
                      {bankAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="p-3 rounded-xl bg-surface-container-high/30 border border-white/5"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-on-surface">
                              {account.bank_name || "Bank Account"}
                            </span>
                            <div className="flex items-center gap-2">
                              {account.is_primary && (
                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                                  Primary
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  account.status === "verified"
                                    ? "bg-success/10 text-success"
                                    : account.status === "pending"
                                      ? "bg-warning/10 text-warning"
                                      : account.status === "rejected"
                                        ? "bg-danger/10 text-danger"
                                        : "bg-surface-container-high/50 text-on-surface-variant"
                                }`}
                              >
                                {account.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-on-surface-variant font-inter">
                            {account.account_type || "Savings"} •{" "}
                            {account.account_holder_name || "—"}
                          </p>
                          {account.penny_drop_status && (
                            <p className="text-xs text-on-surface-variant font-inter mt-1">
                              Penny Drop:{" "}
                              <span
                                className={
                                  account.penny_drop_status === "success"
                                    ? "text-success"
                                    : "text-on-surface-variant"
                                }
                              >
                                {account.penny_drop_status}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant font-inter">
                      No bank accounts added yet.
                    </p>
                  )}
                </div>
              </motion.div>

              {/* ─── Steps ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <VerificationSteps
                    verification={verification}
                    history={history}
                    onStepClick={(step) => {
                      // Future: navigate to specific verification step
                    }}
                  />
                </div>
              </motion.div>

              {/* ─── Verification Timeline ─── */}
              {verificationTimeline.length > 0 && (
                <motion.div variants={fadeUp}>
                  <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                      <span
                        className="material-symbols-outlined text-primary text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        timeline
                      </span>
                      <h2 className="font-geist text-lg font-semibold">
                        Verification Timeline
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {verificationTimeline.slice(0, 10).map((event) => (
                        <div key={event.id} className="flex items-start gap-3">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                              event.status === "approved" ||
                              event.status === "verified"
                                ? "bg-success"
                                : event.status === "rejected"
                                  ? "bg-danger"
                                  : event.status === "pending" ||
                                      event.status === "under_review"
                                    ? "bg-warning"
                                    : "bg-primary"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-inter text-on-surface">
                              {event.action?.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-on-surface-variant font-inter">
                              {new Date(event.timestamp).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                              event.status === "approved" ||
                              event.status === "verified"
                                ? "bg-success/10 text-success"
                                : event.status === "rejected"
                                  ? "bg-danger/10 text-danger"
                                  : "bg-surface-container-high/50 text-on-surface-variant"
                            }`}
                          >
                            {event.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Scores ─── */}
              <motion.div
                variants={fadeUp}
                className="grid md:grid-cols-2 gap-6"
              >
                <TrustScoreCard score={trustScore} />
                <RiskIndicator score={riskScore} />
              </motion.div>

              {/* ─── Security Explanation ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                    <span
                      className="material-symbols-outlined text-primary text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      lock
                    </span>
                    <h2 className="font-geist text-lg font-semibold">
                      How We Protect Your Data
                    </h2>
                  </div>
                  <div className="space-y-3 text-sm text-on-surface-variant font-inter">
                    <div className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-success text-[16px] mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                      <span>
                        Your identity documents are encrypted and stored
                        securely. We never share them with third parties.
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-success text-[16px] mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                      <span>
                        Verification data is only visible to you and our review
                        team. It is never shown on your public profile.
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-success text-[16px] mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                      <span>
                        You can request data deletion at any time from your
                        account settings.
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-success text-[16px] mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        check_circle
                      </span>
                      <span>
                        Our verification partners (when enabled) are SOC 2 Type
                        II certified.
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ─── Requirements ─── */}
              <motion.div variants={fadeUp}>
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
                    <span
                      className="material-symbols-outlined text-primary text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      info
                    </span>
                    <h2 className="font-geist text-lg font-semibold">
                      Verification Requirements
                    </h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {VERIFICATION_LEVELS.slice(1).map((lvl) => (
                      <div
                        key={lvl.level}
                        className={`p-4 rounded-xl border ${
                          level >= lvl.level
                            ? "bg-success-muted/20 border-success/10"
                            : "bg-surface-container-high/20 border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              level >= lvl.level
                                ? "text-success"
                                : "text-on-surface-variant/50"
                            }`}
                            style={
                              level >= lvl.level
                                ? { fontVariationSettings: "'FILL' 1" }
                                : {}
                            }
                            aria-hidden="true"
                          >
                            {level >= lvl.level ? "check_circle" : lvl.icon}
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              level >= lvl.level
                                ? "text-success"
                                : "text-on-surface"
                            }`}
                          >
                            {lvl.label}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-inter">
                          {lvl.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </main>

          {/* Appeal Modal */}
          {appealModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#0d0d15] border border-white/[0.06] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white font-geist">
                    Appeal Rejection
                  </h3>
                  <button
                    onClick={() => {
                      setAppealModal(false);
                      setAppealError(null);
                      setAppealSuccess(false);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {appealSuccess ? (
                  <div className="text-center py-6">
                    <span className="material-symbols-outlined text-[48px] text-green-400 mb-3">
                      check_circle
                    </span>
                    <p className="text-green-300 text-sm mb-4">
                      Your appeal has been submitted successfully.
                    </p>
                    <button
                      onClick={() => {
                        setAppealModal(false);
                        setAppealSuccess(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!appealReason.trim()) return;
                      setAppealLoading(true);
                      setAppealError(null);
                      try {
                        const res = await authFetch("/api/appeals", {
                          method: "POST",
                          body: JSON.stringify({
                            appealType: "verification_rejection",
                            originalAction: "verification_review",
                            originalActionId: verification?.id || null,
                            originalActionType: "verification",
                            reason: appealReason.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok)
                          throw new Error(
                            data.error || "Failed to submit appeal",
                          );
                        setAppealSuccess(true);
                      } catch (err) {
                        setAppealError(err.message);
                      } finally {
                        setAppealLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Reason for Appeal *
                      </label>
                      <textarea
                        value={appealReason}
                        onChange={(e) => setAppealReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 min-h-[120px]"
                        placeholder="Explain why you believe the rejection was incorrect..."
                        required
                      />
                    </div>

                    {appealError && (
                      <p className="text-sm text-red-400">{appealError}</p>
                    )}

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAppealModal(false);
                          setAppealError(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={appealLoading || !appealReason.trim()}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {appealLoading && (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        Submit Appeal
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </>
  );
}

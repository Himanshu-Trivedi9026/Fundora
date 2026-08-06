import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import {
  fetchSession,
  createSessionApi,
  updateSessionStepApi,
  completeSessionApi,
} from "../../lib/verification/verificationApi";
import WizardStepIndicator from "./WizardStepIndicator";
import EmailVerificationStep from "./EmailVerificationStep";
import PhoneVerificationStep from "./PhoneVerificationStep";
import IdentityVerificationStep from "./IdentityVerificationStep";
import SelfieVerificationStep from "./SelfieVerificationStep";
import DeviceMetadataCollector from "./DeviceMetadataCollector";
import ReviewStatusCard from "./ReviewStatusCard";
import IdentityCard from "./IdentityCard";
import SelfieCard from "./SelfieCard";

const WIZARD_STEPS = [
  { id: "email", label: "Email", icon: "mail" },
  { id: "phone", label: "Phone", icon: "phone" },
  { id: "identity", label: "Identity", icon: "badge" },
  { id: "selfie", label: "Selfie", icon: "photo_camera" },
  { id: "review", label: "Review", icon: "rate_review" },
  { id: "complete", label: "Complete", icon: "check_circle" },
];

/**
 * VerificationWizard — Main wizard container.
 *
 * Multi-step: Email → Phone → Identity → Selfie → Review → Complete
 * Auto-saves progress, resumes from last step, audit logging.
 */
export default function VerificationWizard({ onClose }) {
  const {
    verification,
    currentSession,
    refreshSession,
    refreshVerification,
    requests,
  } = useVerification();

  const [currentStep, setCurrentStep] = useState("email");
  const [completedSteps, setCompletedSteps] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [deviceMetadata, setDeviceMetadata] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [wizardState, setWizardState] = useState({});

  // Resume session on mount, create one if none exists.
  useEffect(() => {
    let cancelled = false;
    const initSession = async () => {
      try {
        // Prefer the live session from the API (owns + active) over the
        // context snapshot, which may be stale.
        const session = await fetchSession();
        if (cancelled) return;
        if (session) {
          setSessionId(session.id);
          setCurrentStep(session.current_step || "email");
          setCompletedSteps(session.completed_steps || []);
          setWizardState(session.wizard_state || {});
          return;
        }
      } catch (err) {
        console.error("Resume session error:", err);
        if (cancelled) return;
      }

      // No active session — create one once device metadata is available.
      if (deviceMetadata) {
        try {
          const created = await createSessionApi({ deviceMetadata });
          if (cancelled) return;
          if (created) setSessionId(created.id);
        } catch (err) {
          console.error("Create session error:", err);
        }
      }
    };

    initSession();
    return () => {
      cancelled = true;
    };
  }, [deviceMetadata]);

  // Save step progress
  const saveStepProgress = useCallback(
    async (step, steps, state) => {
      if (!sessionId) return;
      try {
        await updateSessionStepApi({
          sessionId,
          step,
          completedSteps: steps,
          wizardState: state,
        });
      } catch (err) {
        console.error("Save step progress error:", err);
      }
    },
    [sessionId],
  );

  // Step index for navigation
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  // Navigate next
  const handleNext = useCallback(() => {
    const newCompleted = [...completedSteps, currentStep];
    setCompletedSteps(newCompleted);

    const nextIndex = currentIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      const nextStep = WIZARD_STEPS[nextIndex].id;
      setCurrentStep(nextStep);
      saveStepProgress(nextStep, newCompleted, wizardState);
    }
  }, [
    currentStep,
    currentIndex,
    completedSteps,
    wizardState,
    saveStepProgress,
  ]);

  // Navigate back
  const handleBack = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const prevStep = WIZARD_STEPS[prevIndex].id;
      setCurrentStep(prevStep);
      // Remove from completed
      setCompletedSteps((prev) => prev.filter((s) => s !== prevStep));
      saveStepProgress(prevStep, completedSteps, wizardState);
    }
  }, [currentIndex, completedSteps, wizardState, saveStepProgress]);

  // Submit verification
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Mark session complete server-side (also upserts the review request).
      if (sessionId) {
        await completeSessionApi({ sessionId });
      }
      // Mark all steps complete
      const allSteps = WIZARD_STEPS.map((s) => s.id);
      setCompletedSteps(allSteps);
      setCurrentStep("complete");

      await refreshVerification();
      await refreshSession();
    } catch (err) {
      console.error("Submit error:", err);
    }
    setSubmitting(false);
  };

  // Device metadata callback
  const handleMetadata = useCallback((metadata) => {
    setDeviceMetadata(metadata);
  }, []);

  // Latest request for review step
  const latestRequest = useMemo(() => {
    return requests?.[0] || null;
  }, [requests]);

  // Render current step content
  const renderStep = () => {
    switch (currentStep) {
      case "email":
        return <EmailVerificationStep onNext={handleNext} />;
      case "phone":
        return (
          <PhoneVerificationStep onNext={handleNext} onBack={handleBack} />
        );
      case "identity":
        return (
          <IdentityVerificationStep
            onNext={handleNext}
            onBack={handleBack}
            onStateChange={(state) =>
              setWizardState((prev) => ({ ...prev, ...state }))
            }
          />
        );
      case "selfie":
        return (
          <SelfieVerificationStep
            onNext={handleNext}
            onBack={handleBack}
            onStateChange={(state) =>
              setWizardState((prev) => ({ ...prev, ...state }))
            }
          />
        );
      case "review":
        return (
          <ReviewStep
            request={latestRequest}
            onBack={handleBack}
            onSubmit={handleSubmit}
            submitting={submitting}
            wizardState={wizardState}
          />
        );
      case "complete":
        return <CompletionStep onClose={onClose} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Device metadata collector (renderless) */}
      <DeviceMetadataCollector onMetadata={handleMetadata} />

      {/* Step Indicator */}
      <div className="glass-card p-4">
        <WizardStepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * ReviewStep — Review all collected data before submission.
 */
function ReviewStep({ request, onBack, onSubmit, submitting, wizardState }) {
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
              rate_review
            </span>
          </div>
          <div>
            <h3 className="font-geist text-lg text-on-surface font-medium">
              Review & Submit
            </h3>
            <p className="text-sm text-on-surface-variant font-inter mt-1">
              Review your verification details before submitting.
            </p>
          </div>
        </div>

        {/* Summary cards — driven by the real uploaded docs, not hardcoded */}
        <div className="space-y-3">
          {wizardState.uploadedDocuments?.length > 0 ? (
            wizardState.uploadedDocuments.map((doc) => (
              <IdentityCard
                key={doc.documentType || doc.id}
                type={doc.documentType || "pan"}
                verified={doc.status === "verified"}
              />
            ))
          ) : (
            <IdentityCard type="pan" verified={false} />
          )}
          <SelfieCard
            status={wizardState.selfieUploaded ? "uploaded" : "pending"}
          />
        </div>

        {/* Request status */}
        {request && <ReviewStatusCard request={request} />}

        {/* Info notice */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-surface-container-high border border-outline-variant/30">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50 mt-0.5">
            info
          </span>
          <p className="text-xs text-on-surface-variant font-inter">
            Your documents will be reviewed within 24–48 hours. You will be
            notified once the verification is complete.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface font-inter text-sm transition-all duration-200 disabled:opacity-50"
          aria-label="Go back to selfie verification"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Submit verification request"
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">
                progress_activity
              </span>
              Submitting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">
                send
              </span>
              Submit for Review
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * CompletionStep — Success screen after submission.
 */
function CompletionStep({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="glass-card p-8 text-center space-y-5">
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-success-muted mx-auto flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[40px] text-success">
            check_circle
          </span>
        </motion.div>

        <div>
          <h3 className="font-geist text-xl text-on-surface font-medium">
            Verification Submitted!
          </h3>
          <p className="text-sm text-on-surface-variant font-inter mt-2 max-w-sm mx-auto">
            Your verification request has been submitted successfully. Our team
            will review your documents within 24–48 hours.
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 max-w-xs mx-auto">
          <span className="material-symbols-outlined text-[16px] text-primary">
            pending
          </span>
          <span className="text-sm text-primary font-inter font-medium">
            Under Review
          </span>
        </div>

        <p className="text-xs text-on-surface-variant/50 font-inter">
          You will be notified when the review is complete.
        </p>
      </div>

      {/* Done Button */}
      <div className="flex justify-center">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          aria-label="Close verification wizard"
        >
          <span className="material-symbols-outlined text-[18px]">done</span>
          Done
        </button>
      </div>
    </motion.div>
  );
}

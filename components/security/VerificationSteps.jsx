import { motion } from "framer-motion";

/**
 * VerificationSteps — Visual timeline with step-by-step verification progress.
 *
 * Props:
 *   verification — verification record
 *   history      — (optional) array of history events for timestamps
 *   onStepClick  — (optional) callback when a step is clicked
 *   className    — additional classes
 */
export default function VerificationSteps({
  verification,
  history,
  onStepClick,
  className = "",
}) {
  if (!verification) return null;

  // Build a lookup of when each step was completed from history
  const completedAt = {};
  if (history && Array.isArray(history)) {
    history.forEach((event) => {
      if (event.action === "approved" || event.action === "level_changed") {
        if (event.new_level !== null && event.new_level !== undefined) {
          const levelStepMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
          const stepLevel = levelStepMap[event.new_level];
          if (stepLevel && !completedAt[stepLevel]) {
            completedAt[stepLevel] = event.created_at;
          }
        }
      }
    });
  }

  const steps = [
    {
      level: 0,
      label: "Email Verification",
      description: "Verify your email address",
      icon: "mail",
      completed: verification.email_verified,
      current: !verification.email_verified,
      completedAt: completedAt[0] || verification.created_at,
    },
    {
      level: 1,
      label: "Phone Verification",
      description: "Confirm your phone number",
      icon: "phone",
      completed: verification.phone_verified,
      current: verification.email_verified && !verification.phone_verified,
      completedAt: completedAt[1],
    },
    {
      level: 2,
      label: "Identity Verification",
      description: "Upload government-issued ID",
      icon: "badge",
      completed: verification.identity_verified,
      current: verification.phone_verified && !verification.identity_verified,
      completedAt: completedAt[2],
    },
    {
      level: 3,
      label: "Bank Verification",
      description: "Link your bank account",
      icon: "account_balance",
      completed: verification.bank_verified,
      current: verification.identity_verified && !verification.bank_verified,
      completedAt: completedAt[3],
    },
    {
      level: 4,
      label: "Business Verification",
      description: "Verify business registration",
      icon: "business",
      completed: verification.business_verified,
      current: verification.bank_verified && !verification.business_verified,
      completedAt: completedAt[4],
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-geist text-sm font-semibold text-on-surface">
          Verification Timeline
        </h3>
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
          {completedCount}/{steps.length} Complete
        </span>
      </div>

      {/* Timeline */}
      <div className="relative ml-3 pl-10 space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-outline-variant/30" />

        {steps.map((step, i) => {
          const dateStr = formatDate(step.completedAt);
          return (
            <motion.div
              key={step.level}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative pb-4 last:pb-0"
            >
              {/* Dot on timeline */}
              <div
                className={`absolute -left-10 top-3 w-[12px] h-[12px] rounded-full border-2 z-10
                  ${
                    step.completed
                      ? "bg-success border-success shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                      : step.current
                        ? "bg-primary border-primary shadow-[0_0_8px_rgba(196,168,255,0.4)] animate-pulse"
                        : "bg-surface-container-high border-outline-variant/50"
                  }
                `}
              />

              {/* Step card */}
              <button
                onClick={() => onStepClick?.(step)}
                disabled={!step.current && !step.completed}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                  ${
                    step.completed
                      ? "bg-success-muted/20 border-success/10 hover:border-success/30"
                      : step.current
                        ? "bg-primary/5 border-primary/20 hover:border-primary/40 cursor-pointer"
                        : "bg-surface-container-high/10 border-white/5 opacity-50 cursor-not-allowed"
                  }
                `}
                aria-label={`${step.label}: ${step.completed ? "Completed" : step.current ? "Current step" : "Locked"}`}
              >
                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                  ${
                    step.completed
                      ? "bg-success/20"
                      : step.current
                        ? "bg-primary/20"
                        : "bg-surface-container-high"
                  }
                `}
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      step.completed
                        ? "text-success"
                        : step.current
                          ? "text-primary"
                          : "text-on-surface-variant/50"
                    }`}
                    style={
                      step.completed
                        ? { fontVariationSettings: "'FILL' 1" }
                        : {}
                    }
                  >
                    {step.completed ? "check_circle" : step.icon}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-inter font-medium ${
                      step.completed
                        ? "text-success"
                        : step.current
                          ? "text-on-surface"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] text-on-surface-variant/70 font-inter truncate">
                    {step.description}
                  </div>
                </div>

                {/* Status + Date */}
                <div className="text-right shrink-0">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider block ${
                      step.completed
                        ? "text-success"
                        : step.current
                          ? "text-primary"
                          : "text-on-surface-variant/30"
                    }`}
                  >
                    {step.completed ? "Done" : step.current ? "Next" : "Locked"}
                  </span>
                  {step.completed && dateStr && (
                    <span className="text-[8px] text-on-surface-variant/50 font-inter block mt-0.5">
                      {dateStr}
                    </span>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

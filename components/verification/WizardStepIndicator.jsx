import { motion } from "framer-motion";

/**
 * WizardStepIndicator — Horizontal step indicator with connected dots and labels.
 *
 * Props:
 *   steps          — Array of { id: string, label: string, icon: string }
 *   currentStep    — ID of the active step
 *   completedSteps — Array of step IDs that are completed
 */
export default function WizardStepIndicator({
  steps = [],
  currentStep,
  completedSteps = [],
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Verification progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = idx < currentIndex;

          return (
            <li
              key={step.id}
              className="flex flex-col items-center relative flex-1"
              aria-current={isCurrent ? "step" : undefined}
            >
              {/* Connector line (not for first item) */}
              {idx > 0 && (
                <div
                  className="absolute top-4 right-1/2 w-full h-0.5 -z-10"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      isCompleted || isPast || isCurrent
                        ? "bg-primary"
                        : "bg-outline-variant"
                    }`}
                  />
                </div>
              )}

              {/* Dot */}
              <div className="relative flex items-center justify-center">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-glow"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-primary">
                      check
                    </span>
                  </motion.div>
                ) : isCurrent ? (
                  <div className="relative">
                    <motion.div
                      className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        {step.icon}
                      </span>
                    </motion.div>
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/40"
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-outline-variant flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">
                      {step.icon}
                    </span>
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-[11px] font-inter text-center leading-tight max-w-[80px] transition-colors duration-300 ${
                  isCurrent
                    ? "text-primary font-medium"
                    : isCompleted || isPast
                    ? "text-on-surface"
                    : "text-on-surface-variant/50"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

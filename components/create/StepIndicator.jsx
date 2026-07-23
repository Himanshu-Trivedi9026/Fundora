import { motion } from "framer-motion";

const steps = [
  { id: 1, label: "Details", icon: "edit_note" },
  { id: 2, label: "AI Gen", icon: "auto_awesome" },
  { id: 3, label: "Media", icon: "image" },
  { id: 4, label: "Funding", icon: "payments" },
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="mb-10 md:mb-12">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 w-full h-[2px] bg-outline-variant -z-10" />

        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-2 md:gap-3"
              aria-current={isActive ? "step" : undefined}
            >
              {/* Dot */}
              <motion.div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-geist text-sm font-semibold transition-colors duration-300 ${
                  isCompleted
                    ? "bg-primary border-primary text-on-primary"
                    : isActive
                    ? "bg-surface-container-high border-primary text-primary"
                    : "bg-surface-container-high border-outline-variant text-outline-variant"
                }`}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-[20px]">
                    check
                  </span>
                ) : (
                  step.id
                )}
              </motion.div>

              {/* Label */}
              <span
                className={`font-inter text-xs md:text-sm font-medium transition-colors duration-300 ${
                  isActive ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

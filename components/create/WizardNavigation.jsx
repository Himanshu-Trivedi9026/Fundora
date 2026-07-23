import { Button } from "../ui";

export default function WizardNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onSaveDraft,
  loading,
}) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <footer className="fixed bottom-0 w-full bg-surface-dim/95 backdrop-blur-xl border-t border-outline-variant/30 z-50">
      <div className="flex items-center justify-between px-4 md:px-16 h-20 max-w-5xl mx-auto">
        {/* Previous Button */}
        <div className={isFirstStep ? "opacity-0 pointer-events-none" : ""}>
          <Button
            variant="ghost"
            onClick={onPrev}
            aria-label="Go to previous step"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span className="hidden sm:inline">Previous Step</span>
          </Button>
        </div>

        {/* Center Actions */}
        <div className="flex items-center gap-3">
          {/* Save Draft */}
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            aria-label="Save project draft"
          >
            Save Draft
          </Button>

          {/* Next / Publish */}
          <Button
            variant="primary"
            size="lg"
            onClick={onNext}
            loading={loading}
            aria-label={isLastStep ? "Publish project" : "Go to next step"}
          >
            {loading
              ? "Publishing..."
              : isLastStep
                ? "Publish Campaign"
                : "Next Step"}
          </Button>
        </div>
      </div>
    </footer>
  );
}

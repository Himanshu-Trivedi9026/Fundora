import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import PageContainer from "../../components/ui/PageContainer";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import StepIndicator from "../../components/create/StepIndicator";
import WizardNavigation from "../../components/create/WizardNavigation";
import ProjectDetailsStep from "../../components/create/ProjectDetailsStep";
import AIGeneratorStep from "../../components/create/AIGeneratorStep";
import MediaStep from "../../components/create/MediaStep";
import FundingStep from "../../components/create/FundingStep";
import { saveDraft, loadDraft, clearDraft } from "../../components/create/DraftManager";
import { supabase } from "../../lib/supabaseClient";
import { uploadFileToProject } from "../../lib/storage";

const TOTAL_STEPS = 4;

const initialFormData = {
  title: "",
  short: "",
  description: "",
  categories: [],
  goal: "",
  deadline: "",
  duration: null,
  prototypeUrl: "",
};

export default function CreateProject() {
  const router = useRouter();

  /* ─── State ─── */
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(initialFormData);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [user, setUser] = useState(null);
  /* ─── Auth Check ─── */
  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?redirect=/create");
        return;
      }
      setUser(data.user);
    }
    checkAuth();
  }, [router]);

  /* ─── Initialize State from Draft ─── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draft = loadDraft();
      if (draft) {
        queueMicrotask(() => setFormData({
          ...initialFormData,
          title: draft.title || "",
          short: draft.short || "",
          description: draft.description || "",
          categories: draft.categories || [],
          goal: draft.goal || "",
          deadline: draft.deadline || "",
          duration: draft.duration || null,
          prototypeUrl: draft.prototypeUrl || "",
        }));
        queueMicrotask(() => setTeam(draft.team || []));
        queueMicrotask(() => setDraftRestored(true));
      }
    }
  }, []);

  /* ─── Validation ─── */
  const validateStep = useCallback(
    (step) => {
      const newErrors = {};

      if (step === 1) {
        if (!formData.title || formData.title.trim().length < 3) {
          newErrors.title = "Project name must be at least 3 characters";
        }
        if (!formData.short || formData.short.trim().length < 10) {
          newErrors.short = "Tagline must be at least 10 characters";
        }
        if (!formData.categories || formData.categories.length === 0) {
          newErrors.categories = "Select at least one category";
        }
      }

      if (step === 3) {
        if (!thumbnailFile) {
          newErrors.thumbnail = "Please select a project thumbnail";
        }
      }

      if (step === 4) {
        if (!formData.goal || Number(formData.goal) <= 0) {
          newErrors.goal = "Please enter a valid funding goal";
        }
        if (!formData.deadline) {
          newErrors.deadline = "Please select a campaign duration";
        } else {
          const deadlineDate = new Date(formData.deadline);
          if (deadlineDate <= new Date()) {
            newErrors.deadline = "Deadline must be in the future";
          }
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData, thumbnailFile]
  );

  /* ─── Navigation ─── */
  const handleNext = () => {
    if (currentStep === TOTAL_STEPS) {
      handlePublish();
      return;
    }

    if (!validateStep(currentStep)) return;

    // Clear errors and move to next step
    setErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handlePrev = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  /* ─── Draft ─── */
  const handleSaveDraft = () => {
    saveDraft(formData, team);
    setDraftRestored(false);
  };

  /* ─── Publish (Backend Flow — UNCHANGED) ─── */
  async function handlePublish() {
    setPublishError("");

    if (!validateStep(4)) return;

    try {
      setLoading(true);

      /* STEP 1: Auth check */
      if (!user) {
        setPublishError("Please login first to publish your project.");
        setLoading(false);
        return;
      }

      /* STEP 2: Thumbnail validation */
      if (!thumbnailFile) {
        setErrors({ thumbnail: "Please select a project thumbnail" });
        setCurrentStep(3);
        setLoading(false);
        return;
      }

      if (thumbnailFile.size > 10 * 1024 * 1024) {
        setErrors({ thumbnail: "Thumbnail must be less than 10MB" });
        setCurrentStep(3);
        setLoading(false);
        return;
      }

      /* STEP 3: Create project FIRST via the verified-only publish API */
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setPublishError("Please login first to publish your project.");
        setLoading(false);
        return;
      }

      const publishRes = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          short: formData.short,
          description: formData.description,
          goal: Number(formData.goal),
          deadline: formData.deadline,
          prototypeUrl: formData.prototypeUrl,
          categories: formData.categories,
        }),
      });

      if (publishRes.status === 403) {
        setPublishError(
          "Creator verification is required before publishing. Please complete your verification first."
        );
        setLoading(false);
        return;
      }

      if (!publishRes.ok) {
        const publishErr = await publishRes.json().catch(() => ({}));
        setPublishError(
          publishErr?.error || "Something went wrong. Please try again."
        );
        setLoading(false);
        return;
      }

      const { project } = await publishRes.json();

      /* STEP 4: Upload thumbnail */
      const uploadedThumb = await uploadFileToProject(
        thumbnailFile,
        project.id,
        "thumbnail"
      );

      /* STEP 5: Save thumbnail URL */
      const { error: thumbUpdateError } = await supabase
        .from("projects")
        .update({ thumbnail: uploadedThumb.url })
        .eq("id", project.id);

      if (thumbUpdateError) {
        throw new Error(`Failed to save thumbnail: ${thumbUpdateError.message}`);
      }

      /* STEP 6: Upload media */
      const mediaRows = [];

      for (const file of mediaFiles) {
        try {
          const uploaded = await uploadFileToProject(file, project.id);
          if (!uploaded?.url) continue;

          mediaRows.push({
            project_id: project.id,
            url: uploaded.url,
            type: file.type.startsWith("image")
              ? "image"
              : file.type.startsWith("video")
              ? "video"
              : "document",
          });
        } catch (err) {
          console.error("Media upload failed:", err);
        }
      }

      if (mediaRows.length > 0) {
        await supabase.from("media").insert(mediaRows);
      }

      /* STEP 7: Insert team */
      if (team.length > 0) {
        await supabase.from("team_members").insert(
          team.map((t) => ({
            project_id: project.id,
            name: t.name,
            role: t.role,
          }))
        );
      }

      /* STEP 8: Clear draft and redirect */
      clearDraft();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      console.error("Publish error:", err);
      setPublishError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Render Step Content ─── */
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ProjectDetailsStep
            key="step-1"
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
        );
      case 2:
        return (
          <AIGeneratorStep
            key="step-2"
            formData={formData}
            setDescription={(desc) =>
              setFormData((prev) => ({ ...prev, description: desc }))
            }
          />
        );
      case 3:
        return (
          <MediaStep
            key="step-3"
            thumbnailFile={thumbnailFile}
            setThumbnailFile={setThumbnailFile}
            mediaFiles={mediaFiles}
            setMediaFiles={setMediaFiles}
            errors={errors}
          />
        );
      case 4:
        return (
          <FundingStep
            key="step-4"
            formData={formData}
            setFormData={setFormData}
            team={team}
            setTeam={setTeam}
            errors={errors}
          />
        );
      default:
        return null;
    }
  };

  /* ─── Loading State ─── */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Navbar />
        <PageContainer className="flex items-center justify-center">
          <LoadingSpinner text="Loading..." />
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />

      <PageContainer narrow>
        {/* Draft Restored Banner */}
        <AnimatePresence>
          {draftRestored && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20"
            >
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  restore
                </span>
                <div>
                  <p className="text-on-surface font-inter text-sm font-medium">
                    Draft restored
                  </p>
                  <p className="text-on-surface-variant font-inter text-xs">
                    Please re-select your media files.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDraftRestored(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Dismiss draft restored message"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Publish Error Banner */}
        <AnimatePresence>
          {publishError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20"
              role="alert"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-red-400 text-[20px]" aria-hidden="true">
                  error
                </span>
                <p className="text-red-300 font-inter text-sm">
                  {publishError}
                </p>
              </div>
              <button
                onClick={() => setPublishError("")}
                className="text-red-400/60 hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content with Animation */}
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </PageContainer>

      {/* Bottom Navigation */}
      <WizardNavigation
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onPrev={handlePrev}
        onNext={handleNext}
        onSaveDraft={handleSaveDraft}
        loading={loading}
      />

      <Footer />
    </div>
  );
}

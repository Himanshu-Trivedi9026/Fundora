import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import { authFetch } from "../../lib/authFetch";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const STATUS_VARIANT_MAP = {
  pending: "warning",
  approved: "success",
  completed: "primary",
  rejected: "danger",
};

/** Statuses where a creator can submit evidence */
const SUBMITTABLE_STATUSES = ["active", "in_progress", "pending", "pending_approval"];

export default function MilestonesPage() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [projects, setProjects] = useState([]);
  const [milestonesByProject, setMilestonesByProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Evidence submission state
  const [evidenceModal, setEvidenceModal] = useState(null); // milestone object or null
  const [evidenceForm, setEvidenceForm] = useState({
    title: "",
    description: "",
    progressNotes: "",
    links: "",
  });
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);
  const [evidenceSuccess, setEvidenceSuccess] = useState(null);

  const fetchMilestones = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    setError(null);
    try {
      // 1. Fetch all projects for this creator
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      const fetchedProjects = projectsData || [];
      setProjects(fetchedProjects);

      if (fetchedProjects.length === 0) {
        setMilestonesByProject({});
        return;
      }

      // 2. Fetch milestones for all user projects
      const projectIds = fetchedProjects.map((p) => p.id);
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("milestones")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true });

      if (milestonesError) throw milestonesError;

      // 3. Group milestones by project
      const grouped = {};
      for (const project of fetchedProjects) {
        grouped[project.id] = {
          project,
          milestones: (milestonesData || []).filter(
            (m) => m.project_id === project.id
          ),
        };
      }

      setMilestonesByProject(grouped);
    } catch (err) {
      console.error("Milestones fetch error:", err);
      setError(err.message || "Failed to load milestones");
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (!roleLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      queueMicrotask(() => fetchMilestones());
    }
  }, [user, roleLoading, fetchMilestones, router]);

  /**
   * Compute the approval percentage across milestones for a project.
   * Uses status weights: completed=100, approved=75, pending=25, rejected=0.
   */
  async function handleEvidenceSubmit(e) {
    e.preventDefault();
    if (!evidenceModal || !evidenceForm.title.trim()) return;
    setEvidenceLoading(true);
    setEvidenceError(null);
    setEvidenceSuccess(null);
    try {
      const res = await authFetch("/api/milestone/submit", {
        method: "POST",
        body: JSON.stringify({
          milestoneId: evidenceModal.id,
          title: evidenceForm.title.trim(),
          description: evidenceForm.description.trim(),
          progressNotes: evidenceForm.progressNotes.trim(),
          links: evidenceForm.links.trim()
            ? evidenceForm.links.split("\n").map((l) => l.trim()).filter(Boolean)
            : [],
          submissionType: "progress_report",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setEvidenceSuccess(`Evidence submitted for "${evidenceModal.title || "milestone"}"`);
      setEvidenceForm({ title: "", description: "", progressNotes: "", links: "" });
      fetchMilestones();
    } catch (err) {
      setEvidenceError(err.message);
    } finally {
      setEvidenceLoading(false);
    }
  }

  function computeApprovalPercentage(milestones) {
    if (!milestones || milestones.length === 0) return 0;
    const weights = { completed: 100, approved: 75, pending: 25, rejected: 0 };
    const total = milestones.reduce(
      (sum, m) => sum + (weights[m.status] || 0),
      0,
    );
    return Math.round(total / milestones.length);
  }

  // Auth / loading guard
  if (roleLoading) {
    return (
      <PageLayout hideSidebar={false}>
        <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Checking authentication..." />
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  const hasAnyMilestones = Object.values(milestonesByProject).some(
    (g) => g.milestones.length > 0,
  );

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
              Milestones
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base">
              Track and manage milestones across all your projects.
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading milestones..." />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <div className="glass-card p-8 text-center max-w-md">
                <span className="material-symbols-outlined text-[48px] text-danger mb-4">
                  error_outline
                </span>
                <h3 className="text-lg font-semibold text-on-surface mb-2">
                  Could not load milestones
                </h3>
                <p className="text-on-surface-variant text-sm mb-6">{error}</p>
                <Button variant="primary" onClick={fetchMilestones}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty state — no projects */}
          {!loading && !error && projects.length === 0 && (
            <EmptyState
              icon="account_tree"
              title="No projects yet"
              description="Create your first project to start adding milestones."
              action={
                <Link href="/create">
                  <Button variant="primary">
                    <span className="material-symbols-outlined text-[18px]">
                      add
                    </span>
                    Create Project
                  </Button>
                </Link>
              }
            />
          )}

          {/* Empty state — projects exist but no milestones */}
          {!loading && !error && projects.length > 0 && !hasAnyMilestones && (
            <EmptyState
              icon="flag"
              title="No milestones found"
              description="Your projects don't have any milestones yet. Set up milestones to track progress and release funds."
            />
          )}

          {/* Milestones grouped by project */}
          {!loading &&
            !error &&
            projects.length > 0 &&
            Object.values(milestonesByProject).map(({ project, milestones }) => (
              <GlassCard key={project.id} className="mb-6">
                {/* Project header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/[0.06]">
                  <div>
                    <h2 className="text-lg font-semibold text-on-surface">
                      {project.title || "Untitled Project"}
                    </h2>
                    {project.category && (
                      <span className="text-xs text-on-surface-variant capitalize">
                        {project.category}
                      </span>
                    )}
                  </div>

                  {/* Approval progress */}
                  {milestones.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">
                          Approval Progress
                        </p>
                        <p className="text-sm font-semibold text-on-surface">
                          {computeApprovalPercentage(milestones)}%
                        </p>
                      </div>
                      <div className="w-20 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-success to-success/70 rounded-full transition-all duration-500"
                          style={{
                            width: `${computeApprovalPercentage(milestones)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Milestone count */}
                <p className="text-xs text-on-surface-variant mb-4">
                  {milestones.length}{" "}
                  {milestones.length === 1 ? "milestone" : "milestones"}
                </p>

                {/* No milestones for this project */}
                {milestones.length === 0 && (
                  <p className="text-sm text-on-surface-variant text-center py-6">
                    No milestones added to this project yet.
                  </p>
                )}

                {/* Milestone list */}
                {milestones.length > 0 && (
                  <div className="space-y-3">
                    {milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 transition-colors hover:bg-white/[0.05]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-on-surface truncate">
                                {milestone.title || "Untitled Milestone"}
                              </h3>
                              <Badge
                                variant={
                                  STATUS_VARIANT_MAP[milestone.status] ||
                                  "default"
                                }
                              >
                                {milestone.status || "unknown"}
                              </Badge>
                            </div>
                            {milestone.description && (
                              <p className="text-xs text-on-surface-variant line-clamp-2">
                                {milestone.description}
                              </p>
                            )}
                          </div>

                          {/* Amounts */}
                          <div className="text-right flex-shrink-0">
                            {milestone.target_amount != null && (
                              <p className="text-sm font-semibold text-on-surface">
                                {currencyFormatter.format(
                                  milestone.target_amount,
                                )}
                              </p>
                            )}
                            {milestone.release_amount != null && (
                              <p className="text-xs text-success">
                                Release:{" "}
                                {currencyFormatter.format(
                                  milestone.release_amount,
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Progress bar for approved/released */}
                        {milestone.target_amount > 0 &&
                          milestone.release_amount != null && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                                <span>Release progress</span>
                                <span>
                                  {Math.round(
                                    (milestone.release_amount /
                                      milestone.target_amount) *
                                      100,
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, (milestone.release_amount / milestone.target_amount) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Submit Evidence Button */}
                          {SUBMITTABLE_STATUSES.includes(milestone.status) && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06]">
                              <button
                                onClick={() => {
                                  setEvidenceModal(milestone);
                                  setEvidenceForm({
                                    title: `Evidence: ${milestone.title || "Progress update"}`,
                                    description: "",
                                    progressNotes: "",
                                    links: "",
                                  });
                                  setEvidenceError(null);
                                  setEvidenceSuccess(null);
                                }}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                Submit Evidence
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            ))}
        </div>
      </div>

      {/* Evidence Submission Modal */}
      {evidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0d15] border border-white/[0.06] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white font-geist">
                Submit Evidence
              </h3>
              <button
                onClick={() => { setEvidenceModal(null); setEvidenceError(null); setEvidenceSuccess(null); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {evidenceSuccess ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-[48px] text-green-400 mb-3">check_circle</span>
                <p className="text-green-300 text-sm">{evidenceSuccess}</p>
                <button
                  onClick={() => { setEvidenceModal(null); setEvidenceSuccess(null); }}
                  className="mt-4 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleEvidenceSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={evidenceForm.title}
                    onChange={(e) => setEvidenceForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                    placeholder="Evidence title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <textarea
                    value={evidenceForm.description}
                    onChange={(e) => setEvidenceForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 min-h-[80px]"
                    placeholder="Describe the progress made..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Progress Notes</label>
                  <textarea
                    value={evidenceForm.progressNotes}
                    onChange={(e) => setEvidenceForm((f) => ({ ...f, progressNotes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 min-h-[80px]"
                    placeholder="Detailed progress notes..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Links (one per line)</label>
                  <textarea
                    value={evidenceForm.links}
                    onChange={(e) => setEvidenceForm((f) => ({ ...f, links: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 min-h-[60px]"
                    placeholder="https://github.com/..."
                  />
                </div>

                {evidenceError && (
                  <p className="text-sm text-red-400">{evidenceError}</p>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setEvidenceModal(null); setEvidenceError(null); }}
                    className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={evidenceLoading || !evidenceForm.title.trim()}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {evidenceLoading && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Submit Evidence
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
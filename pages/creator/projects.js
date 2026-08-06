import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  return currencyFormatter.format(amount);
}

const statusBadgeMap = {
  draft: { variant: "default", label: "Draft" },
  active: { variant: "primary", label: "Active" },
  funded: { variant: "success", label: "Funded" },
  completed: { variant: "success", label: "Completed" },
  cancelled: { variant: "danger", label: "Cancelled" },
};

function getStatusBadge(status) {
  const config = statusBadgeMap[status];
  if (!config) return <Badge variant="default">{status}</Badge>;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function CreatorProjects() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    async function fetchProjects() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select(
            "id, title, description, thumbnail, pledged, goal, created_at"
          )
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setProjects(data || []);
      } catch (err) {
        console.error("Projects fetch error:", err);
        setError(err.message || "Failed to load projects.");
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your projects..." />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <GlassCard>
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-[48px] text-danger mb-4">
                  error
                </span>
                <h3 className="text-lg font-semibold text-on-surface mb-2">
                  Error Loading Projects
                </h3>
                <p className="text-on-surface-variant text-sm mb-4">{error}</p>
                <Button
                  variant="primary"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-on-surface font-geist">
                My Projects
              </h1>
              <p className="text-on-surface-variant text-sm mt-1">
                Manage all your fundraising campaigns in one place.
              </p>
            </div>
            <Link href="/create">
              <Button variant="primary">
                <span className="material-symbols-outlined text-[18px]">
                  add
                </span>
                New Campaign
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <GlassCard padding="lg">
              <EmptyState
                icon="campaign"
                title="No projects yet"
                description="You haven't created any campaigns yet. Start your first fundraising journey!"
                action={
                  <Link href="/create">
                    <Button variant="primary">
                      <span className="material-symbols-outlined text-[18px]">
                        add
                      </span>
                      Create Campaign
                    </Button>
                  </Link>
                }
              />
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const raised = parseFloat(project.pledged) || 0;
                const goal = parseFloat(project.goal) || 0;
                // No `status` column exists on projects; derive a display state
                // from the real funding columns instead.
                const projectStatus =
                  goal > 0 && raised >= goal ? "funded" : "active";
                const progressPercent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;

                return (
                  <GlassCard
                    key={project.id}
                    padding="none"
                    hover
                    className="overflow-hidden flex flex-col"
                  >
                    {/* Cover Image */}
                    <div className="relative h-44 w-full overflow-hidden">
                      {project.thumbnail ? (
                        <Image
                          src={project.thumbnail}
                          alt={project.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 350px"
                          className="object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.parentElement.classList.add(
                              "bg-gradient-to-br",
                              "from-primary/20",
                              "via-surface-container",
                              "to-surface-container-lowest"
                            );
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-surface-container to-surface-container-lowest flex items-center justify-center">
                          <span className="material-symbols-outlined text-[48px] text-outline-variant">
                            image
                          </span>
                        </div>
                      )}
                      {/* Status Badge Overlay */}
                      <div className="absolute top-3 right-3">
                        {getStatusBadge(projectStatus)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-5">
                      <h3 className="text-base font-semibold text-on-surface font-geist mb-2 line-clamp-2">
                        {project.title}
                      </h3>

                      {project.description && (
                        <p className="text-on-surface-variant text-sm font-inter mb-4 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="mt-auto space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">
                            Raised
                          </span>
                          <span className="text-success font-semibold">
                            {formatCurrency(raised)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">Goal</span>
                          <span className="text-on-surface font-semibold">
                            {formatCurrency(goal)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-on-surface-variant text-right">
                          {progressPercent.toFixed(0)}% funded
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Link href={`/edit/${project.id}`} className="flex-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                edit
                              </span>
                              Edit
                            </Button>
                          </Link>
                          <Link
                            href={`/projects/${project.id}`}
                            className="flex-1"
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
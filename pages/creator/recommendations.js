import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import { useRole } from "../../context/RoleContext";
import { authFetch } from "../../lib/authFetch";

export default function RecommendationsPage() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    setError(null);
    try {
      const res = await authFetch("/api/ai/recommendations?type=trending&limit=12");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data)
        ? data
        : data?.recommendations || data?.data || [];
      if (items.length === 0) {
        const fallback = localStorage.getItem("campaign_recommendations");
        if (fallback) {
          try {
            const parsed = JSON.parse(fallback);
            setRecommendations(
              Array.isArray(parsed)
                ? parsed
                : parsed?.recommendations || parsed?.data || [],
            );
          } catch {
            setRecommendations([]);
          }
        } else {
          setRecommendations([]);
        }
      } else {
        setRecommendations(items);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      // Try localStorage fallback
      try {
        const fallback = localStorage.getItem("campaign_recommendations");
        if (fallback) {
          const parsed = JSON.parse(fallback);
          const items = Array.isArray(parsed)
            ? parsed
            : parsed?.recommendations || parsed?.data || [];
          if (items.length > 0) {
            setRecommendations(items);
            return;
          }
        }
      } catch {
        // ignore fallback errors
      }
      setError(err.message || "Failed to load campaign recommendations");
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      queueMicrotask(() => fetchRecommendations());
    }
  }, [user, roleLoading, fetchRecommendations, router]);

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

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
              AI Campaign Recommendations
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base">
              Personalized suggestions powered by AI to optimise your campaign
              strategy.
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner
                size="lg"
                text="Generating recommendations..."
              />
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
                  Something went wrong
                </h3>
                <p className="text-on-surface-variant text-sm mb-6">{error}</p>
                <Button variant="primary" onClick={fetchRecommendations}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && recommendations.length === 0 && (
            <EmptyState
              icon="lightbulb"
              title="No recommendations yet"
              description="We don't have any campaign recommendations for you right now. Try updating your campaign details or check back later."
              action={
                <Button variant="primary" onClick={fetchRecommendations}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Refresh
                </Button>
              }
            />
          )}

          {/* Recommendations grid */}
          {!loading && !error && recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((rec, index) => (
                <GlassCard
                  key={rec.id || index}
                  hover
                  className="flex flex-col"
                >
                  {/* Confidence badge */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="primary">
                      {rec.confidence_score != null
                        ? `${Math.round(rec.confidence_score * 100)}% confidence`
                        : "N/A"}
                    </Badge>
                    {rec.category && (
                      <span className="text-xs text-on-surface-variant capitalize">
                        {rec.category}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-on-surface mb-2">
                    {rec.title || "Untitled Recommendation"}
                  </h3>

                  {/* Description */}
                  {rec.description && (
                    <p className="text-sm text-on-surface-variant mb-4 flex-1 leading-relaxed">
                      {rec.description}
                    </p>
                  )}

                  {/* Estimated impact */}
                  {rec.estimated_impact && (
                    <div className="mt-auto pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          trending_up
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          Estimated impact:{" "}
                        </span>
                        <span className="text-xs font-medium text-success">
                          {rec.estimated_impact}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Confidence progress bar */}
                  {rec.confidence_score != null && (
                    <div className="mt-3">
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round(rec.confidence_score * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
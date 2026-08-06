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

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function PredictionsPage() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPredictions = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    setError(null);
    let succeeded = false;
    try {
      // Try GET first
      try {
        const res = await authFetch("/api/ai/funding-recommendation");
        if (res.ok) {
          const data = await res.json();
          setPredictions(data);
          succeeded = true;
        }
      } catch {
        // GET failed, will try POST
      }

      if (!succeeded) {
        try {
          // Fallback: POST with category "all"
          const res = await authFetch("/api/ai/funding-recommendation", {
            method: "POST",
            body: JSON.stringify({ category: "all" }),
          });
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          const data = await res.json();
          setPredictions(data);
        } catch (err) {
          console.error("Failed to fetch predictions:", err);
          setError(err.message || "Failed to load funding predictions");
        }
      }
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
      queueMicrotask(() => fetchPredictions());
    }
  }, [user, roleLoading, fetchPredictions, router]);

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

  /** Render a stat value or fallback dash */
  function formatRange(min, max) {
    if (min == null && max == null) return "—";
    if (min == null) return `Up to ${currencyFormatter.format(max)}`;
    if (max == null) return `From ${currencyFormatter.format(min)}`;
    return `${currencyFormatter.format(min)} – ${currencyFormatter.format(max)}`;
  }

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
              Funding Predictions
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base">
              AI-powered funding forecasts to help you plan your campaign goals.
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner
                size="lg"
                text="Analysing funding data..."
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
                  Unable to load predictions
                </h3>
                <p className="text-on-surface-variant text-sm mb-6">{error}</p>
                <Button variant="primary" onClick={fetchPredictions}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !predictions && (
            <EmptyState
              icon="insights"
              title="No predictions available"
              description="We couldn't generate funding predictions at this time. Please try again later."
              action={
                <Button variant="primary" onClick={fetchPredictions}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Retry
                </Button>
              }
            />
          )}

          {/* Predictions content */}
          {!loading && !error && predictions && (
            <div className="space-y-6">
              {/* Prediction cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Predicted funding range */}
                <GlassCard hover className="flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-[28px] text-primary">
                      payments
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-on-surface-variant">
                        Predicted Funding Range
                      </h3>
                      <p className="text-xl font-bold text-on-surface">
                        {formatRange(
                          predictions.predicted_min,
                          predictions.predicted_max,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-on-surface-variant">
                      Estimated range based on similar campaigns in your
                      category
                    </p>
                  </div>
                </GlassCard>

                {/* Confidence interval */}
                <GlassCard
                  hover
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-[28px] text-primary">
                      analytics
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-on-surface-variant">
                        Confidence Interval
                      </h3>
                      <p className="text-xl font-bold text-on-surface">
                        {predictions.confidence_interval != null
                          ? `${(predictions.confidence_interval * 100).toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-on-surface-variant">
                      Statistical confidence in the predicted funding range
                    </p>
                  </div>
                </GlassCard>

                {/* Suggested goal */}
                <GlassCard hover className="flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-[28px] text-success">
                      flag
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-on-surface-variant">
                        Suggested Goal Amount
                      </h3>
                      <p className="text-xl font-bold text-on-surface">
                        {predictions.suggested_goal != null
                          ? currencyFormatter.format(predictions.suggested_goal)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-on-surface-variant">
                      Recommended fundraising target for optimal results
                    </p>
                  </div>
                </GlassCard>

                {/* Timeline estimate */}
                <GlassCard hover className="flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-[28px] text-warning">
                      schedule
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-on-surface-variant">
                        Timeline Estimate
                      </h3>
                      <p className="text-xl font-bold text-on-surface">
                        {predictions.timeline_estimate
                          ? predictions.timeline_estimate
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-on-surface-variant">
                      Expected duration to reach the suggested goal
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Confidence bar visual */}
              {predictions.confidence_interval != null && (
                <GlassCard className="mt-4">
                  <h3 className="text-sm font-medium text-on-surface-variant mb-3">
                    Prediction Confidence
                  </h3>
                  <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, predictions.confidence_interval * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">
                    {`${(predictions.confidence_interval * 100).toFixed(0)}% confidence in this prediction`}
                  </p>
                </GlassCard>
              )}

              {/* Breakdown by category if available */}
              {predictions.breakdown &&
                Array.isArray(predictions.breakdown) &&
                predictions.breakdown.length > 0 && (
                  <GlassCard>
                    <h3 className="text-lg font-semibold text-on-surface mb-4">
                      Category Breakdown
                    </h3>
                    <div className="space-y-3">
                      {predictions.breakdown.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0"
                        >
                          <span className="text-sm text-on-surface capitalize">
                            {item.category || "General"}
                          </span>
                          <div className="flex items-center gap-4">
                            {item.avg_goal != null && (
                              <span className="text-xs text-on-surface-variant">
                                Avg: {currencyFormatter.format(item.avg_goal)}
                              </span>
                            )}
                            {item.count != null && (
                              <Badge variant="default">{item.count} campaigns</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}

              {/* Additional insights */}
              {predictions.insights && (
                <GlassCard>
                  <h3 className="text-lg font-semibold text-on-surface mb-3">
                    Insights
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {predictions.insights}
                  </p>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
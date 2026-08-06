import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import PageLayout from "../../components/PageLayout";
import {
  GlassCard,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  RetryError,
} from "../../components/ui";
import {
  loadInvestorDonations,
  derivePortfolioStats,
  derivePortfolioMetrics,
} from "../../lib/investor/investorData";
import { formatINR } from "../../lib/investor/investorFormat";

/**
 * If the donations query neither resolves nor rejects (offline, dropped
 * connection), this timeout forces the page out of the loading state so the
 * user is never stuck on an infinite spinner. Exported for tests.
 */
export const PORTFOLIO_TIMEOUT_MS = 15000;

const ERROR_MESSAGE = "Failed to load your portfolio. Please try again.";

export default function InvestorPortfolio() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  // Bump to re-run the load effect (Retry button).
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      // The query hung (offline etc.) — bail out of the spinner into an error.
      timedOut = true;
      if (!cancelled) {
        setLoading(false);
        setError(ERROR_MESSAGE);
      }
    }, PORTFOLIO_TIMEOUT_MS);

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const donations = await loadInvestorDonations(supabase, user?.id);
        clearTimeout(timer);
        if (cancelled || timedOut) return;
        const s = derivePortfolioStats(donations);
        setStats(s);
        setMetrics(derivePortfolioMetrics(s));
      } catch (err) {
        clearTimeout(timer);
        if (cancelled || timedOut) return;
        console.error("Portfolio load error:", err);
        setError(ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id, retryNonce]);

  if (authLoading || !user) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading portfolio..." />
        </div>
      </PageLayout>
    );
  }

  // Only settled ("paid") donations count; a user with no settled investments
  // sees the single empty state below.
  const hasPortfolio = !!stats && stats.projectsFunded > 0;
  const maxCategoryValue =
    hasPortfolio && metrics.categoryAllocation.length > 0
      ? Math.max(...metrics.categoryAllocation.map((c) => c.value), 1)
      : 1;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title="Portfolio"
            description="Your investment portfolio overview"
            icon="portfolio"
          />

          {loading ? (
            <div className="mt-12">
              <LoadingSpinner size="lg" text="Calculating portfolio stats..." />
            </div>
          ) : error ? (
            <div className="mt-12">
              <RetryError
                message={error}
                onRetry={() => setRetryNonce((n) => n + 1)}
              />
            </div>
          ) : !hasPortfolio ? (
            /* No settled investments — single empty state with a discover CTA. */
            <GlassCard className="mt-8">
              <EmptyState
                icon="pie_chart"
                title="You haven't invested in any projects yet."
                description="Your portfolio metrics will appear here after you fund your first project."
                action={
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
                  >
                    Browse Projects
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </Link>
                }
              />
            </GlassCard>
          ) : (
            <>
              {/* KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                <GlassCard hover>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                        Total Invested
                      </p>
                      <span
                        className="material-symbols-outlined text-[28px] text-green-400"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        account_balance
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white font-geist">
                      {formatINR(stats.totalInvested)}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Settled contributions only
                    </p>
                  </div>
                </GlassCard>

                <GlassCard hover>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                        Current Value
                      </p>
                      <span
                        className="material-symbols-outlined text-[28px] text-blue-400"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        trending_up
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white font-geist">
                      {formatINR(metrics.currentValue)}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      At current funding progress
                    </p>
                  </div>
                </GlassCard>

                <GlassCard hover>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                        ROI
                      </p>
                      <span
                        className="material-symbols-outlined text-[28px] text-purple-400"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        auto_graph
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white font-geist">
                      {metrics.roi}%
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Avg. funding progress
                    </p>
                  </div>
                </GlassCard>

                <GlassCard hover>
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                        Number of Projects
                      </p>
                      <span
                        className="material-symbols-outlined text-[28px] text-amber-400"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        rocket_launch
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white font-geist">
                      {stats.projectsFunded}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Unique projects funded
                    </p>
                  </div>
                </GlassCard>
              </div>

              {/* Diversification + Category Allocation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <GlassCard>
                  <h3 className="text-sm font-semibold text-white mb-3 font-geist">
                    Diversification
                  </h3>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-white font-geist">
                      {metrics.diversification}
                    </span>
                    <span className="text-on-surface-variant text-sm">
                      / 100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full"
                      style={{ width: `${metrics.diversification}%` }}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">
                    How spread out your investments are across projects.
                  </p>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-sm font-semibold text-white mb-3 font-geist">
                    Category Allocation
                  </h3>
                  {metrics.categoryAllocation.length === 0 ? (
                    <p className="text-on-surface-variant text-sm">
                      No category data yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {metrics.categoryAllocation.map((cat) => (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-on-surface-variant">
                              {cat.name}
                            </span>
                            <span className="text-white font-medium">
                              {formatINR(cat.value)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                              style={{
                                width: `${(cat.value / maxCategoryValue) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

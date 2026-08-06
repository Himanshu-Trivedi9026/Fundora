import { useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import { useRouter } from "next/router";
import PageLayout from "../../components/PageLayout";
import { GlassCard, EmptyState } from "../../components/ui";
import SectionCard from "../../components/dashboard/SectionCard";
import Breadcrumbs from "../../components/ui/Breadcrumbs";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import StatCard from "../../components/investor/StatCard";
import { formatINR } from "../../lib/investor/investorFormat";
import {
  loadInvestorDonations,
  deriveAnalytics,
} from "../../lib/investor/investorData";

// Lazily-loaded chart components — keeps recharts out of the main bundle
// (same pattern as pages/creator/analytics.js).
const InvestmentGrowthChart = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.InvestmentGrowthChart),
  { ssr: false },
);
const MonthlyInvestmentChart = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.MonthlyInvestmentChart),
  { ssr: false },
);
const PortfolioAllocationChart = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.PortfolioAllocationChart),
  { ssr: false },
);
const SectorDistributionChart = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.SectorDistributionChart),
  { ssr: false },
);
const HistoricalTrendsChart = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.HistoricalTrendsChart),
  { ssr: false },
);
const FundingTimeline = dynamic(
  () => import("../../components/investor/InvestorCharts").then((m) => m.FundingTimeline),
  { ssr: false },
);

const RANGES = [
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "1y", label: "1 Year" },
  { key: "all", label: "All Time" },
];

export default function InvestorAnalytics() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [donations, setDonations] = useState([]);
  const [range, setRange] = useState("all");
  const [allocationTab, setAllocationTab] = useState("category");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await loadInvestorDonations(supabase, user.id);
      setDonations(rows);
    } catch (err) {
      console.error("Analytics load error:", err);
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

  // Switching the time-range filter recomputes every widget from the already
  // fetched donations — no additional Supabase query.
  const analytics = useMemo(
    () => deriveAnalytics(donations, { range }),
    [donations, range],
  );

  // Auth guard
  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <div role="status" aria-label="Checking authentication" className="text-on-surface-variant text-lg">
            Checking authentication...
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  const { performance, roi } = analytics;
  const hasData = performance.totalInvested > 0;

  const performanceCards = [
    {
      label: "Total Invested",
      value: formatINR(performance.totalInvested),
      icon: "account_balance",
      color: "text-primary",
    },
    {
      label: "Projects Funded",
      value: performance.projectsFunded,
      icon: "rocket_launch",
      color: "text-success",
    },
    {
      label: "Avg per Project",
      value: formatINR(performance.avgPerProject),
      icon: "pie_chart",
      color: "text-[#f472b6]",
    },
    {
      label: "Average Investment",
      value: formatINR(performance.averageDonation),
      icon: "savings",
      color: "text-warning",
    },
    {
      label: "Largest Donation",
      value: formatINR(performance.largestDonation),
      icon: "local_activity",
      color: "text-[#a78bfa]",
    },
    {
      label: "Funding Success Rate",
      value: `${performance.successRate}%`,
      icon: "verified",
      color: "text-success",
    },
    {
      label: "Active Projects",
      value: performance.activeProjects,
      icon: "bolt",
      color: "text-primary",
    },
  ];

  const allocationData =
    allocationTab === "category"
      ? analytics.portfolioAllocation.byCategory
      : analytics.portfolioAllocation.byProject;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <Breadcrumbs items={[{ label: "Investor", href: "/investor/dashboard" }, { label: "Analytics" }]} />

          <PageHeader
            icon="insights"
            title="Investment Analytics"
            description="Track your portfolio growth, allocation, and funding performance over time."
            action={
              <div
                className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1"
                role="group"
                aria-label="Time range filter"
              >
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    aria-pressed={range === r.key}
                    className={`px-3 py-1.5 text-xs font-inter rounded-md transition-all cursor-pointer ${
                      range === r.key
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          />

          {loading ? (
            <SectionCard title="Loading analytics" icon="insights" loading={loading} />
          ) : error ? (
            <SectionCard title="Analytics" icon="insights" error={error} onRetry={load} />
          ) : !hasData ? (
            /* Onboarding empty state — new investors see a single CTA instead
               of a grid of empty widgets. */
            <GlassCard className="fade-in-up">
              <EmptyState
                icon="bar_chart"
                title="No investment data yet"
                description="Your analytics will appear here once you back your first project. Discover campaigns that match your interests."
                action={
                  <Link href="/explore">
                    <Button variant="primary">
                      <span className="material-symbols-outlined text-[18px]">explore</span>
                      Explore Projects
                    </Button>
                  </Link>
                }
              />
            </GlassCard>
          ) : (
            <>
              {/* Performance metrics */}
              <div className="fade-in-up">
                <SectionCard title="Performance Metrics" icon="monitoring">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {performanceCards.map((card) => (
                      <StatCard key={card.label} {...card} />
                    ))}
                  </div>
                </SectionCard>
              </div>

              {/* ROI + first chart row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="fade-in-up lg:col-span-1">
                  <GlassCard className="h-full flex flex-col justify-center">
                    <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider mb-2">
                      Return on Investment
                    </p>
                    <p className="text-4xl font-bold text-primary font-geist">{roi}%</p>
                    <p className="text-xs text-on-surface-variant font-inter mt-2">
                      Average funding progress of the projects you&apos;ve backed
                    </p>
                  </GlassCard>
                </div>
                <div className="fade-in-up lg:col-span-2">
                  <SectionCard title="Investment Growth" icon="trending_up">
                    <InvestmentGrowthChart data={analytics.investmentGrowth} />
                  </SectionCard>
                </div>
              </div>

              {/* Monthly + Allocation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="fade-in-up">
                  <SectionCard title="Monthly Investment" icon="calendar_month">
                    <MonthlyInvestmentChart data={analytics.monthlyInvestment} />
                  </SectionCard>
                </div>
                <div className="fade-in-up">
                  <SectionCard
                    title="Portfolio Allocation"
                    icon="pie_chart"
                    className="h-full"
                  >
                    <div
                      className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 mb-4 w-fit"
                      role="group"
                      aria-label="Allocation view"
                    >
                      <button
                        type="button"
                        onClick={() => setAllocationTab("category")}
                        aria-pressed={allocationTab === "category"}
                        className={`px-3 py-1 text-xs font-inter rounded-md transition-all cursor-pointer ${
                          allocationTab === "category"
                            ? "bg-primary text-on-primary"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06]"
                        }`}
                      >
                        By Category
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllocationTab("project")}
                        aria-pressed={allocationTab === "project"}
                        className={`px-3 py-1 text-xs font-inter rounded-md transition-all cursor-pointer ${
                          allocationTab === "project"
                            ? "bg-primary text-on-primary"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06]"
                        }`}
                      >
                        By Project
                      </button>
                    </div>
                    <PortfolioAllocationChart data={allocationData} />
                  </SectionCard>
                </div>
              </div>

              {/* Sector + Historical */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="fade-in-up">
                  <SectionCard title="Sector Distribution" icon="category">
                    <SectorDistributionChart data={analytics.sectorDistribution} />
                  </SectionCard>
                </div>
                <div className="fade-in-up">
                  <SectionCard title="Historical Trends" icon="history">
                    <HistoricalTrendsChart data={analytics.historicalTrends} />
                  </SectionCard>
                </div>
              </div>

              {/* Funding timeline */}
              <div className="fade-in-up">
                <SectionCard title="Funding Timeline" icon="timeline">
                  <FundingTimeline data={analytics.fundingTimeline} />
                </SectionCard>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

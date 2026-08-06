import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import PageLayout from "../../components/PageLayout";
import { GlassCard, EmptyState } from "../../components/ui";
import SectionCard from "../../components/dashboard/SectionCard";
import Breadcrumbs from "../../components/ui/Breadcrumbs";
import WelcomeCard from "../../components/WelcomeCard";
import QuickActions from "../../components/QuickActions";
import Button from "../../components/ui/Button";
import ProjectCard from "../../components/ProjectCard";
import StatCard from "../../components/investor/StatCard";
import PortfolioHealthCard from "../../components/investor/PortfolioHealthCard";
import { formatINR } from "../../lib/investor/investorFormat";
import {
  loadInvestorPortfolio,
  loadRecommendedProjects,
  deriveAiInsights,
  computePortfolioHealth,
} from "../../lib/investor/investorData";

export default function InvestorDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [savedProjects, setSavedProjects] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [recentDonations, setRecentDonations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [creatorMap, setCreatorMap] = useState({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadDashboardData = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const [portfolio, recs] = await Promise.all([
        loadInvestorPortfolio(supabase, user.id),
        loadRecommendedProjects(supabase, user.id),
      ]);
      setStats(portfolio.stats);
      setSavedProjects(portfolio.savedProjects);
      setFollowers(portfolio.followers);
      setRecentDonations(portfolio.donations);
      setRecommendations(recs.recommendations);
      setCreatorMap(recs.creatorMap);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    queueMicrotask(() => loadDashboardData());
  }, [loadDashboardData]);

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

  const hasInvestments = stats ? stats.totalInvested > 0 || stats.projectsFunded > 0 : false;
  const statsRef = stats || {
    totalInvested: 0,
    projectsFunded: 0,
    avgPerProject: 0,
    averageDonation: 0,
    largestDonation: 0,
    pendingAmount: 0,
    failedCount: 0,
    refundedCount: 0,
    completedCount: 0,
    fundedProjects: [],
    activeMonths: 0,
    firstSettledAt: null,
    lastSettledAt: null,
  };

  const welcomeTips = hasInvestments
    ? [
        "Track your portfolio performance and investment history",
        "Discover new campaigns aligned with your interests",
        "Engage with creators through direct messages",
      ]
    : [
        "Explore projects that match your interests",
        "Start your investment journey with as little as ₹100",
        "Save projects to revisit them later",
      ];

  const quickActions = [
    { label: "Explore Projects", href: "/explore", icon: "explore", description: "Discover new campaigns" },
    { label: "Saved Projects", href: "/saved", icon: "bookmark", description: "View your saved projects" },
    { label: "Analytics", href: "/investor/analytics", icon: "insights", description: "Track your performance" },
    { label: "My Investments", href: "/investor/investments", icon: "account_balance", description: "Review your donations" },
  ];

  const portfolioCards = [
    { label: "Total Invested", value: formatINR(statsRef.totalInvested), icon: "account_balance", color: "text-primary" },
    { label: "Projects Funded", value: statsRef.projectsFunded, icon: "rocket_launch", color: "text-success" },
    { label: "Saved Projects", value: savedProjects, icon: "bookmark", color: "text-warning" },
    { label: "Followers", value: followers, icon: "people", color: "text-[#f472b6]" },
  ];

  const insights = deriveAiInsights({
    stats: statsRef,
    donations: recentDonations,
    recommendations,
  });
  const health = computePortfolioHealth(statsRef);

  // Latest Investments: most-recently-funded unique projects.
  const latestInvestments = (statsRef.fundedProjects || []).slice(0, 6);

  const onboarding = (
    <GlassCard className="fade-in-up">
      <EmptyState
        icon="rocket_launch"
        title="Start your investment journey"
        description="Back your first project to see your portfolio summary, AI insights, and analytics appear here."
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
  );

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: "Investor", href: "/investor/dashboard" }, { label: "Overview" }]} />

          {/* Welcome Card */}
          <WelcomeCard
            userName={user?.user_metadata?.full_name || user?.email || ""}
            role="investor"
            tips={welcomeTips}
          />

          {/* Quick Actions */}
          <div className="fade-in-up" style={{ animationDelay: "0.06s" }}>
            <div>
              <h3 className="text-sm font-semibold text-on-surface font-geist mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">bolt</span>
                Quick Actions
              </h3>
              <QuickActions actions={quickActions} />
            </div>
          </div>

          {loading ? (
            <SectionCard title="Portfolio Overview" icon="account_balance" loading={loading} />
          ) : error ? (
            <SectionCard title="Portfolio Overview" icon="account_balance" error={error} onRetry={loadDashboardData} />
          ) : !hasInvestments ? (
            /* Onboarding — a single empty state for new investors; the
               Recommended Projects section below still encourages discovery. */
            <>
              {onboarding}
              <div className="fade-in-up">
                <SectionCard
                  title="Recommended Projects"
                  icon="auto_awesome"
                  empty={recommendations.length === 0}
                  emptyIcon="explore"
                  emptyTitle="No projects to recommend yet"
                  emptyAction={
                    <Link href="/explore">
                      <Button variant="primary">
                        <span className="material-symbols-outlined text-[18px]">explore</span>
                        Explore Projects
                      </Button>
                    </Link>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendations.map((rec) => (
                      <ProjectCard
                        key={rec.project.id}
                        project={rec.project}
                        currentUserId={user.id}
                        creatorName={creatorMap[rec.project.owner_id]}
                      />
                    ))}
                  </div>
                </SectionCard>
              </div>
            </>
          ) : (
            <>
              {/* Portfolio Summary */}
              <div className="fade-in-up" style={{ animationDelay: "0.12s" }}>
                <SectionCard title="Portfolio Summary" icon="account_balance">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {portfolioCards.map((card) => (
                      <StatCard key={card.label} {...card} />
                    ))}
                  </div>
                </SectionCard>
              </div>

              {/* AI Recommendations — directly below Portfolio Summary */}
              <div className="fade-in-up" style={{ animationDelay: "0.18s" }}>
                <SectionCard title="AI Recommendations" icon="auto_awesome">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-3">
                      <div className="glass-card p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                            Confidence
                          </p>
                          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">verified</span>
                        </div>
                        <p className="text-2xl font-bold text-on-surface font-geist">
                          {insights.confidence}%
                        </p>
                        <p className="text-[11px] text-on-surface-variant font-inter mt-1">
                          Verified by Fundora AI
                        </p>
                      </div>
                      <div className="glass-card p-4">
                        <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider mb-2">
                          Strongest Sector
                        </p>
                        <p className="text-lg font-semibold text-on-surface font-geist">
                          {insights.strongestSector || "—"}
                        </p>
                        <p className="text-[11px] text-on-surface-variant font-inter mt-1">
                          Next: {insights.nextRecommendedCategory || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-2 glass-card p-4 flex flex-col justify-between">
                      <div>
                        <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider mb-2">
                          Top Pick
                        </p>
                        {insights.topPick ? (
                          <Link href={`/projects/${insights.topPick.project.id}`}>
                            <h4 className="text-lg font-semibold text-on-surface font-geist hover:text-primary transition-colors">
                              {insights.topPick.project.title}
                            </h4>
                          </Link>
                        ) : (
                          <p className="text-on-surface-variant font-inter text-sm">
                            Explore projects to get your first recommendation.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-on-surface-variant font-inter">
                          {insights.topPick
                            ? `AI growth score ${insights.topPick.score}/100`
                            : "Back a project to unlock insights"}
                        </p>
                        <p className="text-xs text-on-surface-variant font-inter">
                          {statsRef.completedCount} contribution{statsRef.completedCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Portfolio Health Score */}
              <div className="fade-in-up" style={{ animationDelay: "0.24s" }}>
                <PortfolioHealthCard health={health} />
              </div>

              {/* Recent Activity */}
              <div className="fade-in-up" style={{ animationDelay: "0.3s" }}>
                <SectionCard
                  title="Recent Activity"
                  icon="receipt_long"
                  empty={recentDonations.length === 0}
                  emptyIcon="receipt_long"
                  emptyTitle="No activity yet"
                  emptyAction={
                    <Link href="/explore">
                      <Button variant="primary">
                        <span className="material-symbols-outlined text-[18px]">explore</span>
                        Explore Projects
                      </Button>
                    </Link>
                  }
                  viewAllLink={recentDonations.length > 0 ? "/investor/investments" : undefined}
                >
                  <div className="space-y-2">
                    {recentDonations.slice(0, 5).map((donation) => (
                      <Link key={donation.id} href={`/projects/${donation.project_id}`}>
                        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">
                              payments
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-on-surface truncate">
                              {donation.projects?.title || "Unknown Project"}
                            </p>
                            <p className="text-xs text-on-surface-variant">
                              {new Date(donation.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-success">
                              +{formatINR(donation.amount || 0)}
                            </p>
                            <span
                              className={`text-[10px] uppercase tracking-wider ${
                                donation.status === "paid"
                                  ? "text-success"
                                  : donation.status === "pending"
                                  ? "text-warning"
                                  : "text-on-surface-variant"
                              }`}
                            >
                              {donation.status || "N/A"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
              </div>

              {/* Recommended Projects */}
              <div className="fade-in-up" style={{ animationDelay: "0.36s" }}>
                <SectionCard
                  title="Recommended Projects"
                  icon="auto_awesome"
                  empty={recommendations.length === 0}
                  emptyIcon="explore"
                  emptyTitle="No projects to recommend yet"
                  emptyAction={
                    <Link href="/explore">
                      <Button variant="primary">
                        <span className="material-symbols-outlined text-[18px]">explore</span>
                        Explore Projects
                      </Button>
                    </Link>
                  }
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recommendations.map((rec) => (
                        <ProjectCard
                          key={rec.project.id}
                          project={rec.project}
                          currentUserId={user.id}
                          creatorName={creatorMap[rec.project.owner_id]}
                        />
                      ))}
                    </div>
                    {recommendations.length > 0 && (
                      <div className="space-y-2">
                        {recommendations.map((rec) => (
                          <div
                            key={`reason-${rec.project.id}`}
                            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.02] text-xs text-on-surface-variant font-inter"
                          >
                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5" aria-hidden="true">
                              auto_awesome
                            </span>
                            <span>
                              <span className="text-on-surface font-medium">{rec.project.title}:</span>{" "}
                              {rec.reasons.join(" · ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* Latest Investments */}
              <div className="fade-in-up" style={{ animationDelay: "0.42s" }}>
                <SectionCard
                  title="Latest Investments"
                  icon="history"
                  empty={latestInvestments.length === 0}
                  emptyIcon="account_balance"
                  emptyTitle="No investments yet"
                  emptyAction={
                    <Link href="/explore">
                      <Button variant="primary">
                        <span className="material-symbols-outlined text-[18px]">explore</span>
                        Explore Projects
                      </Button>
                    </Link>
                  }
                >
                  <div className="space-y-2">
                    {latestInvestments.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}`}>
                        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-success text-[20px]" aria-hidden="true">
                              account_balance
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-on-surface truncate">{p.title}</p>
                            <p className="text-xs text-on-surface-variant">
                              {new Date(p.lastDonatedAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-success">+{formatINR(p.invested)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

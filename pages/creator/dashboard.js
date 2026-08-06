import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import SectionCard from "../../components/dashboard/SectionCard";
import Breadcrumbs from "../../components/ui/Breadcrumbs";
import WelcomeCard from "../../components/WelcomeCard";
import QuickActions from "../../components/QuickActions";
import Skeleton from "../../components/ui/Skeleton";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import VerificationGate from "../../components/verification/VerificationGate";
import { useVerification } from "../../context/VerificationContext";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  return currencyFormatter.format(amount);
}

export default function CreatorDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const { verification } = useVerification();
  const [data, setData] = useState({
    projectCount: 0,
    totalRaised: 0,
    escrowBalance: 0,
    escrowHeld: 0,
    verificationStatus: null,
    latestProject: null,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (authLoading || !user) return;
    setDataLoading(true);
    setError(null);
    try {
      // projects uses the real funding columns (pledged/goal). There is no
      // `status`/`raised_amount`/`goal_amount`, and ownership is `owner_id`,
      // not `creator_id` (null on every live row).
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, title, pledged, goal, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      const projectCount = projects ? projects.length : 0;
      const totalRaised =
        projects?.reduce((sum, p) => sum + (parseFloat(p.pledged) || 0), 0) ||
        0;
      const latestProject =
        projects && projects.length > 0 ? projects[0] : null;

      // escrow_accounts and creator_verifications do not exist in the live
      // schema. Escrow is shown as 0, and verification status comes from
      // VerificationContext (which suppresses the missing table).
      setData({
        projectCount,
        totalRaised,
        escrowBalance: 0,
        escrowHeld: 0,
        verificationStatus: verification?.verification_status || null,
        latestProject,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setDataLoading(false);
    }
  }, [user, authLoading, verification]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    queueMicrotask(() => fetchDashboard());
  }, [user, authLoading, fetchDashboard, router]);

  const getVerificationBadge = (status) => {
    if (!status) return <Badge variant="warning">Not Submitted</Badge>;
    const badgeMap = {
      approved: <Badge variant="success">Approved</Badge>,
      pending: <Badge variant="warning">Pending</Badge>,
      rejected: <Badge variant="danger">Rejected</Badge>,
    };
    return badgeMap[status] || <Badge variant="default">{status}</Badge>;
  };

  const getStatusBadge = (status) => {
    const badgeMap = {
      draft: <Badge variant="default">Draft</Badge>,
      active: <Badge variant="primary">Active</Badge>,
      funded: <Badge variant="success">Funded</Badge>,
      completed: <Badge variant="success">Completed</Badge>,
      cancelled: <Badge variant="danger">Cancelled</Badge>,
    };
    return badgeMap[status] || <Badge variant="default">{status}</Badge>;
  };

  // Auth guard
  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <div
            role="status"
            aria-label="Checking authentication"
            className="text-on-surface-variant text-lg"
          >
            Checking authentication...
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  // projects has no `status` column — derive a display state from the real
  // funding columns (goal > 0 && pledged >= goal ⇒ "funded", else "active").
  const latestProjectStatus =
    data.latestProject &&
    (parseFloat(data.latestProject.goal) || 0) > 0 &&
    (parseFloat(data.latestProject.pledged) || 0) >=
      parseFloat(data.latestProject.goal)
      ? "funded"
      : "active";

  const welcomeTips =
    data.projectCount === 0
      ? [
          "Create your first campaign to start raising funds",
          "Complete your creator verification to build trust",
          "Set up Razorpay integration for secure payouts",
        ]
      : [
          "Track campaign performance in real-time analytics",
          "Engage with your backers through DMs and updates",
          "Manage milestones to unlock escrow funds",
        ];

  const quickActions = [
    {
      label: "Create Campaign",
      href: "/create",
      icon: "add_circle",
      description: "Launch a new project",
    },
    {
      label: "Analytics",
      href: "/creator/analytics",
      icon: "analytics",
      description: "Track performance",
    },
    {
      label: "Milestones",
      href: "/creator/milestones",
      icon: "flag",
      description: "Manage milestones",
    },
    {
      label: "Verification",
      href: "/creator/verification",
      icon: "verified_user",
      description: "Verify your identity",
    },
  ];

  const stats = [
    {
      label: "Total Projects",
      value: data.projectCount,
      icon: "folder",
      color: "text-primary",
    },
    {
      label: "Total Funds Raised",
      value: formatCurrency(data.totalRaised),
      icon: "account_balance",
      color: "text-success",
    },
    {
      label: "Escrow Balance",
      value: formatCurrency(data.escrowBalance),
      icon: "lock",
      color: "text-warning",
    },
    {
      label: "Verification Status",
      value: null,
      icon: "verified",
      color: "text-primary",
      badge: getVerificationBadge(data.verificationStatus),
    },
  ];

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <VerificationGate>
            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                { label: "Creator", href: "/creator/dashboard" },
                { label: "Dashboard" },
              ]}
            />

            {/* Welcome Card */}
            <WelcomeCard
              userName={user?.user_metadata?.full_name || user?.email || ""}
              role="creator"
              tips={welcomeTips}
            />

            {/* Stats grid */}
            <div className="fade-in-up" style={{ animationDelay: "0.06s" }}>
              <SectionCard
                title="Campaign Overview"
                icon="dashboard"
                loading={dataLoading}
                error={error}
                onRetry={fetchDashboard}
                empty={false}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.map((stat, index) => (
                    <div
                      key={index}
                      className="glass-card p-4 hover:border-primary/30 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span
                          className={`material-symbols-outlined text-[28px] ${stat.color}`}
                          aria-hidden="true"
                        >
                          {stat.icon}
                        </span>
                      </div>
                      <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider mb-1">
                        {stat.label}
                      </p>
                      {stat.badge ? (
                        <div>{stat.badge}</div>
                      ) : (
                        <p className="text-xl md:text-2xl font-bold text-on-surface font-geist">
                          {stat.value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* Quick Actions */}
            <div className="fade-in-up" style={{ animationDelay: "0.12s" }}>
              <div>
                <h3 className="text-sm font-semibold text-on-surface font-geist mb-3 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[18px] text-primary"
                    aria-hidden="true"
                  >
                    bolt
                  </span>
                  Quick Actions
                </h3>
                <QuickActions actions={quickActions} />
              </div>
            </div>

            {/* Latest Project + Escrow */}
            <div className="fade-in-up" style={{ animationDelay: "0.18s" }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Latest Project */}
                <div className="lg:col-span-2">
                  <SectionCard
                    title="Latest Project"
                    icon="campaign"
                    loading={dataLoading}
                    error={null}
                    empty={!data.latestProject}
                    emptyIcon="campaign"
                    emptyTitle="No projects yet"
                    emptyAction={
                      <Link href="/create">
                        <Button variant="primary">
                          <span className="material-symbols-outlined text-[18px]">
                            add
                          </span>
                          Create Campaign
                        </Button>
                      </Link>
                    }
                    viewAllLink={
                      data.projectCount > 0 ? "/creator/projects" : undefined
                    }
                  >
                    {data.latestProject && (
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-on-surface font-geist truncate">
                              {data.latestProject.title}
                            </h3>
                            {getStatusBadge(latestProjectStatus)}
                          </div>
                          <div className="flex flex-wrap gap-6 text-sm">
                            <div>
                              <span className="text-on-surface-variant">
                                Raised:{" "}
                              </span>
                              <span className="text-success font-semibold">
                                {formatCurrency(data.latestProject.pledged)}
                              </span>
                            </div>
                            <div>
                              <span className="text-on-surface-variant">
                                Goal:{" "}
                              </span>
                              <span className="text-on-surface font-semibold">
                                {formatCurrency(data.latestProject.goal)}
                              </span>
                            </div>
                          </div>
                          {data.latestProject.goal > 0 && (
                            <div className="mt-3 w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{
                                  width: `${Math.min(
                                    ((parseFloat(data.latestProject.pledged) ||
                                      0) /
                                      parseFloat(data.latestProject.goal)) *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Link href={`/edit/${data.latestProject.id}`}>
                            <Button variant="secondary" size="sm">
                              <span className="material-symbols-outlined text-[16px]">
                                edit
                              </span>
                              Edit
                            </Button>
                          </Link>
                          <Link href={`/projects/${data.latestProject.id}`}>
                            <Button variant="primary" size="sm">
                              <span className="material-symbols-outlined text-[16px]">
                                visibility
                              </span>
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* Escrow Summary */}
                <div className="lg:col-span-1">
                  <SectionCard
                    title="Escrow Summary"
                    icon="lock"
                    loading={dataLoading}
                    error={null}
                    empty={false}
                    viewAllLink={"/creator/funds-got"}
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-on-surface-variant font-inter uppercase tracking-wider mb-1">
                          Available Balance
                        </p>
                        <p className="text-2xl font-bold text-on-surface font-geist">
                          {formatCurrency(data.escrowBalance - data.escrowHeld)}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-white/[0.06]">
                        <div className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">
                            On Hold
                          </span>
                          <span className="text-on-surface font-medium">
                            {formatCurrency(data.escrowHeld)}
                          </span>
                        </div>
                      </div>
                      <Link href="/creator/funds-got">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            payments
                          </span>
                          View Earnings
                        </Button>
                      </Link>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          </VerificationGate>
        </div>
      </div>
    </PageLayout>
  );
}

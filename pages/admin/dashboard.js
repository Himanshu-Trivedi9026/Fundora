/**
 * Admin Dashboard — Platform overview for administrators.
 *
 * Fetches from existing APIs only:
 *   /api/admin/platform-analytics?mode=health
 *   /api/admin/escrow-dashboard?mode=overview
 *   /api/admin/fraud-dashboard?mode=overview
 *   /api/admin/compliance-dashboard?mode=overview
 *
 * No new APIs created. Uses Promise.allSettled for resilience.
 */

import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import SectionCard from "../../components/dashboard/SectionCard";
import Breadcrumbs from "../../components/ui/Breadcrumbs";
import WelcomeCard from "../../components/WelcomeCard";
import QuickActions from "../../components/QuickActions";
import { useRole } from "../../context/RoleContext";
import { authFetch } from "../../lib/authFetch";

function formatNumber(n) {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

function formatCurrency(n) {
  if (n == null || isNaN(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [fraud, setFraud] = useState(null);
  const [compliance, setCompliance] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, escrowRes, fraudRes, complianceRes] =
        await Promise.allSettled([
          authFetch("/api/admin/platform-analytics?mode=health"),
          authFetch("/api/admin/escrow-dashboard?mode=overview"),
          authFetch("/api/admin/fraud-dashboard?mode=overview"),
          authFetch("/api/admin/compliance-dashboard?mode=overview"),
        ]);

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        const d = await healthRes.value.json();
        setHealth(d.data || d);
      }
      if (escrowRes.status === "fulfilled" && escrowRes.value.ok) {
        const d = await escrowRes.value.json();
        setEscrow(d.data || d);
      }
      if (fraudRes.status === "fulfilled" && fraudRes.value.ok) {
        const d = await fraudRes.value.json();
        setFraud(d.data || d);
      }
      if (complianceRes.status === "fulfilled" && complianceRes.value.ok) {
        const d = await complianceRes.value.json();
        setCompliance(d.data || d);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    queueMicrotask(() => loadAll());
  }, [user, authLoading, loadAll, router]);

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

  const statCards = [
    {
      label: "Platform Health",
      value: health?.status || "—",
      icon: "monitor_heart",
      color:
        health?.status === "healthy"
          ? "text-success"
          : health?.status === "degraded"
            ? "text-warning"
            : "text-danger",
      href: "/admin/infrastructure",
    },
    {
      label: "Total Users",
      value: formatNumber(health?.totalUsers ?? health?.users ?? 0),
      icon: "people",
      color: "text-primary",
      href: "/admin/organizations",
    },
    {
      label: "Active Campaigns",
      value: formatNumber(health?.activeCampaigns ?? health?.campaigns ?? 0),
      icon: "campaign",
      color: "text-success",
      href: "/admin/analytics",
    },
    {
      label: "Fraud Cases",
      value: formatNumber(fraud?.totalCases ?? fraud?.total ?? 0),
      icon: "gpp_bad",
      color: fraud?.totalCases > 10 ? "text-danger" : "text-success",
      href: "/admin/fraud",
    },
    {
      label: "Escrow (Locked)",
      value: formatCurrency(escrow?.totalLocked ?? 0),
      icon: "lock",
      color: "text-warning",
      href: "/admin/escrow",
    },
    {
      label: "Escrow (Released)",
      value: formatCurrency(escrow?.totalReleased ?? 0),
      icon: "check_circle",
      color: "text-success",
      href: "/admin/escrow",
    },
    {
      label: "Pending Reviews",
      value: formatNumber(compliance?.pendingCases ?? compliance?.pending ?? 0),
      icon: "fact_check",
      color: compliance?.pendingCases > 0 ? "text-warning" : "text-success",
      href: "/admin/verification-review",
    },
    {
      label: "Platform Revenue",
      value: formatCurrency(escrow?.totalFees ?? 0),
      icon: "payments",
      color: "text-success",
      href: "/admin/analytics",
    },
  ];

  const quickActions = [
    {
      label: "Verification Queue",
      href: "/admin/verification-review",
      icon: "verified",
      description: "Review creator verifications",
    },
    {
      label: "Fraud Center",
      href: "/admin/fraud",
      icon: "gpp_maybe",
      description: "Monitor fraud alerts",
    },
    {
      label: "Escrow Monitoring",
      href: "/admin/escrow",
      icon: "account_balance",
      description: "Track escrow accounts",
    },
    {
      label: "Compliance Center",
      href: "/admin/compliance",
      icon: "gavel",
      description: "Compliance overview",
    },
    {
      label: "Platform Analytics",
      href: "/admin/analytics",
      icon: "analytics",
      description: "Deep analytics",
    },
    {
      label: "Audit Logs",
      href: "/admin/audit-logs",
      icon: "history",
      description: "System audit trail",
    },
    {
      label: "System Health",
      href: "/admin/infrastructure",
      icon: "monitoring",
      description: "Infrastructure status",
    },
    {
      label: "Moderation",
      href: "/admin/moderation",
      icon: "shield",
      description: "Content moderation",
    },
  ];

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Dashboard" },
            ]}
          />

          {/* Welcome Card */}
          <WelcomeCard
            userName={user?.user_metadata?.full_name || user?.email || ""}
            role="admin"
            tips={[
              "Monitor platform health and key metrics at a glance",
              "Review pending verification and fraud cases",
              "Track escrow balances and platform revenue",
            ]}
          />

          {/* Platform Overview Stats */}
          <div className="fade-in-up" style={{ animationDelay: "0.06s" }}>
            <SectionCard
              title="Platform Overview"
              icon="dashboard"
              loading={loading}
              error={error}
              onRetry={loadAll}
              empty={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                  <Link key={card.label} href={card.href}>
                    <div className="glass-card p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
                            {card.label}
                          </p>
                          <p
                            className={`text-xl md:text-2xl font-bold font-geist mt-1 ${card.color}`}
                          >
                            {card.value}
                          </p>
                        </div>
                        <span
                          className={`material-symbols-outlined text-[28px] ${card.color}`}
                          aria-hidden="true"
                        >
                          {card.icon}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Admin Sections */}
          <div className="fade-in-up" style={{ animationDelay: "0.12s" }}>
            <div>
              <h3 className="text-sm font-semibold text-on-surface font-geist mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[18px] text-primary"
                  aria-hidden="true"
                >
                  settings
                </span>
                Admin Sections
              </h3>
              <QuickActions actions={quickActions} />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

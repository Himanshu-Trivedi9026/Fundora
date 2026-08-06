import Image from "next/image";
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
import { loadInvestorDonations } from "../../lib/investor/investorData";
import { formatINR } from "../../lib/investor/investorFormat";

/**
 * If the donations query neither resolves nor rejects (offline, dropped
 * connection), this timeout forces the page out of the loading state so the
 * user is never stuck on an infinite spinner. Exported for tests.
 */
export const INVESTMENTS_TIMEOUT_MS = 15000;

const ERROR_MESSAGE = "Failed to load your investments. Please try again.";

export default function InvestorInvestments() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [totalInvested, setTotalInvested] = useState(0);
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
    }, INVESTMENTS_TIMEOUT_MS);

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const rows = await loadInvestorDonations(supabase, user?.id);
        clearTimeout(timer);
        if (cancelled || timedOut) return;
        setDonations(rows);
        setTotalInvested(
          rows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
        );
      } catch (err) {
        clearTimeout(timer);
        if (cancelled || timedOut) return;
        console.error("Investments load error:", err);
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
          <LoadingSpinner size="lg" text="Loading investments..." />
        </div>
      </PageLayout>
    );
  }

  function getStatusColor(status) {
    switch (status) {
      case "paid":
      case "completed":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "failed":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "refunded":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default:
        return "bg-white/5 text-on-surface-variant border-white/10";
    }
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title="My Investments"
            description="Track all your funded projects"
            icon="payments"
          />

          {loading ? (
            <div className="mt-12">
              <LoadingSpinner size="lg" text="Loading investments..." />
            </div>
          ) : error ? (
            <div className="mt-12">
              <RetryError
                message={error}
                onRetry={() => setRetryNonce((n) => n + 1)}
              />
            </div>
          ) : donations.length === 0 ? (
            /* No investments yet — single empty state with a discover CTA. */
            <GlassCard className="mt-8">
              <EmptyState
                icon="account_balance_wallet"
                title="You haven't invested in any projects yet."
                description="When you fund a project, it will appear here."
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
              {/* Summary Card */}
              <GlassCard className="mt-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-on-surface-variant text-xs uppercase tracking-wider font-inter">
                      Total Invested
                    </p>
                    <p className="text-3xl font-bold text-white mt-1 font-geist">
                      {formatINR(totalInvested)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-on-surface-variant text-xs uppercase tracking-wider font-inter">
                      Projects Funded
                    </p>
                    <p className="text-2xl font-bold text-white mt-1 font-geist">
                      {donations.length}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Investments List */}
              <div className="mt-6 space-y-3">
                {donations.map((donation) => (
                  <GlassCard key={donation.id} padding="sm" hover>
                    <a
                      href={`/projects/${donation.project_id}`}
                      className="flex items-center gap-4"
                    >
                      {/* Project thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0">
                        {donation.projects?.thumbnail ? (
                          <Image
                            src={donation.projects.thumbnail}
                            alt={donation.projects.title}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                              image
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Project details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {donation.projects?.title || "Unknown Project"}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {new Date(donation.created_at).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-400">
                          {formatINR(donation.amount || 0)}
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(
                            donation.status,
                          )}`}
                        >
                          {donation.status || "N/A"}
                        </span>
                      </div>
                    </a>
                  </GlassCard>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

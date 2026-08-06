import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import PageLayout from "../../components/PageLayout";
import {
  GlassCard,
  PageHeader,
  LoadingSpinner,
  EmptyState,
} from "../../components/ui";

export default function PaymentHistory() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadPaymentHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: payErr } = await supabase
        .from("public_donations")
        .select(
          `
          id,
          amount,
          created_at,
          status,
          project_id,
          projects:project_id (
            id,
            title,
            slug,
            thumbnail
          )
        `,
        )
        .eq("payer_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      if (payErr) throw payErr;

      setPayments(data || []);
    } catch (err) {
      console.error("Payment history load error:", err);
      setError("Failed to load payment history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load the current user's successful payments once auth resolves.
  useEffect(() => {
    if (user) queueMicrotask(() => loadPaymentHistory());
  }, [user, loadPaymentHistory]);

  function getStatusBadge(status) {
    switch (status) {
      case "paid":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Paid
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Failed
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-on-surface-variant border border-white/10">
            {status || "N/A"}
          </span>
        );
    }
  }

  function formatAmount(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  if (authLoading || !user) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading payment history..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title="Payment History"
            description="View all your successful payments and transactions"
            icon="receipt_long"
          />

          {loading ? (
            <div className="mt-12">
              <LoadingSpinner size="lg" text="Loading payment history..." />
            </div>
          ) : error ? (
            <div className="mt-12">
              <GlassCard>
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">
                    error
                  </span>
                  <p className="text-red-300">{error}</p>
                  <button
                    onClick={() => loadPaymentHistory()}
                    className="mt-4 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </GlassCard>
            </div>
          ) : (
            <div className="mt-8">
              {payments.length === 0 ? (
                <GlassCard>
                  <EmptyState
                    icon="credit_card_off"
                    title="No payments yet"
                    description="Your successful payment transactions will appear here."
                    action={
                      <Link
                        href="/explore"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
                      >
                        Fund a Project
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_forward
                        </span>
                      </Link>
                    }
                  />
                </GlassCard>
              ) : (
                <>
                  {/* Mobile: Card layout */}
                  <div className="block lg:hidden space-y-3">
                    {payments.map((payment) => (
                      <GlassCard key={payment.id} padding="sm">
                        <a
                          href={`/projects/${payment.project_id}`}
                          className="block"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {payment.projects?.title || "Unknown Project"}
                              </p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {new Date(
                                  payment.created_at,
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-green-400 ml-3">
                              {formatAmount(payment.amount)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {getStatusBadge(payment.status)}
                          </div>
                        </a>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Desktop: Table layout */}
                  <div className="hidden lg:block">
                    <GlassCard padding="none">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                Date
                              </th>
                              <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                Project
                              </th>
                              <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                Amount
                              </th>
                              <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((payment) => (
                              <tr
                                key={payment.id}
                                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                              >
                                <td className="px-6 py-4 text-sm text-on-surface-variant whitespace-nowrap">
                                  {new Date(
                                    payment.created_at,
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </td>
                                <td className="px-6 py-4">
                                  <a
                                    href={`/projects/${payment.project_id}`}
                                    className="text-sm text-white hover:text-primary transition-colors"
                                  >
                                    {payment.projects?.title ||
                                      "Unknown Project"}
                                  </a>
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-medium text-green-400 whitespace-nowrap">
                                  {formatAmount(payment.amount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(payment.status)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

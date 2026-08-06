import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
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
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusVariant = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  paid: "success",
  processing: "warning",
  failed: "danger",
};

export default function CreatorPayouts() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayouts = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    try {
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        // `payout_requests` does not exist in the live schema yet. Degrade to
        // an empty payout history instead of an error banner so the page stays
        // usable. Only schema-missing errors are suppressed; real failures still
        // surface to the user.
        const isMissingSchema =
          fetchError.code === "PGRST205" || // table does not exist
          fetchError.code === "42P01" || // invalid table name (Postgres)
          fetchError.code === "PGRST204"; // column not found
        if (isMissingSchema) {
          console.warn("Payout history unavailable (schema):", fetchError.message);
          setPayouts([]);
        } else {
          console.error("Error fetching payouts:", fetchError);
          setError(fetchError.message || "Failed to load payout requests");
          setPayouts([]);
        }
      } else {
        setPayouts(data || []);
      }
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (roleLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    fetchPayouts();
  }, [user, roleLoading, fetchPayouts, router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPayouts();
    setRefreshing(false);
  };

  const summary = {
    totalRequested: payouts.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    totalPaid: payouts
      .filter((p) => p.status === "approved" || p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    pendingAmount: payouts
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  };

  if (roleLoading || loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <LoadingSpinner size="lg" text="Loading payout requests..." />
            </div>
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
              <h1 className="text-2xl md:text-3xl font-bold text-white font-geist tracking-tight">
                Payout Requests
              </h1>
              <p className="text-gray-400 font-inter text-sm mt-1">
                Track your payout history and status
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="self-start"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger-muted border border-danger/20 text-danger text-sm font-inter">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <GlassCard padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    receipt_long
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
                    Total Requested
                  </p>
                  <p className="text-white font-geist text-xl font-bold">
                    {currencyFormatter.format(summary.totalRequested)}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-success-muted shrink-0">
                  <span className="material-symbols-outlined text-success text-[22px]">
                    check_circle
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
                    Total Paid
                  </p>
                  <p className="text-white font-geist text-xl font-bold">
                    {currencyFormatter.format(summary.totalPaid)}
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-warning-muted shrink-0">
                  <span className="material-symbols-outlined text-warning text-[22px]">
                    hourglass_top
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
                    Pending Amount
                  </p>
                  <p className="text-white font-geist text-xl font-bold">
                    {currencyFormatter.format(summary.pendingAmount)}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Payouts List / Table */}
          {payouts.length === 0 ? (
            <GlassCard padding="lg">
              <EmptyState
                icon="payments"
                title="No payout requests"
                description="You haven't made any payout requests yet. Payouts will appear here once requested."
              />
            </GlassCard>
          ) : (
            <GlassCard padding="none" className="overflow-hidden">
              {/* Table Header — visible on md+ */}
              <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                  Amount
                </span>
                <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                  Status
                </span>
                <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                  Requested
                </span>
                <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                  Processed
                </span>
                <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                  Method
                </span>
              </div>

              {/* Table Rows */}
              {payouts.map((payout, idx) => (
                <div
                  key={payout.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4 px-6 py-4 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Amount */}
                  <div className="flex items-center">
                    <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                      Amount
                    </span>
                    <span className="text-white font-geist font-semibold">
                      {currencyFormatter.format(payout.amount)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                      Status
                    </span>
                    <Badge
                      variant={
                        statusVariant[payout.status] || "default"
                      }
                    >
                      {payout.status}
                    </Badge>
                  </div>

                  {/* Requested Date */}
                  <div className="flex items-center">
                    <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                      Requested
                    </span>
                    <span className="text-gray-300 font-inter text-sm">
                      {payout.created_at
                        ? new Date(payout.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>

                  {/* Processed Date */}
                  <div className="flex items-center">
                    <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                      Processed
                    </span>
                    <span className="text-gray-300 font-inter text-sm">
                      {payout.processed_at
                        ? new Date(payout.processed_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>

                  {/* Method */}
                  <div className="flex items-center">
                    <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                      Method
                    </span>
                    <span className="text-gray-300 font-inter text-sm capitalize">
                      {payout.method || payout.payout_method || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Payout count */}
          {payouts.length > 0 && (
            <p className="text-gray-500 text-xs font-inter mt-4 text-center">
              Showing {payouts.length} payout{payouts.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
/**
 * Admin Payout Approvals Page — Review and process creator payout requests.
 *
 * Uses the existing /api/admin/payout-review API (GET, POST).
 * Actions: approve, reject (with reason), process (mark as paid).
 */

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { useRole } from "../../context/RoleContext";
import { authFetch } from "../../lib/authFetch";

function formatCurrency(cents) {
  if (cents == null || isNaN(cents)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function AdminPayoutApprovals() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [payouts, setPayouts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchPayouts();
  }, [user, authLoading, router]);

  async function fetchPayouts() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/payout-review");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      // Handle both API response shapes (engine returns data/count, handler uses payouts/total)
      setPayouts(json.payouts || json.data || []);
      setTotal(json.total ?? json.count ?? 0);
    } catch (err) {
      console.error("Payout fetch error:", err);
      setError("Failed to load payout requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(payoutRequestId, action, reason) {
    setActionLoading(payoutRequestId);
    try {
      const res = await authFetch("/api/admin/payout-review", {
        method: "POST",
        body: JSON.stringify({ action, payoutRequestId, reason }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Action failed (${res.status})`);
      }
      setRejectModal(null);
      setRejectReason("");
      fetchPayouts();
    } catch (err) {
      console.error("Action error:", err);
      alert(`Failed to ${action}: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white font-geist">
              Payout Approvals
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Review and process creator payout requests
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading payout requests..." />
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <GlassCard>
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">error</span>
                  <p className="text-red-300">{error}</p>
                  <Button onClick={fetchPayouts} variant="secondary" size="sm" className="mt-4">
                    Retry
                  </Button>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && payouts.length === 0 && (
            <EmptyState
              icon="payments"
              title="No pending payouts"
              description="All payout requests have been processed. New requests will appear here when creators submit them."
            />
          )}

          {/* Payout List */}
          {!loading && !error && payouts.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {total} pending payout{total !== 1 ? "s" : ""}
              </p>

              {payouts.map((p) => (
                <GlassCard key={p.id} padding="md">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold font-geist">
                          {formatCurrency(p.amount)}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "pending" ? "bg-yellow-500/20 text-yellow-400"
                          : p.status === "approved" ? "bg-green-500/20 text-green-400"
                          : p.status === "rejected" ? "bg-red-500/20 text-red-400"
                          : "bg-gray-500/20 text-gray-400"
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>Creator: {p.creator?.full_name || p.creator?.email || p.creator_id?.substring(0, 12) || "Unknown"}</span>
                        {p.created_at && <span>Requested: {formatDate(p.created_at)}</span>}
                        {p.fee_amount != null && <span>Fee: {formatCurrency(p.fee_amount)}</span>}
                        {p.net_amount != null && <span>Net: {formatCurrency(p.net_amount)}</span>}
                      </div>
                      {p.rejection_reason && (
                        <p className="text-xs text-red-400 mt-1">Reason: {p.rejection_reason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={actionLoading === p.id}
                        onClick={() => handleAction(p.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRejectModal(p.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={actionLoading === p.id}
                        onClick={() => handleAction(p.id, "process")}
                      >
                        Process
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Reject Modal */}
          {rejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <GlassCard padding="lg" className="max-w-md w-full mx-4">
                <h3 className="text-white font-semibold font-geist text-lg mb-2">
                  Reject Payout
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Provide a reason for rejecting this payout request.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 min-h-[100px] mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setRejectModal(null); setRejectReason(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!rejectReason.trim()}
                    onClick={() => handleAction(rejectModal, "reject", rejectReason.trim())}
                  >
                    Confirm Reject
                  </Button>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
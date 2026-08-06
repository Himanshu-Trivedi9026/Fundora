import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import PageLayout from "../../components/PageLayout";
import SEO from "../../components/SEO";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { supabase } from "../../lib/supabaseClient";
import { authFetch } from "../../lib/authFetch";
import ReviewQueueItem from "../../components/admin/ReviewQueueItem";
import DocumentPreview from "../../components/admin/DocumentPreview";
import DecisionPanel from "../../components/admin/DecisionPanel";
import AuditHistory from "../../components/admin/AuditHistory";
import ReviewTimeline from "../../components/admin/ReviewTimeline";

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const TYPE_FILTERS = [
  { value: "identity", label: "Identity" },
  { value: "business", label: "Business" },
  { value: "bank", label: "Bank" },
];

const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
];

export default function AdminVerificationReview() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [typeFilter, setTypeFilter] = useState("identity");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [queue, setQueue] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchQueue = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        status: statusFilter,
      });
      const res = await authFetch(`/api/admin/review-queue?${params}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      queueMicrotask(() => setQueue(data.records || []));
    } catch {
      queueMicrotask(() => setQueue([]));
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    queueMicrotask(() => fetchQueue());
  }, [fetchQueue]);

  const handleDecision = async (action, notes, reason) => {
    if (!selectedItem) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const endpoint =
        typeFilter === "business"
          ? "/api/admin/business-review"
          : typeFilter === "bank"
            ? "/api/admin/bank-review"
            : "/api/admin/identity-review";
      const res = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action,
          verificationId: selectedItem.id,
          notes,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.error || `Action failed (${res.status})`);
        return;
      }
      // Success: clear the selection and refresh the dashboard immediately.
      setSelectedItem(null);
      fetchQueue();
    } catch (err) {
      console.error("Decision error:", err);
      setActionError("Network error — could not complete the action");
    } finally {
      setActionLoading(false);
    }
  };

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
    <>
      <SEO
        title="Admin — Verification Review"
        description="Review and manage verification requests."
        noindex={true}
      />
      <PageLayout>
        <main className="flex-1 pt-24 pb-16 px-4 md:px-6 bg-surface-dim min-h-screen">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="max-w-6xl mx-auto"
          >
            {/* Header */}
            <motion.div variants={fadeUp} className="mb-8">
              <h1 className="font-geist text-2xl md:text-3xl font-bold text-on-surface mb-2">
                Verification Review
              </h1>
              <p className="text-on-surface-variant font-inter text-sm">
                Review and manage verification requests across all types.
              </p>
            </motion.div>

            {/* Filters */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-4 mb-6">
              <div className="flex gap-1 p-1 bg-surface-container-high/50 rounded-xl">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setTypeFilter(f.value);
                      setSelectedItem(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-colors ${
                      typeFilter === f.value
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 p-1 bg-surface-container-high/50 rounded-xl">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setStatusFilter(f.value);
                      setSelectedItem(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-colors ${
                      statusFilter === f.value
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Queue List */}
              <motion.div variants={fadeUp} className="lg:col-span-1 space-y-2">
                {loading ? (
                  <div
                    className="flex items-center justify-center py-12"
                    role="status"
                    aria-label="Loading review queue"
                  >
                    <span
                      className="material-symbols-outlined animate-spin text-primary text-2xl"
                      aria-hidden="true"
                    >
                      progress_activity
                    </span>
                  </div>
                ) : queue.length === 0 ? (
                  <div className="text-center py-12 text-on-surface-variant font-inter text-sm">
                    No items in queue
                  </div>
                ) : (
                  queue.map((item) => (
                    <ReviewQueueItem
                      key={item.id}
                      item={item}
                      selected={selectedItem?.id === item.id}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))
                )}
              </motion.div>

              {/* Detail Panel */}
              <motion.div variants={fadeUp} className="lg:col-span-2">
                {selectedItem ? (
                  <div className="space-y-6">
                    {/* Request Info */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5">
                      <h2 className="font-geist text-lg font-semibold mb-3">
                        Creator
                      </h2>
                      <div className="grid grid-cols-2 gap-3 text-sm font-inter">
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Full Name
                          </span>
                          <p className="text-on-surface font-medium">
                            {selectedItem.full_name || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Email
                          </span>
                          <p className="text-on-surface font-medium truncate">
                            {selectedItem.email || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Creator ID
                          </span>
                          <p className="text-on-surface font-medium font-mono text-xs">
                            {selectedItem.user_id || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Verification Type
                          </span>
                          <p className="text-on-surface font-medium capitalize">
                            {selectedItem.verification_type?.replace(
                              /_/g,
                              " ",
                            ) || "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Submitted
                          </span>
                          <p className="text-on-surface font-medium">
                            {selectedItem.submitted_at
                              ? new Date(
                                  selectedItem.submitted_at,
                                ).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant text-xs">
                            Current Status
                          </span>
                          <p className="text-on-surface font-medium capitalize">
                            {selectedItem.current_status ||
                              selectedItem.status ||
                              "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5">
                      <h2 className="font-geist text-lg font-semibold mb-3">
                        Submitted Documents
                      </h2>
                      <div className="space-y-2">
                        {(selectedItem.documents || []).map((doc) => (
                          <DocumentPreview key={doc.id} document={doc} />
                        ))}
                        {(!selectedItem.documents ||
                          selectedItem.documents.length === 0) && (
                          <p className="text-sm text-on-surface-variant font-inter">
                            No documents uploaded
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Decision Panel */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5">
                      <h2 className="font-geist text-lg font-semibold mb-3">
                        Decision
                      </h2>
                      {actionError && (
                        <div
                          className="mb-3 px-4 py-3 rounded-lg bg-danger-muted border border-danger/30 text-danger text-sm font-inter"
                          role="alert"
                        >
                          {actionError}
                        </div>
                      )}
                      <DecisionPanel
                        onApprove={(notes) => handleDecision("approve", notes)}
                        onReject={(reason) =>
                          handleDecision("reject", null, reason)
                        }
                        onResubmit={(reason) =>
                          handleDecision("resubmit", null, reason)
                        }
                        onSuspend={(reason) =>
                          handleDecision("suspend", null, reason)
                        }
                        loading={actionLoading}
                      />
                    </div>

                    {/* Timeline */}
                    {selectedItem.history?.length > 0 && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5">
                        <h2 className="font-geist text-lg font-semibold mb-3">
                          Verification History
                        </h2>
                        <ReviewTimeline events={selectedItem.history} />
                      </div>
                    )}

                    {/* Audit History */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5">
                      <h2 className="font-geist text-lg font-semibold mb-3">
                        Admin Audit Trail
                      </h2>
                      <AuditHistory
                        entries={(selectedItem.audit || []).map((a) => ({
                          id: a.id,
                          eventType: a.event_type,
                          action: a.action,
                          timestamp: a.created_at,
                          details: a.details,
                        }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center">
                    <span
                      className="material-symbols-outlined text-on-surface-variant/30 text-4xl mb-3"
                      aria-hidden="true"
                    >
                      fact_check
                    </span>
                    <p className="text-on-surface-variant font-inter text-sm">
                      Select a request from the queue to review
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </main>
      </PageLayout>
    </>
  );
}

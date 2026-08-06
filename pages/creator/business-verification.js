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

const statusVariant = {
  pending: "warning",
  submitted: "primary",
  approved: "success",
  rejected: "danger",
  under_review: "warning",
  in_progress: "primary",
  completed: "success",
};

export default function BusinessVerification() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [verification, setVerification] = useState(null);
  const [businessVerification, setBusinessVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const combined = verification || businessVerification;

  const fetchData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    try {
      if (!user) return;

      // Fetch from creator_verifications
      const { data: verData, error: verError } = await supabase
        .from("creator_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (verError) {
        console.error("Error fetching creator verification:", verError);
        setError(verError.message || "Failed to load verification data");
      }

      setVerification(verData || null);

      // Fetch from business_verifications
      const { data: bizData, error: bizError } = await supabase
        .from("business_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (bizError) {
        console.error("Error fetching business verification:", bizError);
      }

      setBusinessVerification(bizData || null);
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

    fetchData();
  }, [user, roleLoading, fetchData, router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (roleLoading || loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <LoadingSpinner size="lg" text="Loading verification data..." />
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
                Business Verification
              </h1>
              <p className="text-gray-400 font-inter text-sm mt-1">
                Verify your business identity to unlock full platform features
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

          {!combined ? (
            <GlassCard padding="lg">
              <EmptyState
                icon="verified_user"
                title="No verification found"
                description="You haven't submitted any business verification yet. Complete your verification to access creator features."
                action={
                  <Button variant="primary" size="sm">
                    Start Verification
                  </Button>
                }
              />
            </GlassCard>
          ) : (
            <div className="space-y-6">
              {/* Status Banner */}
              <GlassCard padding="md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                      <span className="material-symbols-outlined text-primary text-[24px]">
                        verified
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-0.5">
                        Verification Status
                      </p>
                      <Badge
                        variant={statusVariant[combined.status] || "default"}
                        className="text-sm px-4 py-1.5"
                      >
                        {combined.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  {combined.verified_at && (
                    <p className="text-gray-400 text-xs font-inter">
                      Verified on{" "}
                      {new Date(combined.verified_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>
                  )}
                </div>
              </GlassCard>

              {/* Business Details */}
              <GlassCard padding="md">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    business
                  </span>
                  <h2 className="text-white font-geist font-semibold text-base">
                    Business Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                  <DetailRow
                    label="Business Name"
                    value={
                      combined.business_name || combined.company_name || "—"
                    }
                  />
                  <DetailRow
                    label="Registration Number"
                    value={
                      combined.registration_number ||
                      combined.business_registration ||
                      "—"
                    }
                  />
                  <DetailRow
                    label="Business Type"
                    value={
                      combined.business_type || combined.entity_type || "—"
                    }
                  />
                  <DetailRow
                    label="GST Number"
                    value={combined.gst_number || combined.tax_id || "—"}
                  />
                  <DetailRow
                    label="Address"
                    value={combined.address || combined.business_address || "—"}
                    fullWidth
                  />
                  <DetailRow
                    label="Website"
                    value={combined.website || combined.business_website || "—"}
                    fullWidth
                  />
                </div>
              </GlassCard>

              {/* Documents Uploaded */}
              {combined.documents && combined.documents.length > 0 && (
                <GlassCard padding="md">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      description
                    </span>
                    <h2 className="text-white font-geist font-semibold text-base">
                      Documents Uploaded
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {combined.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-gray-400 text-[20px]">
                            {doc.type?.includes("identity")
                              ? "badge"
                              : doc.type?.includes("address")
                                ? "home"
                                : doc.type?.includes("registration")
                                  ? "article"
                                  : "description"}
                          </span>
                          <div>
                            <p className="text-white text-sm font-inter font-medium">
                              {doc.name ||
                                doc.file_name ||
                                `Document ${idx + 1}`}
                            </p>
                            {doc.uploaded_at && (
                              <p className="text-gray-400 text-xs font-inter">
                                Uploaded{" "}
                                {new Date(doc.uploaded_at).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="default"
                          className="text-[11px] capitalize"
                        >
                          {doc.status || doc.type || "document"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Verification Timeline / Notes */}
              {(combined.notes ||
                combined.admin_notes ||
                combined.submitted_at) && (
                <GlassCard padding="md">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      timeline
                    </span>
                    <h2 className="text-white font-geist font-semibold text-base">
                      Verification Timeline
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {combined.submitted_at && (
                      <TimelineItem
                        icon="send"
                        label="Submitted"
                        date={combined.submitted_at}
                        isFirst
                      />
                    )}
                    {combined.verified_at && (
                      <TimelineItem
                        icon="check_circle"
                        label="Verified"
                        date={combined.verified_at}
                        color="text-success"
                      />
                    )}
                    {combined.reviewed_at && (
                      <TimelineItem
                        icon="rate_review"
                        label="Reviewed"
                        date={combined.reviewed_at}
                      />
                    )}

                    {(combined.notes || combined.admin_notes) && (
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] mt-2">
                        <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
                          Admin Notes
                        </p>
                        <p className="text-gray-300 font-inter text-sm">
                          {combined.notes || combined.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function DetailRow({ label, value, fullWidth = false }) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-white font-inter text-sm">{value}</p>
    </div>
  );
}

function TimelineItem({
  icon,
  label,
  date,
  color = "text-primary",
  isFirst = false,
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span className={`material-symbols-outlined text-[18px] ${color}`}>
          {icon}
        </span>
        {!isFirst && (
          <div className="w-px flex-1 bg-white/[0.06] min-h-[24px] mt-1" />
        )}
      </div>
      <div>
        <p className="text-white font-inter text-sm font-medium">{label}</p>
        <p className="text-gray-400 font-inter text-xs">
          {new Date(date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

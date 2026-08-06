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

const severityVariant = {
  low: "default",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

function getRiskColor(score) {
  if (score <= 30) return "text-success";
  if (score <= 60) return "text-warning";
  if (score <= 80) return "text-orange-400";
  return "text-danger";
}

function getRiskBg(score) {
  if (score <= 30) return "bg-success/20";
  if (score <= 60) return "bg-warning/20";
  if (score <= 80) return "bg-orange-400/20";
  return "bg-danger/20";
}

function getRiskBarColor(score) {
  if (score <= 30) return "bg-success";
  if (score <= 60) return "bg-warning";
  if (score <= 80) return "bg-orange-400";
  return "bg-danger";
}

function getRiskLabel(score) {
  if (score <= 30) return "Low";
  if (score <= 60) return "Medium";
  if (score <= 80) return "High";
  return "Critical";
}

export default function FraudStatus() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [fraudProfile, setFraudProfile] = useState(null);
  const [fraudEvents, setFraudEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    try {
      if (!user) return;

      // Fetch fraud profile
      const { data: profileData, error: profileError } = await supabase
        .from("fraud_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching fraud profile:", profileError);
        setError(profileError.message || "Failed to load fraud status");
      }

      setFraudProfile(profileData || null);

      // Fetch recent fraud events
      const { data: eventsData, error: eventsError } = await supabase
        .from("fraud_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (eventsError) {
        console.error("Error fetching fraud events:", eventsError);
      }

      setFraudEvents(eventsData || []);
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

  const riskScore = fraudProfile?.risk_score ?? fraudProfile?.fraud_score ?? 0;
  const trustScore = fraudProfile?.trust_score ?? 100;
  const riskLevel = fraudProfile?.risk_level || getRiskLabel(riskScore);

  if (roleLoading || loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <LoadingSpinner size="lg" text="Loading fraud status..." />
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
                Fraud & Risk Status
              </h1>
              <p className="text-gray-400 font-inter text-sm mt-1">
                Monitor your account risk profile and review flagged events
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="self-start"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger-muted border border-danger/20 text-danger text-sm font-inter">
              {error}
            </div>
          )}

          {/* No data state */}
          {!fraudProfile && fraudEvents.length === 0 ? (
            <GlassCard padding="lg">
              <EmptyState
                icon="shield"
                title="Clean record"
                description="No fraud events or risk flags found on your account. Your account is in good standing."
              />
            </GlassCard>
          ) : (
            <div className="space-y-6">
              {/* Risk Score Card */}
              {fraudProfile && (
                <>
                  <GlassCard padding="md">
                    <div className="flex items-center gap-2 mb-6">
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        security
                      </span>
                      <h2 className="text-white font-geist font-semibold text-base">
                        Risk Assessment
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Risk Score */}
                      <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                            Risk Score
                          </p>
                          <Badge variant={severityVariant[riskLevel.toLowerCase()] || "warning"}>
                            {riskLevel}
                          </Badge>
                        </div>

                        <div className="flex items-end gap-3 mb-3">
                          <span
                            className={`text-4xl font-bold font-geist ${getRiskColor(riskScore)}`}
                          >
                            {riskScore}
                          </span>
                          <span className="text-gray-500 text-sm font-inter mb-1">/ 100</span>
                        </div>

                        <div className="h-2.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getRiskBarColor(riskScore)}`}
                            style={{ width: `${Math.min(riskScore, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={riskScore}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Risk score: ${riskScore}`}
                          />
                        </div>

                        <p className="text-gray-500 text-xs font-inter mt-2">
                          {riskScore <= 30
                            ? "Your account has a low risk profile. No unusual activity detected."
                            : riskScore <= 60
                            ? "Moderate risk indicators detected. Review flagged events below."
                            : riskScore <= 80
                            ? "High risk score. Immediate attention recommended."
                            : "Critical risk level. Your account may be restricted."}
                        </p>
                      </div>

                      {/* Trust Score */}
                      <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-3">
                          Trust Score
                        </p>

                        <div className="flex items-end gap-3 mb-3">
                          <span
                            className={`text-4xl font-bold font-geist ${getRiskColor(100 - trustScore)}`}
                          >
                            {trustScore}
                          </span>
                          <span className="text-gray-500 text-sm font-inter mb-1">/ 100</span>
                        </div>

                        <div className="h-2.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(trustScore, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={trustScore}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Trust score: ${trustScore}`}
                          />
                        </div>

                        <p className="text-gray-500 text-xs font-inter mt-2">
                          {trustScore >= 70
                            ? "Your account has a strong trust rating."
                            : trustScore >= 40
                            ? "Your trust score needs improvement."
                            : "Your trust score is low. Please contact support."}
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Profile Details */}
                  {(fraudProfile.last_reviewed_at ||
                    fraudProfile.reviewed_at ||
                    fraudProfile.notes) && (
                    <GlassCard padding="md">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                          info
                        </span>
                        <h2 className="text-white font-geist font-semibold text-base">
                          Profile Details
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
                        {fraudProfile.last_reviewed_at && (
                          <div>
                            <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-0.5">
                              Last Reviewed
                            </p>
                            <p className="text-white font-inter text-sm">
                              {new Date(fraudProfile.last_reviewed_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        )}
                        {fraudProfile.risk_category && (
                          <div>
                            <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-0.5">
                              Risk Category
                            </p>
                            <p className="text-white font-inter text-sm capitalize">
                              {fraudProfile.risk_category.replace(/_/g, " ")}
                            </p>
                          </div>
                        )}
                        {fraudProfile.notes && (
                          <div className="md:col-span-2 mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <p className="text-gray-400 text-xs font-inter uppercase tracking-wider mb-1">
                              Notes
                            </p>
                            <p className="text-gray-300 font-inter text-sm">
                              {fraudProfile.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  )}
                </>
              )}

              {/* Fraud Events */}
              {fraudEvents.length > 0 && (
                <GlassCard padding="none" className="overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06]">
                    <span className="material-symbols-outlined text-warning text-[20px]">
                      warning
                    </span>
                    <h2 className="text-white font-geist font-semibold text-base">
                      Recent Fraud Events
                    </h2>
                    <span className="text-gray-500 text-xs font-inter ml-auto">
                      {fraudEvents.length} event{fraudEvents.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                    <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                      Event Type
                    </span>
                    <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                      Severity
                    </span>
                    <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                      Description
                    </span>
                    <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                      Date
                    </span>
                    <span className="text-gray-400 text-xs font-inter uppercase tracking-wider">
                      Resolved
                    </span>
                  </div>

                  {fraudEvents.map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4 px-6 py-4 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Event Type */}
                      <div className="flex items-center">
                        <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                          Event Type
                        </span>
                        <span className="text-white font-inter text-sm capitalize">
                          {event.event_type?.replace(/_/g, " ") || event.type?.replace(/_/g, " ") || "—"}
                        </span>
                      </div>

                      {/* Severity */}
                      <div className="flex items-center">
                        <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                          Severity
                        </span>
                        <Badge
                          variant={
                            severityVariant[
                              (event.severity || event.severity_level || "low").toLowerCase()
                            ] || "default"
                          }
                        >
                          {event.severity || event.severity_level || "low"}
                        </Badge>
                      </div>

                      {/* Description */}
                      <div className="flex items-center md:col-span-1">
                        <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                          Description
                        </span>
                        <span className="text-gray-300 font-inter text-sm line-clamp-2">
                          {event.description || event.reason || "—"}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center">
                        <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                          Date
                        </span>
                        <span className="text-gray-300 font-inter text-sm">
                          {event.created_at
                            ? new Date(event.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </div>

                      {/* Resolved */}
                      <div className="flex items-center">
                        <span className="md:hidden text-gray-400 text-xs font-inter mr-2 w-20 shrink-0">
                          Resolved
                        </span>
                        {event.resolved || event.is_resolved ? (
                          <Badge variant="success">Resolved</Badge>
                        ) : (
                          <Badge variant="warning">Open</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </GlassCard>
              )}

              {/* Only profile but no events */}
              {fraudProfile && fraudEvents.length === 0 && (
                <GlassCard padding="md">
                  <EmptyState
                    icon="check_circle"
                    title="No recent events"
                    description="There are no recent fraud events associated with your account."
                  />
                </GlassCard>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
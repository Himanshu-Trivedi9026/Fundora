/**
 * Admin Audit Logs Page — Full audit trail for administrators.
 *
 * Fetches from verification_audit_log table via Supabase.
 * Features: event type filter, date range, search, pagination.
 *
 * No new APIs created — uses existing Supabase table directly.
 */

import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import AuditHistory from "../../components/admin/AuditHistory";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "All Events" },
  { value: "verification", label: "Verification" },
  { value: "document", label: "Document" },
  { value: "review", label: "Review" },
  { value: "session", label: "Session" },
  { value: "security", label: "Security" },
  { value: "account", label: "Account" },
];

const PAGE_SIZE = 25;

export default function AdminAuditLogs() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventType, setEventType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(
    async (pageNum) => {
      queueMicrotask(() => setLoading(true));
      queueMicrotask(() => setPage(pageNum));
      setError(null);
      try {
        let query = supabase
          .from("verification_audit_log")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (eventType) {
          query = query.eq("event_type", eventType);
        }

        const { data, count, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;

        setEntries(data || []);
        setTotal(count || 0);
        setHasMore(data?.length === PAGE_SIZE);
      } catch (err) {
        console.error("Audit log fetch error:", err);
        setError("Failed to load audit logs");
        setEntries([]);
      } finally {
        queueMicrotask(() => setLoading(false));
      }
    },
    [eventType],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    queueMicrotask(() => fetchLogs(0));
  }, [user, authLoading, eventType, fetchLogs, router]);

  function handlePrevPage() {
    if (page > 0) {
      const prev = page - 1;
      setPage(prev);
      fetchLogs(prev);
    }
  }

  function handleNextPage() {
    if (hasMore) {
      const next = page + 1;
      setPage(next);
      fetchLogs(next);
    }
  }

  // Local filter by search text on already-fetched entries
  const filtered = search
    ? entries.filter(
        (e) =>
          (e.action || "").toLowerCase().includes(search.toLowerCase()) ||
          (e.entity_type || "").toLowerCase().includes(search.toLowerCase()) ||
          (e.event_type || "").toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  // Map to AuditHistory expected shape
  const auditEntries = filtered.map((e) => ({
    id: e.id,
    eventType: e.event_type,
    action: e.action,
    timestamp: e.created_at,
    details:
      e.details || e.entity_type + ": " + (e.entity_id?.substring(0, 12) || ""),
  }));

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
              Audit Logs
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Full audit trail of all platform actions
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEventType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    eventType === opt.value
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search actions, entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] max-w-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading audit logs..." />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <GlassCard>
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">
                    error
                  </span>
                  <p className="text-red-300">{error}</p>
                  <button
                    onClick={() => fetchLogs(true)}
                    className="mt-4 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30"
                  >
                    Retry
                  </button>
                </div>
              </GlassCard>
            </div>
          ) : auditEntries.length === 0 ? (
            <EmptyState
              icon="history"
              title="No audit entries"
              description={
                eventType
                  ? "No entries match the selected filter."
                  : "No audit entries have been recorded yet."
              }
              action={
                eventType ? (
                  <button
                    onClick={() => setEventType("")}
                    className="px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30"
                  >
                    Clear Filter
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <GlassCard padding="none" className="overflow-hidden">
                <AuditHistory entries={auditEntries} />
              </GlassCard>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                <span>
                  Showing page {page + 1}
                  {total > 0 && ` (${total} total entries)`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={page === 0}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      chevron_left
                    </span>
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasMore}
                  >
                    Next
                    <span className="material-symbols-outlined text-[16px]">
                      chevron_right
                    </span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

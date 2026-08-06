import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRole } from "./RoleContext";

/**
 * Verification is a creator/admin-only feature. Its backing tables
 * (creator_verifications, verification_sessions, verification_requests,
 * business_verifications, bank_accounts, bank_verifications, ...) do not exist
 * on every deployment, so we only query them for eligible roles and never
 * retry an endpoint we've already seen return 404/400.
 */
const isTableMissing = (error) => {
  if (!error) return false;
  const code = error.code || "";
  const status = error.status || error.statusCode || 0;
  return (
    status === 404 ||
    status === 400 ||
    code === "PGRST205" || // table not found
    code === "PGRST204" || // column not found
    code === "42P01" || // relation does not exist
    code === "42703" // undefined column
  );
};

/**
 * VerificationContext — Global state for creator verification.
 *
 * Provides:
 *   verification      — full verification record (or null)
 *   history           — verification history events (or [])
 *   loading           — boolean
 *   historyLoading    — boolean
 *   refreshVerification() — re-fetch from Supabase
 *   refreshHistory()     — re-fetch history events
 *   expiryStatus      — 'not_verified' | 'valid' | 'expiring_soon' | 'expired'
 *   isExpiringSoon    — boolean (expires within 30 days)
 *   daysUntilExpiry   — number | null
 *
 * Usage:
 *   <VerificationProvider>
 *     {children}
 *   </VerificationProvider>
 *
 *   const { verification, history, expiryStatus, isExpiringSoon, daysUntilExpiry } = useVerification();
 */

const VerificationContext = createContext(null);

/**
 * Verification levels:
 *   0 — Email only (default on signup)
 *   1 — Phone verified
 *   2 — Government ID verified
 *   3 — Bank verified
 *   4 — Business verified
 *   5 — Fully Verified Creator
 */
export const VERIFICATION_LEVELS = [
  { level: 0, label: "Email Only", icon: "mail", description: "Account created with email" },
  { level: 1, label: "Phone Verified", icon: "phone", description: "Phone number confirmed" },
  { level: 2, label: "Identity Verified", icon: "badge", description: "Government ID verified" },
  { level: 3, label: "Bank Verified", icon: "account_balance", description: "Bank account confirmed" },
  { level: 4, label: "Business Verified", icon: "business", description: "Business registration verified" },
  { level: 5, label: "Fully Verified", icon: "verified", description: "All verification checks passed" },
];

/**
 * Verification statuses:
 *   pending      — awaiting submission
 *   under_review — submitted, being reviewed
 *   approved     — verified successfully
 *   rejected     — verification denied
 *   expired      — verification expired
 */
export const VERIFICATION_STATUSES = {
  pending: { label: "Pending", color: "warning", icon: "hourglass_empty" },
  documents_uploaded: { label: "Documents Uploaded", color: "primary", icon: "upload_file" },
  automatic_validation: { label: "Auto Validation", color: "primary", icon: "auto_awesome" },
  under_review: { label: "Under Review", color: "primary", icon: "pending" },
  manual_review: { label: "Manual Review", color: "warning", icon: "rate_review" },
  approved: { label: "Approved", color: "success", icon: "check_circle" },
  rejected: { label: "Rejected", color: "danger", icon: "cancel" },
  expired: { label: "Expired", color: "danger", icon: "schedule" },
  cancelled: { label: "Cancelled", color: "on-surface-variant", icon: "block" },
};

/**
 * Expiry statuses:
 *   not_verified — not yet verified
 *   valid        — verification is valid and not expiring soon
 *   expiring_soon — verification expires within 30 days
 *   expired      — verification has expired
 */
export const EXPIRY_STATUSES = {
  not_verified: { label: "Not Verified", color: "on-surface-variant", icon: "help_outline" },
  valid: { label: "Valid", color: "success", icon: "verified" },
  expiring_soon: { label: "Expiring Soon", color: "warning", icon: "warning" },
  expired: { label: "Expired", color: "danger", icon: "error" },
};

export function VerificationProvider({ children }) {
  const { isCreator, isAdmin } = useRole();
  // Verification is a creator/admin-only feature. Donors/investors never need
  // it, so skip every verification query (and the realtime subscription) for
  // them — this also avoids 404/400 console noise from tables absent in prod.
  const isEligible = isCreator || isAdmin;
  // Tables we've already seen fail with 404/400 — never query them again this
  // session ("never continuously retry missing endpoints").
  const missingTablesRef = useRef(new Set());
  const isKnownMissing = (table) => missingTablesRef.current.has(table);
  const markMissing = (table, error) => {
    if (isTableMissing(error)) missingTablesRef.current.add(table);
  };
  const [verification, setVerification] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [requests, setRequests] = useState([]);
  // Phase 4 additions
  const [businessVerification, setBusinessVerification] = useState(null);
  const [businessDocuments, setBusinessDocuments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankVerification, setBankVerification] = useState(null);
  const [verificationTimeline, setVerificationTimeline] = useState([]);

  /* ─── Listen for auth state ─── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  /* ─── Fetch verification data ─── */
  const refreshVerification = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("creator_verifications")) {
      setVerification(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("creator_verifications")
        .select("id, user_id, verification_level, email_verified, phone_verified, identity_verified, bank_verified, business_verified, selfie_verified, verification_status, trust_score, risk_score, verification_provider, verified_at, expires_at, expiry_status, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // Silently suppress missing table/column errors (PGRST205/204, 404/400)
        // and stop retrying them for the rest of the session.
        markMissing("creator_verifications", error);
        if (!isTableMissing(error)) {
          console.error("Failed to fetch verification:", error);
        }
        setVerification(null);
      } else {
        setVerification(data);
      }
    } catch (err) {
      // Silently suppress — table may not exist or permissions may be insufficient
      setVerification(null);
    }

    setLoading(false);
  }, [userId, isEligible]);

  /* ─── Fetch verification history ─── */
  const refreshHistory = useCallback(async (verificationId) => {
    if (!isEligible || !verificationId || isKnownMissing("verification_history")) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);

    try {
      const { data, error } = await supabase
        .from("verification_history")
        .select("id, action, old_status, new_status, old_level, new_level, performed_by_type, reason, created_at")
        .eq("verification_id", verificationId)
        .order("created_at", { ascending: true });

      if (error) {
        markMissing("verification_history", error);
        if (!isTableMissing(error)) {
          console.error("Failed to fetch history:", error);
        }
        setHistory([]);
      } else {
        setHistory(data || []);
      }
    } catch (err) {
      console.error("History fetch error:", err);
      setHistory([]);
    }

    setHistoryLoading(false);
  }, [isEligible]);

  // Auto-fetch history when verification is loaded
  useEffect(() => {
    if (verification?.id) {
      queueMicrotask(() => {
        refreshHistory(verification.id);
      });
    }
  }, [verification?.id, refreshHistory]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshVerification();
    });
  }, [refreshVerification]);

  /* ─── Session helpers ─── */
  const refreshSession = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("verification_sessions")) {
      setCurrentSession(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("verification_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("completed", false)
        .order("last_active_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      markMissing("verification_sessions", error);
      if (!isTableMissing(error)) setCurrentSession(data || null);
    } catch {
      setCurrentSession(null);
    }
  }, [userId, isEligible]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshSession();
    });
  }, [refreshSession]);

  /* ─── Requests helpers ─── */
  const refreshRequests = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("verification_requests")) {
      setRequests([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("id, verification_type, status, review_priority, submitted_at, completed_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      markMissing("verification_requests", error);
      if (!isTableMissing(error)) setRequests(data || []);
    } catch {
      setRequests([]);
    }
  }, [userId, isEligible]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshRequests();
    });
  }, [refreshRequests]);

  /* ─── Business verification helpers ─── */
  const refreshBusinessVerification = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("business_verifications")) {
      setBusinessVerification(null);
      setBusinessDocuments([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("business_verifications")
        .select("id, user_id, business_name, business_type, gst_status, pan_status, status, verified_at, rejection_reason, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      markMissing("business_verifications", error);
      if (isTableMissing(error)) {
        setBusinessVerification(null);
        setBusinessDocuments([]);
        return;
      }
      setBusinessVerification(data || null);

      if (data?.id && !isKnownMissing("business_documents")) {
        const { data: docs, error: docsError } = await supabase
          .from("business_documents")
          .select("id, document_type, document_name, status, uploaded_at, verified_at")
          .eq("business_verification_id", data.id)
          .order("created_at", { ascending: true });
        markMissing("business_documents", docsError);
        setBusinessDocuments(docs || []);
      }
    } catch {
      setBusinessVerification(null);
      setBusinessDocuments([]);
    }
  }, [userId, isEligible]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshBusinessVerification();
    });
  }, [refreshBusinessVerification]);

  /* ─── Bank verification helpers ─── */
  const refreshBankAccounts = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("bank_accounts")) {
      setBankAccounts([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, user_id, account_holder_name, bank_name, account_type, is_primary, status, penny_drop_status, penny_drop_verified_at, created_at, updated_at")
        .eq("user_id", userId)
        .neq("status", "archived")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      markMissing("bank_accounts", error);
      if (!isTableMissing(error)) setBankAccounts(data || []);
    } catch {
      setBankAccounts([]);
    }
  }, [userId, isEligible]);

  const refreshBankVerification = useCallback(async () => {
    if (!isEligible || !userId || isKnownMissing("bank_verifications")) {
      setBankVerification(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("bank_verifications")
        .select("id, user_id, status, total_accounts, verified_accounts, verified_at, rejection_reason, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      markMissing("bank_verifications", error);
      if (!isTableMissing(error)) setBankVerification(data || null);
    } catch {
      setBankVerification(null);
    }
  }, [userId, isEligible]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshBankAccounts();
      refreshBankVerification();
    });
  }, [refreshBankAccounts, refreshBankVerification]);

  /* ─── Unified verification timeline ─── */
  useEffect(() => {
    queueMicrotask(() => {
      const events = [];

      // Add history events
      if (history?.length) {
        history.forEach((h) => {
          events.push({
            id: h.id,
            type: "verification",
            action: h.action,
            status: h.new_status,
            level: h.new_level,
            reason: h.reason,
            timestamp: h.created_at,
          });
        });
      }

      // Add business verification event
      if (businessVerification?.status && businessVerification.status !== "draft") {
        events.push({
          id: `biz-${businessVerification.id}`,
          type: "business",
          action: `business_${businessVerification.status}`,
          status: businessVerification.status,
          timestamp: businessVerification.updated_at || businessVerification.created_at,
        });
      }

      // Add bank verification event
      if (bankVerification?.status && bankVerification.status !== "draft") {
        events.push({
          id: `bank-${bankVerification.id}`,
          type: "bank",
          action: `bank_${bankVerification.status}`,
          status: bankVerification.status,
          timestamp: bankVerification.updated_at || bankVerification.created_at,
        });
      }

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setVerificationTimeline(events);
    });
  }, [history, businessVerification, bankVerification]);

  /* ─── Subscribe to realtime updates ─── */
  useEffect(() => {
    if (!isEligible || !userId) return;
    // Never subscribe to a table we've already seen return 404/400 — the
    // Realtime server would reject the channel and supabase-js would retry it
    // forever (a network-spam loop).
    if (
      isKnownMissing("creator_verifications") &&
      isKnownMissing("business_verifications") &&
      isKnownMissing("bank_accounts")
    ) {
      return;
    }

    const channel = supabase
      .channel("verification-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_verifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setVerification(null);
          } else {
            setVerification(payload.new);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_verifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setBusinessVerification(null);
          } else if (payload.new) {
            setBusinessVerification((prev) =>
              prev?.id === payload.new.id ? payload.new : prev || payload.new
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bank_accounts",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            refreshBankAccounts();
          } else if (payload.new) {
            setBankAccounts((prev) => {
              const idx = prev.findIndex((a) => a.id === payload.new.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = payload.new;
                return updated;
              }
              return [...prev, payload.new];
            });
          }
        }
      )
      // If the Realtime server rejects the channel (e.g. the subscribed table
      // doesn't exist), supabase-js would otherwise keep retrying the subscribe
      // forever. Unsubscribe on any terminal/failed status so we never retry a
      // failed endpoint. The channel can be resubscribed later on a full reload.
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          supabase.removeChannel(channel);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isEligible, refreshBankAccounts]);

  /* ─── Derived helpers ─── */
  const isVerified = verification?.verification_status === "approved";
  const isFullyVerified = verification?.verification_level === 5 && verification?.verification_status === "approved";

  /* ─── Expiry helpers ─── */
  const expiryStatus = verification?.expiry_status || "not_verified";
  const isExpiringSoon = expiryStatus === "expiring_soon";

  const expiresAt = verification?.expires_at;
  const daysUntilExpiry = useMemo(() => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [expiresAt]);

  const levelLabel = useMemo(() => {
    if (!verification) return "Unverified";
    const level = VERIFICATION_LEVELS.find(l => l.level === verification.verification_level);
    return level?.label || "Unverified";
  }, [verification]);

  /* ─── Phase 4 derived state ─── */
  const completionPercentage = useMemo(() => {
    let completed = 0;
    let total = 6; // email, phone, id, bank, business, fully verified
    if (verification?.email_verified) completed++;
    if (verification?.phone_verified) completed++;
    if (verification?.identity_verified) completed++;
    if (verification?.bank_verified) completed++;
    if (verification?.business_verified) completed++;
    if (verification?.verification_level === 5) completed++;
    return Math.round((completed / total) * 100);
  }, [verification]);

  const pendingActions = useMemo(() => {
    const actions = [];
    if (verification && !verification.phone_verified) {
      actions.push({ type: "phone", label: "Verify phone number", icon: "phone" });
    }
    if (verification && !verification.identity_verified) {
      actions.push({ type: "identity", label: "Upload government ID", icon: "badge" });
    }
    if (verification?.identity_verified && !verification.bank_verified) {
      actions.push({ type: "bank", label: "Add bank account", icon: "account_balance" });
    }
    if (verification?.bank_verified && !verification.business_verified) {
      actions.push({ type: "business", label: "Verify business", icon: "business" });
    }
    if (businessVerification?.status === "resubmission_requested") {
      actions.push({ type: "business_resubmit", label: "Resubmit business documents", icon: "upload_file" });
    }
    if (bankVerification?.status === "resubmission_requested") {
      actions.push({ type: "bank_resubmit", label: "Resubmit bank documents", icon: "upload_file" });
    }
    // Check for rejected documents
    const rejectedDocs = businessDocuments.filter((d) => d.status === "rejected");
    rejectedDocs.forEach((doc) => {
      actions.push({ type: "resubmit_doc", label: `Resubmit ${doc.document_type}`, icon: "replay" });
    });
    return actions;
  }, [verification, businessVerification, bankVerification, businessDocuments]);

  const rejectedDocuments = useMemo(() => {
    return businessDocuments.filter((d) => d.status === "rejected");
  }, [businessDocuments]);

  const value = useMemo(() => ({
    verification,
    history,
    loading,
    historyLoading,
    refreshVerification,
    refreshHistory,
    isVerified,
    isFullyVerified,
    expiryStatus,
    isExpiringSoon,
    daysUntilExpiry,
    levelLabel,
    // Phase 3 additions
    currentSession,
    refreshSession,
    requests,
    refreshRequests,
    auditLog,
    // Phase 4 additions
    businessVerification,
    businessDocuments,
    refreshBusinessVerification,
    bankAccounts,
    refreshBankAccounts,
    bankVerification,
    refreshBankVerification,
    completionPercentage,
    pendingActions,
    rejectedDocuments,
    verificationTimeline,
  }), [verification, history, loading, historyLoading, refreshVerification, refreshHistory, isVerified, isFullyVerified, expiryStatus, isExpiringSoon, daysUntilExpiry, levelLabel, currentSession, refreshSession, requests, refreshRequests, auditLog, businessVerification, businessDocuments, refreshBusinessVerification, bankAccounts, refreshBankAccounts, bankVerification, refreshBankVerification, completionPercentage, pendingActions, rejectedDocuments, verificationTimeline]);

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
}

/**
 * useVerification — Access verification state from any component.
 *
 * Returns:
 *   verification           — full record (or null)
 *   history                — verification history events (or [])
 *   loading                — boolean
 *   historyLoading         — boolean
 *   refreshVerification    — re-fetch function
 *   refreshHistory         — re-fetch history
 *   isVerified             — boolean (status === 'approved')
 *   isFullyVerified        — boolean (level === 5 && approved)
 *   expiryStatus           — 'not_verified' | 'valid' | 'expiring_soon' | 'expired'
 *   isExpiringSoon         — boolean (expires within 30 days)
 *   daysUntilExpiry        — number | null
 *   levelLabel             — human-readable level name
 *   currentSession         — active verification session (or null)
 *   refreshSession         — re-fetch active session
 *   requests               — user's verification requests (or [])
 *   refreshRequests        — re-fetch requests
 *   auditLog               — audit log entries (or [])
 *   businessVerification   — business verification record (or null)
 *   businessDocuments      — business documents list (or [])
 *   refreshBusinessVerification — re-fetch business data
 *   bankAccounts           — bank accounts list (or [])
 *   refreshBankAccounts    — re-fetch bank accounts
 *   bankVerification       — bank verification summary (or null)
 *   refreshBankVerification — re-fetch bank verification
 *   completionPercentage   — overall verification completion % (0-100)
 *   pendingActions         — list of pending verification actions
 *   rejectedDocuments      — list of rejected documents
 *   verificationTimeline   — unified timeline of all verification events
 */
export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error("useVerification must be used within a VerificationProvider");
  }
  return context;
}

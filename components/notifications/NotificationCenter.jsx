/**
 * NotificationCenter — User notification center.
 *
 * Usage:
 *   <NotificationCenter />          // Full page
 *   <NotificationCenter compact />  // Dashboard widget (5 recent unread + View All)
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Maps a notification `type` to an icon + human-readable label.
// The live notifications table stores a single `type` column.
const TYPE_ICONS = {
  system: "settings",
  system_alert: "settings",
  campaign_update: "campaign",
  campaign_created: "campaign",
  campaign_published: "campaign",
  campaign_approved: "verified",
  campaign_funded: "campaign",
  milestone_update: "flag",
  donation_received: "payments",
  new_message: "chat",
  new_follower: "group",
  payout_update: "currency_rupee",
  compliance_notice: "gavel",
  moderation_notice: "shield",
  appeal_update: "refresh",
  reputation_change: "stars",
  verification_update: "verified",
  security_alert: "lock",
  reminder: "alarm",
  announcement: "campaign",
  dispute_update: "warning",
};

// Human-readable fallback for the notification title when the table has no
// title column (live schema). Derived from the notification `type`.
const TYPE_LABELS = {
  system: "System update",
  system_alert: "System alert",
  campaign_update: "Campaign update",
  campaign_created: "Campaign created",
  campaign_published: "Campaign published",
  campaign_approved: "Campaign approved",
  campaign_funded: "Campaign funded",
  milestone_update: "Milestone update",
  donation_received: "New donation",
  new_message: "New message",
  new_follower: "New follower",
  payout_update: "Payout update",
  compliance_notice: "Compliance notice",
  moderation_notice: "Moderation notice",
  appeal_update: "Appeal update",
  reputation_change: "Reputation change",
  verification_update: "Verification update",
  security_alert: "Security alert",
  reminder: "Reminder",
  announcement: "Announcement",
  dispute_update: "Dispute update",
};

export default function NotificationCenter({ compact = false }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [authError, setAuthError] = useState("");

  // The notifications API is guarded by withAuth, which requires an
  // Authorization: Bearer <access_token> header. Without the session token
  // the API returns 401 — this was the original bug. Every request below
  // resolves the session first and attaches the header.
  const authFetch = useCallback(async (url, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setAuthError("You need to be logged in to view notifications.");
      return null;
    }
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    };
    const res = await fetch(url, { ...options, headers });
    return { res, json: await res.json().catch(() => ({})) };
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const limit = compact ? 10 : 50;
      let url = `/api/notifications?limit=${limit}`;
      if (filter) url += `&notificationType=${filter}`;
      const result = await authFetch(url);
      if (!result) return;
      const json = result.json;
      if (json.success) {
        setNotifications(json.notifications || []);
        setUnreadCount(json.unreadCount || 0);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter, compact, authFetch]);

  useEffect(() => {
    queueMicrotask(() => fetchNotifications());
  }, [fetchNotifications]);

  async function markRead(id) {
    try {
      await authFetch("/api/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: id }),
      });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await authFetch("/api/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  // Live schema uses `is_read`; be tolerant of both `read` and `is_read`.
  const isUnread = (n) => (n.is_read === undefined ? !n.read : !n.is_read);

  // Compact mode: show 5 recent unread + View All
  const displayNotifications = compact
    ? notifications.filter((n) => isUnread(n)).slice(0, 5)
    : notifications;

  const showViewAll = compact && notifications.length > 5;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading notifications">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-container-high rounded-xl shimmer" aria-hidden="true" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!compact && (
            <h2 className="text-xl font-bold text-on-surface font-geist">Notifications</h2>
          )}
          {unreadCount > 0 && (
            <span className="bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && !compact && (
          <button onClick={markAllRead} className="text-sm text-primary hover:text-primary/80 transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {/* Auth error state */}
      {authError && (
        <div className="glass-card p-4 text-center border-danger/30">
          <p className="text-sm text-on-surface-variant">{authError}</p>
        </div>
      )}

      {/* Filter — hidden in compact mode */}
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          {["", "campaign_update", "donation_received", "system_alert", "new_message", "new_follower"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === type
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-higher"
              }`}
            >
              {type ? type.replace(/_/g, " ") : "All"}
            </button>
          ))}
        </div>
      )}

      {/* Compact empty state */}
      {compact && displayNotifications.length === 0 && (
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-[32px] text-outline-variant mb-2" aria-hidden="true">
            notifications_off
          </span>
          <p className="text-sm text-on-surface-variant">No unread notifications</p>
        </div>
      )}

      {/* Notifications List */}
      <AnimatePresence>
        {!compact && displayNotifications.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-outline-variant mb-3" aria-hidden="true">
              notifications_off
            </span>
            <p className="text-on-surface-variant text-sm">
              {filter ? `No ${filter.replace(/_/g, " ")} notifications` : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className={compact ? "space-y-2" : "space-y-2"}>
            {displayNotifications.map((n) => {
              const unread = isUnread(n);
              const type = n.type || n.notification_type || "system";
              const icon = TYPE_ICONS[type] || "notifications";
              const title = n.title || TYPE_LABELS[type] || "Notification";
              const body = n.body || "";
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  onClick={() => unread && markRead(n.id)}
                  onKeyDown={(e) => { if (unread && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); markRead(n.id); } }}
                  role="button"
                  tabIndex={0}
                  className={`glass-card p-4 cursor-pointer transition-all duration-200 ${
                    unread
                      ? "border-l-4 border-primary bg-primary/5"
                      : "hover:bg-surface-container-high/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {unread && <span className="sr-only" role="status">Unread</span>}
                    <span className="material-symbols-outlined text-[20px] text-primary mt-0.5 shrink-0" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="sr-only">{type.replace(/_/g, " ")} notification</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${unread ? "text-on-surface" : "text-on-surface-variant"}`}>
                          {title}
                        </p>
                        <span className="text-xs text-outline whitespace-nowrap shrink-0">{formatDate(n.created_at)}</span>
                      </div>
                      {body && <p className="text-sm text-on-surface-variant mt-1 truncate">{body}</p>}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* View All link for compact mode */}
            {showViewAll && (
              <div className="text-center pt-2">
                <Link
                  href="/notifications"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

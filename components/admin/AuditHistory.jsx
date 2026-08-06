import { motion } from "framer-motion";

const EVENT_TYPE_CONFIG = {
  verification: {
    label: "Verification",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: "verified_user",
  },
  document: {
    label: "Document",
    color: "text-info",
    bg: "bg-info-muted",
    border: "border-info/20",
    icon: "description",
  },
  review: {
    label: "Review",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "rate_review",
  },
  session: {
    label: "Session",
    color: "text-on-surface-variant",
    bg: "bg-surface-container-high",
    border: "border-outline-variant/30",
    icon: "settings_suggest",
  },
  security: {
    label: "Security",
    color: "text-danger",
    bg: "bg-danger-muted",
    border: "border-danger/20",
    icon: "shield",
  },
  account: {
    label: "Account",
    color: "text-success",
    bg: "bg-success-muted",
    border: "border-success/20",
    icon: "person",
  },
};

/**
 * AuditHistory — Full audit trail display with event type badges and timestamps.
 *
 * Props:
 *   entries — Array<{ id, eventType, action, timestamp, details? }>
 */
export default function AuditHistory({ entries = [] }) {
  if (!entries.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-8 text-center"
      >
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">
          history
        </span>
        <p className="text-sm text-on-surface-variant/50 font-inter mt-2">
          No audit entries found.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-1"
      role="log"
      aria-label="Audit history"
    >
      {entries.map((entry, idx) => {
        const typeConfig = getEventConfig(entry.eventType);
        const sanitized = sanitizeDetails(entry.details);

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.25 }}
            className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/20 last:border-b-0"
          >
            {/* Event type icon */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeConfig.bg} border ${typeConfig.border}`}
            >
              <span
                className={`material-symbols-outlined text-[14px] ${typeConfig.color}`}
              >
                {typeConfig.icon}
              </span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Event type badge */}
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-inter font-medium uppercase tracking-wider ${typeConfig.bg} ${typeConfig.color} border ${typeConfig.border}`}
                >
                  {typeConfig.label}
                </span>

                {/* Action */}
                <span className="text-xs text-on-surface font-inter font-medium">
                  {entry.action?.replace(/_/g, " ") || "Action"}
                </span>
              </div>

              {/* Sanitized details */}
              {sanitized && (
                <p className="text-[11px] text-on-surface-variant/60 font-inter mt-1 leading-relaxed">
                  {sanitized}
                </p>
              )}
            </div>

            {/* Timestamp */}
            <span className="text-[10px] text-on-surface-variant/40 font-inter whitespace-nowrap flex-shrink-0 mt-0.5">
              {formatTimestamp(entry.timestamp)}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function getEventConfig(eventType) {
  if (!eventType) return EVENT_TYPE_CONFIG.session;

  // Match the prefix (e.g., "verification.step_transition" → "verification")
  const prefix = eventType.split(".")[0]?.toLowerCase();
  return EVENT_TYPE_CONFIG[prefix] || EVENT_TYPE_CONFIG.session;
}

function sanitizeDetails(details) {
  if (!details) return null;

  if (typeof details === "string") return details;

  try {
    // Extract meaningful fields, skip sensitive data
    const { completedSteps, wizardState, ...rest } = details;
    const parts = [];

    if (completedSteps && Array.isArray(completedSteps)) {
      parts.push(`Steps completed: ${completedSteps.join(", ")}`);
    }

    // Include safe string/number fields from rest
    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === "string" || typeof value === "number") {
        parts.push(`${key}: ${value}`);
      }
    }

    return parts.length ? parts.join(" · ") : null;
  } catch {
    return null;
  }
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

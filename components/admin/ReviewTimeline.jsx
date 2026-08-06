import { motion } from "framer-motion";

const STATUS_CONFIG = {
  success: {
    color: "text-success",
    bg: "bg-success-muted",
    border: "border-success/20",
    dot: "bg-success",
  },
  danger: {
    color: "text-danger",
    bg: "bg-danger-muted",
    border: "border-danger/20",
    dot: "bg-danger",
  },
  warning: {
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    dot: "bg-warning",
  },
  info: {
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    dot: "bg-primary",
  },
};

const ACTION_ICONS = {
  submitted: "upload_file",
  approved: "check_circle",
  rejected: "cancel",
  resubmitted: "replay",
  assigned: "person_add",
  noted: "note_add",
  escalated: "priority_high",
  completed: "task_alt",
};

/**
 * ReviewTimeline — Chronological display of review events.
 *
 * Props:
 *   events — Array<{ id, action, timestamp, reviewer?, status, notes? }>
 */
export default function ReviewTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-8 text-center"
      >
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">
          timeline
        </span>
        <p className="text-sm text-on-surface-variant/50 font-inter mt-2">
          No review events yet.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="relative pl-6" role="list" aria-label="Review timeline">
      {/* Vertical connecting line */}
      <div
        className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-outline-variant/40"
        aria-hidden="true"
      />

      {events.map((event, idx) => {
        const status = STATUS_CONFIG[event.status] || STATUS_CONFIG.info;
        const icon = ACTION_ICONS[event.action] || "circle";
        const isLast = idx === events.length - 1;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.3 }}
            className="relative pb-6 last:pb-0"
            role="listitem"
          >
            {/* Timeline dot */}
            <div
              className={`absolute -left-6 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center z-10 ${status.bg} ${status.border}`}
            >
              <span
                className={`material-symbols-outlined text-[12px] ${status.color}`}
              >
                {icon}
              </span>
            </div>

            {/* Event card */}
            <div className="ml-4 rounded-lg bg-surface-container-low border border-outline-variant/30 p-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-medium ${status.bg} ${status.color} border ${status.border}`}
                  >
                    {event.action?.replace(/_/g, " ") || "Event"}
                  </span>
                  {event.reviewer && (
                    <span className="text-[10px] text-on-surface-variant/50 font-inter truncate">
                      by {event.reviewer}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant/40 font-inter whitespace-nowrap flex-shrink-0">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>

              {/* Notes */}
              {event.notes && (
                <p className="text-xs text-on-surface-variant font-inter mt-2 leading-relaxed">
                  {event.notes}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

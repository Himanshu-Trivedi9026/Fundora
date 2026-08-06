import { motion } from "framer-motion";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "hourglass_empty",
  },
  under_review: {
    label: "In Review",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: "pending",
  },
  approved: {
    label: "Approved",
    color: "text-success",
    bg: "bg-success-muted",
    border: "border-success/20",
    icon: "check_circle",
  },
  rejected: {
    label: "Rejected",
    color: "text-danger",
    bg: "bg-danger-muted",
    border: "border-danger/20",
    icon: "cancel",
  },
  resubmitted: {
    label: "Resubmitted",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "replay",
  },
};

const PRIORITY_CONFIG = {
  urgent: {
    label: "Urgent",
    color: "text-danger",
    bg: "bg-danger-muted",
    border: "border-danger/20",
    icon: "priority_high",
    pulse: true,
  },
  high: {
    label: "High",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "arrow_upward",
    pulse: false,
  },
  normal: {
    label: "Normal",
    color: "text-on-surface-variant",
    bg: "bg-surface-container-high",
    border: "border-outline-variant/30",
    icon: "remove",
    pulse: false,
  },
  low: {
    label: "Low",
    color: "text-on-surface-variant/60",
    bg: "bg-surface-container",
    border: "border-outline-variant/20",
    icon: "arrow_downward",
    pulse: false,
  },
};

const TYPE_ICONS = {
  email: "mail",
  phone: "phone",
  identity: "badge",
  selfie: "photo_camera",
  business: "business",
};

/**
 * ReviewQueueItem — Queue item card for the review list.
 *
 * Props:
 *   item    — { id, user_id, verification_type, status, review_priority, created_at, metadata? }
 *   onClick — () => void
 *   selected — boolean
 */
export default function ReviewQueueItem({
  item,
  onClick,
  selected = false,
}) {
  if (!item) return null;

  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const priority =
    PRIORITY_CONFIG[item.review_priority] || PRIORITY_CONFIG.normal;
  const typeIcon = getTypeIcon(item.verification_type);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 transition-all duration-200 border ${
        selected
          ? "bg-primary/10 border-primary/40 shadow-glow"
          : "bg-surface-container-low border-outline-variant/50 hover:border-outline-variant hover:bg-surface-container-low/80 hover:shadow-md"
      }`}
      aria-label={`Review ${item.verification_type} verification for ${item.full_name || item.user_id?.slice(0, 8)}`}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-3">
        {/* Type icon */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            selected ? "bg-primary/20" : "bg-surface-container-high border border-outline-variant/30"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              selected ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            {typeIcon}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`text-sm font-inter font-medium capitalize truncate ${
                selected ? "text-primary" : "text-on-surface"
              }`}
            >
              {item.verification_type?.replace(/_/g, " ") || "Verification"}
            </p>

            {/* Priority indicator */}
            {(item.review_priority === "urgent" || item.review_priority === "high") && (
              <span
                className={`material-symbols-outlined text-[12px] ${priority.color} ${
                  priority.pulse ? "animate-pulse" : ""
                }`}
              >
                {priority.icon}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {item.full_name && (
              <span className="text-[11px] text-on-surface-variant font-inter font-medium truncate max-w-[140px]">
                {item.full_name}
              </span>
            )}
            <span className="text-[10px] text-on-surface-variant/50 font-inter">
              #{item.user_id?.slice(0, 8) || "N/A"}
            </span>
            {item.created_at && (
              <span className="text-[10px] text-on-surface-variant/40 font-inter">
                {formatRelativeTime(item.created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Status badge */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-medium ${status.bg} ${status.color} border ${status.border}`}
          >
            <span className="material-symbols-outlined text-[10px]">
              {status.icon}
            </span>
            {status.label}
          </div>

          {/* Priority badge */}
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-medium ${priority.bg} ${priority.color} border ${priority.border}`}
          >
            {priority.label}
          </div>
        </div>
      </div>

      {/* Metadata (if present) */}
      {item.metadata?.note && (
        <div className="mt-2.5 px-3 py-2 rounded-lg bg-surface-container-high/50 border border-outline-variant/20">
          <p className="text-[11px] text-on-surface-variant/60 font-inter line-clamp-2">
            {item.metadata.note}
          </p>
        </div>
      )}
    </motion.button>
  );
}

function getTypeIcon(type) {
  if (!type) return "help_outline";
  const normalized = type.toLowerCase().replace(/-/g, "_");
  return TYPE_ICONS[normalized] || "verified_user";
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

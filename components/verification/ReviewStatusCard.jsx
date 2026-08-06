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
    label: "Under Review",
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
};

const PRIORITY_CONFIG = {
  urgent: {
    label: "Urgent",
    color: "text-danger",
    bg: "bg-danger-muted",
    border: "border-danger/20",
    icon: "priority_high",
  },
  high: {
    label: "High",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "arrow_upward",
  },
  normal: {
    label: "Normal",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: "remove",
  },
  low: {
    label: "Low",
    color: "text-on-surface-variant",
    bg: "bg-surface-container-high",
    border: "border-outline-variant/30",
    icon: "arrow_downward",
  },
};

/**
 * ReviewStatusCard — Review step with priority badge.
 *
 * Props:
 *   request — { id, verification_type, status, review_priority, submitted_at, completed_at }
 */
export default function ReviewStatusCard({ request }) {
  if (!request) return null;

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const priority =
    PRIORITY_CONFIG[request.review_priority] || PRIORITY_CONFIG.normal;

  const formatDate = (iso) => {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-primary">
              rate_review
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-on-surface font-inter font-medium capitalize">
              {request.verification_type?.replace(/_/g, " ") || "Verification"}
            </p>
            <p className="text-[10px] text-on-surface-variant/50 font-inter mt-0.5">
              Request #{request.id?.slice(0, 8) || "N/A"}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-inter font-medium ${priority.bg} ${priority.color} border ${priority.border}`}
          >
            <span className="material-symbols-outlined text-[10px]">
              {priority.icon}
            </span>
            {priority.label}
          </div>
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-inter font-medium ${status.bg} ${status.color} border ${status.border}`}
          >
            <span className="material-symbols-outlined text-[10px]">
              {status.icon}
            </span>
            {status.label}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant/50 font-inter">
            Submitted
          </p>
          <p className="text-xs text-on-surface font-inter">
            {formatDate(request.submitted_at)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant/50 font-inter">
            Completed
          </p>
          <p className="text-xs text-on-surface font-inter">
            {request.completed_at
              ? formatDate(request.completed_at)
              : "Pending"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

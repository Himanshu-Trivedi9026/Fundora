import { motion } from "framer-motion";
import { VERIFICATION_STATUSES } from "../../context/VerificationContext";

/**
 * VerificationStatus — Status indicator with icon and label.
 *
 * Props:
 *   status    — 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired'
 *   size      — 'sm' | 'md' | 'lg' (default: 'md')
 *   showIcon  — boolean (default: true)
 *   className — additional classes
 */
export default function VerificationStatus({
  status = "pending",
  size = "md",
  showIcon = true,
  className = "",
}) {
  const statusInfo =
    VERIFICATION_STATUSES[status] || VERIFICATION_STATUSES.pending;

  const sizes = {
    sm: "text-[9px] px-2 py-0.5 gap-1",
    md: "text-[10px] px-3 py-1 gap-1.5",
    lg: "text-xs px-4 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "text-[12px]",
    md: "text-[14px]",
    lg: "text-[16px]",
  };

  const colorClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success-muted text-success border-success/20",
    warning: "bg-warning-muted text-warning border-warning/20",
    danger: "bg-danger-muted text-danger border-danger/20",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center font-inter font-semibold rounded-full border
        ${colorClasses[statusInfo.color] || colorClasses.primary}
        ${sizes[size]} ${className}
      `}
      role="status"
      aria-label={`Status: ${statusInfo.label}`}
    >
      {showIcon && (
        <span
          className={`material-symbols-outlined ${iconSizes[size]}`}
          style={
            status === "approved" ? { fontVariationSettings: "'FILL' 1" } : {}
          }
        >
          {statusInfo.icon}
        </span>
      )}
      <span>{statusInfo.label}</span>
    </motion.span>
  );
}

import { motion } from "framer-motion";

/**
 * VerificationBadge — Compact badge showing verification level.
 *
 * Props:
 *   level    — 0-5 verification level
 *   status   — 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired'
 *   size     — 'sm' | 'md' | 'lg' (default: 'sm')
 *   showLabel — boolean (default: true)
 *   className — additional classes
 */
export default function VerificationBadge({
  level = 0,
  status = "pending",
  size = "sm",
  showLabel = true,
  className = "",
}) {
  const isApproved = status === "approved";

  const sizes = {
    sm: { badge: "px-2 py-0.5 text-[9px] gap-1", icon: "text-[12px]" },
    md: { badge: "px-3 py-1 text-[10px] gap-1.5", icon: "text-[14px]" },
    lg: { badge: "px-4 py-1.5 text-xs gap-2", icon: "text-[16px]" },
  };

  const s = sizes[size] || sizes.sm;

  // Level labels
  const levelLabels = {
    0: "Unverified",
    1: "Phone Verified",
    2: "Identity Verified",
    3: "Bank Verified",
    4: "Business Verified",
    5: "Fully Verified",
  };

  // Don't show badge for unverified users unless explicitly requested
  if (level === 0 && !isApproved) return null;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center font-inter font-semibold rounded-full border
        ${isApproved
          ? "bg-success-muted text-success border-success/20"
          : status === "under_review"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-surface-container-high text-on-surface-variant border-outline-variant/30"
        }
        ${s.badge} ${className}
      `}
      role="status"
      aria-label={`Verification level ${level}: ${levelLabels[level]}`}
    >
      <span
        className={`material-symbols-outlined ${s.icon}`}
        style={isApproved ? { fontVariationSettings: "'FILL' 1" } : {}}
      >
        {isApproved ? "verified" : "pending"}
      </span>
      {showLabel && (
        <span>{levelLabels[level] || "Unverified"}</span>
      )}
    </motion.span>
  );
}

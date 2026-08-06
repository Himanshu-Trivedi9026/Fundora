import Image from "next/image";
import { motion } from "framer-motion";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-warning",
    bg: "bg-warning-muted",
    border: "border-warning/20",
    icon: "hourglass_empty",
  },
  uploaded: {
    label: "Uploaded",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: "upload_file",
  },
  verified: {
    label: "Verified",
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

/**
 * SelfieCard — Selfie display with status.
 *
 * Props:
 *   selfieUrl — URL of the selfie image
 *   status    — 'pending' | 'uploaded' | 'verified' | 'rejected'
 */
export default function SelfieCard({ selfieUrl, status = "pending" }) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      {/* Circular preview */}
      <div className="relative flex-shrink-0">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container-high border-2 border-outline-variant/50">
          {selfieUrl ? (
            <Image
              src={selfieUrl}
              alt="Selfie preview"
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant/30">
                person
              </span>
            </div>
          )}
        </div>

        {/* Status indicator dot */}
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-surface ${statusConfig.bg}`}
        >
          <span
            className={`material-symbols-outlined text-[10px] ${statusConfig.color}`}
          >
            {statusConfig.icon}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface font-inter font-medium">
          Selfie Photo
        </p>
        <p className="text-[10px] text-on-surface-variant/50 font-inter mt-0.5">
          For identity confirmation
        </p>
      </div>

      {/* Status Badge */}
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-inter font-medium flex-shrink-0 ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}
      >
        <span className="material-symbols-outlined text-[10px]">
          {statusConfig.icon}
        </span>
        {statusConfig.label}
      </div>
    </motion.div>
  );
}

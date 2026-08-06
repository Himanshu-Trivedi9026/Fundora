import { motion } from "framer-motion";

/**
 * UploadProgress — Animated progress bar with gradient.
 *
 * Props:
 *   progress — Number 0–100
 *   status   — 'uploading' | 'processing' | 'complete' | 'error'
 */
const STATUS_CONFIG = {
  uploading: {
    text: "Uploading...",
    color: "bg-primary",
    textColor: "text-primary",
    icon: "cloud_upload",
  },
  processing: {
    text: "Processing...",
    color: "bg-warning",
    textColor: "text-warning",
    icon: "sync",
  },
  complete: {
    text: "Complete",
    color: "bg-success",
    textColor: "text-success",
    icon: "check_circle",
  },
  error: {
    text: "Failed",
    color: "bg-danger",
    textColor: "text-danger",
    icon: "error",
  },
};

export default function UploadProgress({ progress = 0, status = "uploading" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.uploading;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="space-y-1.5">
      {/* Bar container */}
      <div
        className="relative w-full h-1.5 rounded-full overflow-hidden bg-surface-container-high"
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${config.text} ${Math.round(clampedProgress)}%`}
      >
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 blur-sm opacity-40 transition-all duration-500 rounded-full"
          style={{
            width: `${clampedProgress}%`,
            background:
              status === "error"
                ? "linear-gradient(90deg, #f87171, #fca5a5)"
                : status === "complete"
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, #c4a8ff, #e0d4ff)",
          }}
        />

        {/* Main bar */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${config.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            background:
              status === "error"
                ? "linear-gradient(90deg, #f87171, #fca5a5)"
                : status === "complete"
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, #8b5cf6, #c4a8ff)",
          }}
        />

        {/* Shimmer effect while uploading */}
        {status === "uploading" && (
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              style={{ animation: "pulse-move 1.5s ease-in-out infinite" }}
            />
          </div>
        )}
      </div>

      {/* Status text */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`material-symbols-outlined text-[12px] ${config.textColor} ${
              status === "uploading" || status === "processing"
                ? "animate-spin"
                : ""
            }`}
          >
            {config.icon}
          </span>
          <span className={`text-[11px] font-inter ${config.textColor}`}>
            {config.text}
          </span>
        </div>
        <span className="text-[11px] text-on-surface-variant/50 font-inter">
          {Math.round(clampedProgress)}%
        </span>
      </div>
    </div>
  );
}

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
 * DocumentStatusCard — Document status display.
 *
 * Props:
 *   document — { id, name, type, status, uploadedAt, size }
 */
export default function DocumentStatusCard({ document: doc }) {
  if (!doc) return null;

  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const maskFilename = (name) => {
    if (!name || name.length <= 12) return name;
    const ext = name.split(".").pop();
    const base = name.slice(0, 6);
    return `${base}...${ext}`;
  };

  const getDocIcon = (type) => {
    if (type?.startsWith("image")) return "image";
    if (type === "application/pdf") return "picture_as_pdf";
    return "description";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant/50"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant flex-shrink-0">
          {getDocIcon(doc.type)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-on-surface font-inter font-medium truncate">
            {maskFilename(doc.name)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {doc.size && (
              <span className="text-[10px] text-on-surface-variant/50 font-inter">
                {formatSize(doc.size)}
              </span>
            )}
            {doc.uploadedAt && (
              <span className="text-[10px] text-on-surface-variant/50 font-inter">
                {formatDate(doc.uploadedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-inter font-medium flex-shrink-0 ${status.bg} ${status.color} border ${status.border}`}
      >
        <span className={`material-symbols-outlined text-[10px]`}>
          {status.icon}
        </span>
        {status.label}
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";

/**
 * BusinessVerificationCard — Displays business verification status.
 *
 * @param {Object} props
 * @param {Object} props.verification — Business verification record
 * @param {Array} props.documents — Business documents list
 * @param {Function} props.onStartVerification — Callback to start verification
 */
export default function BusinessVerificationCard({ verification, documents = [], onStartVerification }) {
  const status = verification?.status || "not_started";
  const statusConfig = {
    verified: { label: "Verified", color: "success", icon: "check_circle" },
    pending: { label: "Under Review", color: "warning", icon: "pending" },
    rejected: { label: "Rejected", color: "danger", icon: "cancel" },
    resubmission_requested: { label: "Resubmission Required", color: "warning", icon: "replay" },
    not_started: { label: "Not Started", color: "on-surface-variant", icon: "add_circle" },
  };
  const config = statusConfig[status] || statusConfig.not_started;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            business
          </span>
          <h3 className="font-geist text-base font-semibold">Business Verification</h3>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-${config.color}/10 text-${config.color}`}>
          {config.label}
        </span>
      </div>

      {verification && (
        <div className="grid grid-cols-2 gap-3 text-sm font-inter">
          <div>
            <span className="text-on-surface-variant text-xs">Business Name</span>
            <p className="text-on-surface font-medium truncate">{verification.business_name || "—"}</p>
          </div>
          <div>
            <span className="text-on-surface-variant text-xs">Type</span>
            <p className="text-on-surface font-medium capitalize">{verification.business_type?.replace(/_/g, " ") || "—"}</p>
          </div>
          {verification.gst_status && (
            <div>
              <span className="text-on-surface-variant text-xs">GST</span>
              <p className={`font-medium text-xs ${verification.gst_status === "verified" ? "text-success" : "text-on-surface-variant"}`}>
                {verification.gst_status}
              </p>
            </div>
          )}
          {verification.pan_status && (
            <div>
              <span className="text-on-surface-variant text-xs">PAN</span>
              <p className={`font-medium text-xs ${verification.pan_status === "verified" ? "text-success" : "text-on-surface-variant"}`}>
                {verification.pan_status}
              </p>
            </div>
          )}
        </div>
      )}

      {documents.length > 0 && (
        <div className="pt-2 border-t border-outline-variant/30">
          <p className="text-xs text-on-surface-variant mb-2">Documents ({documents.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {documents.map((doc) => (
              <span
                key={doc.id}
                className={`px-2 py-0.5 rounded text-[10px] font-inter ${
                  doc.status === "verified" ? "bg-success/10 text-success" :
                  doc.status === "rejected" ? "bg-danger/10 text-danger" :
                  "bg-surface-container-high/50 text-on-surface-variant"
                }`}
              >
                {doc.document_type?.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {status === "not_started" && onStartVerification && (
        <button
          onClick={onStartVerification}
          className="w-full py-2 px-4 rounded-xl bg-primary text-on-primary text-sm font-inter font-medium hover:bg-primary/90 transition-colors"
        >
          Start Business Verification
        </button>
      )}
    </motion.div>
  );
}

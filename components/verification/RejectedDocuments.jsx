import { motion } from "framer-motion";

/**
 * RejectedDocuments — List of rejected documents with resubmit CTA.
 *
 * @param {Object} props
 * @param {Array} props.documents — Array of rejected document records
 * @param {Function} props.onResubmit — Callback with document id
 */
export default function RejectedDocuments({ documents = [], onResubmit }) {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-danger text-[16px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          error
        </span>
        <h3 className="font-geist text-sm font-semibold text-danger">
          Documents Need Attention
        </h3>
      </div>
      <div className="space-y-2">
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-danger/5 border border-danger/10"
          >
            <span className="material-symbols-outlined text-danger text-[16px]">
              upload_file
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-inter text-on-surface">
                {doc.document_type?.replace(/_/g, " ")}
              </p>
              {doc.rejection_reason && (
                <p className="text-xs text-on-surface-variant font-inter truncate">
                  {doc.rejection_reason}
                </p>
              )}
            </div>
            {onResubmit && (
              <button
                onClick={() => onResubmit(doc.id)}
                className="px-3 py-1 rounded-lg bg-danger/10 text-danger text-xs font-inter font-medium hover:bg-danger/20 transition-colors"
              >
                Resubmit
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

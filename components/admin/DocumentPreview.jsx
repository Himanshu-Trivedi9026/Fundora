import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  under_review: {
    label: "Under Review",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: "pending",
  },
};

const DOC_TYPE_ICONS = {
  aadhaar: "badge",
  pan: "credit_card",
  aadhaar_card: "badge",
  pan_card: "credit_card",
  passport: "flight",
  driving_license: "directions_car",
  drivers_license: "directions_car",
  voter_id: "how_to_vote",
  utility_bill: "receipt_long",
  bank_statement: "account_balance",
  selfie: "photo_camera",
  image: "image",
  pdf: "picture_as_pdf",
  default: "description",
};

/**
 * DocumentPreview — Admin document viewer.
 *
 * Fetches a server-side signed URL for the document (private bucket) and
 * renders an inline preview (image) or a "view/download" link (PDF).
 * The signed URL is minted by the admin documents API, which only admins
 * can reach, so this never leaks a public file URL.
 *
 * Props:
 *   document — { id, document_type, document_name, status, uploaded_at, user_id }
 *              Optionally includes a pre-fetched signedUrl (from the admin route).
 */
export default function DocumentPreview({ document: doc }) {
  const [signedUrl, setSignedUrl] = useState(doc?.signedUrl || null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // If the parent passed a signedUrl it's already in state (initial value);
  // otherwise fetch one from the admin documents API.
  useEffect(() => {
    if (!doc?.id || doc?.signedUrl) return;

    let cancelled = false;
    (async () => {
      setLoadingUrl(true);
      try {
        const res = await fetch(
          `/api/admin/verification/documents?documentId=${doc.id}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.documents?.[0]?.signedUrl) {
          setSignedUrl(data.documents[0].signedUrl);
        }
      } catch {
        // Signed URL is a progressive enhancement; preview stays disabled.
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc?.id, doc?.signedUrl]);

  if (!doc) return null;

  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
  const docIcon = getDocIcon(doc.document_type);
  const isImage = doc.mime_type?.startsWith("image/");
  const canPreview = !!signedUrl;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative group rounded-xl bg-surface-container-low border border-outline-variant/50 p-4 transition-all duration-200 hover:border-outline-variant hover:shadow-lg"
        role="article"
        aria-label={`Document: ${doc.document_name}`}
      >
        <div className="flex items-center gap-4">
          {/* Document type icon */}
          <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-outline-variant/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
              {docIcon}
            </span>
          </div>

          {/* Document details */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface font-inter font-medium truncate">
              {maskFilename(doc.document_name)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-on-surface-variant/50 font-inter capitalize">
                {doc.document_type?.replace(/_/g, " ") || "Document"}
              </span>
              {doc.uploaded_at && (
                <>
                  <span className="text-on-surface-variant/20">·</span>
                  <span className="text-[10px] text-on-surface-variant/50 font-inter">
                    {formatDate(doc.uploaded_at)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status badge + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-inter font-medium ${status.bg} ${status.color} border ${status.border}`}
            >
              <span className="material-symbols-outlined text-[10px]">
                {status.icon}
              </span>
              {status.label}
            </div>

            {/* Action buttons (visible on hover) */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <a
                href={signedUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canPreview}
                onClick={(e) => {
                  if (!canPreview) {
                    e.preventDefault();
                  }
                }}
                className={`w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center transition-colors ${
                  canPreview
                    ? "hover:bg-primary/10 hover:border-primary/30"
                    : "opacity-40 pointer-events-none"
                }`}
                aria-label="Download document"
                title={canPreview ? "Download document" : "Signed URL unavailable"}
              >
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                  download
                </span>
              </a>
              <button
                onClick={() => {
                  if (canPreview) setZoomOpen(true);
                }}
                disabled={!canPreview}
                className="w-7 h-7 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Preview document"
                title={canPreview ? "Preview document" : "Signed URL unavailable"}
              >
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                  zoom_in
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading state for signed URL */}
        {loadingUrl && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-on-surface-variant/50 font-inter">
            <span className="material-symbols-outlined text-[12px] animate-spin">
              progress_activity
            </span>
            Loading preview...
          </div>
        )}
      </motion.div>

      {/* Inline preview thumbnail for images */}
      {canPreview && isImage && (
        <div className="mt-2 overflow-hidden rounded-lg border border-outline-variant/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- Signed URL (private bucket), cannot use next/image */}
          <img
            src={signedUrl}
            alt={`Preview of ${doc.document_name}`}
            className="w-full max-h-64 object-contain bg-surface-container-low"
            onClick={() => setZoomOpen(true)}
            role="button"
            aria-label="Open full preview"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setZoomOpen(true);
              }
            }}
          />
        </div>
      )}

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomOpen && signedUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setZoomOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${doc.document_name}`}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-3xl w-full bg-surface-dim rounded-2xl border border-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-sm text-on-surface font-inter font-medium truncate">
                  {maskFilename(doc.document_name)}
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-inter font-medium hover:bg-primary/90 transition-colors"
                    aria-label="Open document in new tab"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      open_in_new
                    </span>
                    Open
                  </a>
                  <button
                    onClick={() => setZoomOpen(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-on-surface-variant text-xs font-inter hover:bg-white/10 transition-colors"
                    aria-label="Close preview"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      close
                    </span>
                    Close
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center">
                {isImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- Signed URL, cannot use next/image */
                  <img
                    src={signedUrl}
                    alt={`Preview of ${doc.document_name}`}
                    className="max-w-full max-h-[62vh] object-contain rounded-lg"
                  />
                ) : (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface text-sm font-inter font-medium hover:border-primary/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      picture_as_pdf
                    </span>
                    Open PDF in new tab
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function maskFilename(name) {
  if (!name) return "Untitled Document";
  if (name.length <= 16) return name;
  const ext = name.split(".").pop();
  const base = name.slice(0, 8);
  return `${base}...${ext}`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDocIcon(type) {
  if (!type) return DOC_TYPE_ICONS.default;
  const normalized = type.toLowerCase().replace(/-/g, "_");
  return DOC_TYPE_ICONS[normalized] || DOC_TYPE_ICONS.default;
}

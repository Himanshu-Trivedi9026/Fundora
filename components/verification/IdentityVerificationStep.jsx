import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DocumentUploader from "./DocumentUploader";
import DocumentStatusCard from "./DocumentStatusCard";

// DB-canonical document types — match the verification_documents CHECK
// constraint and lib/verification/documentValidator DOCUMENT_TYPES.
const DOCUMENT_TYPES = [
  {
    id: "pan_card",
    label: "PAN Card",
    icon: "credit_card",
    description: "Permanent Account Number",
  },
  {
    id: "aadhaar_card",
    label: "Aadhaar",
    icon: "badge",
    description: "12-digit Aadhaar number",
  },
  {
    id: "passport",
    label: "Passport",
    icon: "flight",
    description: "Indian or international passport",
  },
  {
    id: "driving_license",
    label: "Driving License",
    icon: "directions_car",
    description: "Valid driving license",
  },
  {
    id: "voter_id",
    label: "Voter ID",
    icon: "how_to_vote",
    description: "Election Commission ID",
  },
];

/**
 * IdentityVerificationStep — Document type selector + upload.
 *
 * Grid of document type cards, selected type shows DocumentUploader,
 * document list with status cards. The Next button is gated on REAL uploads
 * (server-persisted documents), and successfully uploaded docs are reported
 * to the wizard via onStateChange so the Review step shows real documents.
 */
export default function IdentityVerificationStep({ onNext, onBack, onStateChange }) {
  const [selectedType, setSelectedType] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFilesChange = (files) => {
    setUploadedFiles(files);

    // Only files confirmed by the server count as documents. The upload
    // response carries the persisted document metadata (sanitized).
    const newDocs = files
      .filter((f) => f.status === "uploaded" && f.document)
      .map((f) => ({
        id: f.document.id || f.id,
        name: f.name,
        type: f.type,
        documentType: f.document.document_type || selectedType,
        status: f.document.status || "uploaded",
        uploadedAt: f.document.uploaded_at || new Date().toISOString(),
        size: f.size,
      }));

    onStateChange?.({ uploadedDocuments: newDocs });
  };

  const hasUploaded = uploadedFiles.some((f) => f.status === "uploaded");

  const handleSubmit = () => {
    if (hasUploaded) {
      onNext?.();
    }
  };

  // Derived status cards — only server-confirmed uploads.
  const documents = uploadedFiles
    .filter((f) => f.status === "uploaded" && f.document)
    .map((f) => ({
      id: f.document.id || f.id,
      name: f.name,
      type: f.type,
      documentType: f.document.document_type || selectedType,
      status: f.document.status || "uploaded",
      uploadedAt: f.document.uploaded_at || new Date().toISOString(),
      size: f.size,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[24px] text-primary">
              badge
            </span>
          </div>
          <div>
            <h3 className="font-geist text-lg text-on-surface font-medium">
              Identity Verification
            </h3>
            <p className="text-sm text-on-surface-variant font-inter mt-1">
              Select a document type and upload a clear photo or scan.
            </p>
          </div>
        </div>

        {/* Document Type Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DOCUMENT_TYPES.map((docType) => {
            const isSelected = selectedType === docType.id;
            return (
              <motion.button
                key={docType.id}
                onClick={() => {
                  setSelectedType(docType.id);
                  // `documents` is derived from `uploadedFiles` — clearing the
                  // files also clears the derived document list, so there is
                  // no separate setDocuments state to reset.
                  setUploadedFiles([]);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-outline-variant/50 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container"
                }`}
                aria-label={`Select ${docType.label}`}
                aria-pressed={isSelected}
              >
                <span
                  className={`material-symbols-outlined text-[28px] ${
                    isSelected ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {docType.icon}
                </span>
                <span
                  className={`text-xs font-inter font-medium ${
                    isSelected ? "text-primary" : "text-on-surface"
                  }`}
                >
                  {docType.label}
                </span>
                <span className="text-[10px] text-on-surface-variant/50 font-inter leading-tight">
                  {docType.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Upload Section */}
      <AnimatePresence>
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="glass-card p-6">
              <DocumentUploader
                files={uploadedFiles}
                onFilesChange={handleFilesChange}
                documentType={selectedType}
                label={`Upload your ${
                  DOCUMENT_TYPES.find((d) => d.id === selectedType)?.label || "document"
                }`}
              />
            </div>

            {/* Document Status Cards */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-on-surface-variant font-inter font-medium px-1">
                  Uploaded Documents
                </p>
                {documents.map((doc) => (
                  <DocumentStatusCard key={doc.id} document={doc} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface font-inter text-sm transition-all duration-200"
          aria-label="Go back to phone verification"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={documents.length === 0}
          title={documents.length === 0 ? "Upload at least one document to continue" : undefined}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Continue to selfie verification"
        >
          Next
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </button>
      </div>
    </motion.div>
  );
}

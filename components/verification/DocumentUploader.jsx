import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import UploadProgress from "./UploadProgress";
import {
  uploadDocumentFile,
  deleteDocumentApi,
} from "../../lib/verification/verificationApi";

const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

/**
 * DocumentUploader — Reusable drag-drop file upload.
 *
 * Uses react-dropzone, shows drag zone, file list, upload progress, validation.
 * Uploads are REAL — each accepted file is POSTed to /api/verification/documents
 * via XMLHttpRequest so progress reflects actual network progress.
 *
 * Props:
 *   onFilesChange — (files: Array) => void; files entries carry
 *                   { id, file, name, size, type, status, document?, error? }
 *   files          — current file entries
 *   label          — optional heading
 *   documentType   — DB-canonical type sent with the upload (e.g. 'pan_card')
 */
export default function DocumentUploader({
  onFilesChange,
  files = [],
  label,
  documentType,
}) {
  const [uploadProgress, setUploadProgress] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);

  const runUpload = useCallback(
    async (fileEntry) => {
      setUploadProgress((prev) => ({
        ...prev,
        [fileEntry.id]: { progress: 0, status: "uploading" },
      }));

      try {
        const result = await uploadDocumentFile({
          file: fileEntry.file,
          documentType: documentType || "other",
          onProgress: (p) => {
            setUploadProgress((prev) => ({
              ...prev,
              [fileEntry.id]: { progress: p, status: "uploading" },
            }));
          },
        });

        setUploadProgress((prev) => ({
          ...prev,
          [fileEntry.id]: { progress: 100, status: "complete" },
        }));

        // Attach the server-returned document metadata to the entry.
        onFilesChange?.((current) =>
          current.map((f) =>
            f.id === fileEntry.id
              ? {
                  ...f,
                  status: "uploaded",
                  document: result?.document || null,
                }
              : f,
          ),
        );
      } catch (err) {
        setUploadProgress((prev) => ({
          ...prev,
          [fileEntry.id]: { progress: 0, status: "error", error: err.message },
        }));
        onFilesChange?.((current) =>
          current.map((f) =>
            f.id === fileEntry.id
              ? { ...f, status: "error", error: err.message }
              : f,
          ),
        );
      }
    },
    [documentType, onFilesChange],
  );

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      const errors = [];

      // Handle rejected files
      rejectedFiles.forEach(({ file, errors: fileErrors }) => {
        fileErrors.forEach((err) => {
          if (err.code === "file-too-large") {
            errors.push(`${file.name}: File exceeds 10MB limit.`);
          } else if (err.code === "file-invalid-type") {
            errors.push(`${file.name}: Invalid file type.`);
          } else {
            errors.push(`${file.name}: ${err.message}`);
          }
        });
      });

      // Check total file count
      if (files.length + acceptedFiles.length > MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed.`);
        setValidationErrors(errors);
        return;
      }

      setValidationErrors(errors);

      if (acceptedFiles.length > 0) {
        const newFiles = acceptedFiles.map((file) => ({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "pending",
        }));

        const updatedFiles = [...files, ...newFiles];
        onFilesChange?.(updatedFiles);

        // Real upload for each new file.
        newFiles.forEach((f) => runUpload(f));
      }
    },
    [files, onFilesChange, runUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
  });

  const removeFile = (fileId) => {
    const target = files.find((f) => f.id === fileId);

    // If this file was already persisted server-side, remove the storage object
    // and DB row too so we don't leave orphaned documents.
    const docId = target?.document?.id;
    if (docId) {
      deleteDocumentApi({ documentId: docId }).catch((err) =>
        console.error("Remove document error:", err),
      );
    }

    const updated = files.filter((f) => f.id !== fileId);
    onFilesChange?.(updated);
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type) => {
    if (type?.startsWith("image")) return "image";
    if (type === "application/pdf") return "picture_as_pdf";
    return "description";
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      {label && (
        <p className="text-xs text-on-surface-variant font-inter font-medium">
          {label}
        </p>
      )}

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-outline-variant hover:border-primary/50 bg-surface-container-lowest/50"
        }`}
        role="button"
        aria-label="Upload document files"
        tabIndex={0}
      >
        <input {...getInputProps()} aria-label="File upload input" />
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            className={`material-symbols-outlined text-[32px] transition-colors ${
              isDragActive ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            cloud_upload
          </span>
          {isDragActive ? (
            <p className="text-primary text-sm font-inter">
              Drop files here...
            </p>
          ) : (
            <>
              <p className="text-on-surface-variant text-sm font-inter">
                Drag & drop files here, or{" "}
                <span className="text-primary font-medium">browse</span>
              </p>
              <p className="text-on-surface-variant/40 text-xs font-inter">
                JPG, PNG, WebP, or PDF — Max 10MB each
              </p>
            </>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            {validationErrors.map((err, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-muted border border-danger/20"
              >
                <span className="material-symbols-outlined text-[14px] text-danger">
                  error
                </span>
                <span className="text-xs text-danger font-inter">{err}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {files.map((f) => {
              const progress = uploadProgress[f.id];
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant flex-shrink-0">
                        {getFileIcon(f.type)}
                      </span>
                      <span className="text-xs text-on-surface font-inter truncate">
                        {f.name}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/50 font-inter flex-shrink-0">
                        {formatSize(f.size)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-on-surface-variant/50 hover:text-danger transition-colors flex-shrink-0 ml-2 p-1"
                      aria-label={`Remove ${f.name}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </div>

                  {/* Progress */}
                  {progress && progress.status !== "complete" && (
                    <UploadProgress
                      progress={progress.progress}
                      status={progress.status}
                    />
                  )}

                  {/* Upload error */}
                  {f.status === "error" && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-danger-muted border border-danger/20">
                      <span className="material-symbols-outlined text-[14px] text-danger">
                        error
                      </span>
                      <span className="text-[11px] text-danger font-inter">
                        {f.error || "Upload failed. Try again."}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// components/MediaUploader.jsx
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";

export default function MediaUploader({ mediaFiles, setMediaFiles }) {

  const onDrop = useCallback(
    (acceptedFiles) => {
      setMediaFiles([...mediaFiles, ...acceptedFiles]);
    },
    [mediaFiles, setMediaFiles]
  );

  const removeFile = (index) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-outline-variant hover:border-primary/50 bg-surface-container-lowest/50"
        }`}
      >
        <input id="media-upload" {...getInputProps()} aria-label="Upload media files" />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant group-hover:text-primary transition-colors">
            cloud_upload
          </span>
          {isDragActive ? (
            <p className="text-primary text-sm font-inter">Drop files here...</p>
          ) : (
            <>
              <p className="text-on-surface-variant text-sm font-inter">
                Drag & drop images, videos, or documents
              </p>
              <p className="text-on-surface-variant/50 text-xs font-inter">
                or click to browse
              </p>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {mediaFiles.map((file, idx) => (
            <motion.div
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 group"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant flex-shrink-0">
                  {file.type?.startsWith("image")
                    ? "image"
                    : file.type?.startsWith("video")
                    ? "videocam"
                    : "description"}
                </span>
                <span className="text-xs text-on-surface-variant font-inter truncate">
                  {file.name}
                </span>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="text-on-surface-variant/50 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                aria-label={`Remove ${file.name}`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  close
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

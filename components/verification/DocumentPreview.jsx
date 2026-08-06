import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * DocumentPreview — Image/PDF preview component.
 *
 * Image preview with zoom controls, PDF placeholder,
 * remove button, fullscreen toggle.
 */
export default function DocumentPreview({ file, url, onRemove, className = "" }) {
  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isImage = file?.type?.startsWith("image");
  const isPdf = file?.type === "application/pdf" || file?.name?.endsWith(".pdf");

  const toggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative group ${className}`}
      >
        {isImage && url ? (
          <div
            className="relative rounded-xl overflow-hidden bg-surface-container-high border border-outline-variant/50 cursor-pointer"
            onClick={() => setZoomed(true)}
            role="button"
            aria-label={`Preview ${file.name}`}
            tabIndex={0}
          >
            <Image
              src={url}
              alt={file.name}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <span className="material-symbols-outlined text-[24px] text-white">
                zoom_in
              </span>
            </div>

            {/* File info */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <p className="text-xs text-white font-inter font-medium truncate">
                {file.name}
              </p>
            </div>
          </div>
        ) : isPdf ? (
          <div className="rounded-xl bg-surface-container-high border border-outline-variant/50 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-danger-muted flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px] text-danger">
                picture_as_pdf
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-on-surface font-inter font-medium truncate">
                {file.name}
              </p>
              <p className="text-[10px] text-on-surface-variant/50 font-inter">
                PDF Document
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-container-high border border-outline-variant/50 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
                description
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-on-surface font-inter font-medium truncate">
                {file.name}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isImage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              aria-label="Toggle fullscreen preview"
            >
              <span className="material-symbols-outlined text-[14px] text-white">
                {fullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-danger/80 transition-colors"
              aria-label={`Remove ${file.name}`}
            >
              <span className="material-symbols-outlined text-[14px] text-white">
                close
              </span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Zoomed Modal */}
      <AnimatePresence>
        {zoomed && isImage && url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
            role="dialog"
            aria-label="Full size preview"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={url}
                alt={file.name}
                fill
                sizes="(max-width: 1536px) 90vw, 1200px"
                className="object-contain rounded-xl"
              />
              <button
                onClick={() => setZoomed(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Close preview"
              >
                <span className="material-symbols-outlined text-[18px] text-white">
                  close
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

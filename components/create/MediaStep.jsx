import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { PageHeader, GlassCard } from "../ui";

const MediaUploader = dynamic(() => import("../MediaUploader"), { ssr: false });

export default function MediaStep({
  thumbnailFile,
  setThumbnailFile,
  mediaFiles,
  setMediaFiles,
  errors,
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Memoize thumbnail preview URL to prevent blob URL leak on re-render
  const thumbnailPreview = useMemo(
    () => (thumbnailFile ? URL.createObjectURL(thumbnailFile) : null),
    [thumbnailFile],
  );

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  const handleThumbnailFile = useCallback(
    (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file (JPG, PNG, WebP, etc.)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Thumbnail should be less than 10MB");
        return;
      }
      setThumbnailFile(file);
    },
    [setThumbnailFile],
  );

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleThumbnailFile(file);
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = "";
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Native drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleThumbnailFile(file);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
      aria-label="Media upload"
    >
      <PageHeader
        title="Visual Assets"
        description="High-fidelity imagery builds investor confidence."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hero Image / Thumbnail */}
        <div className="space-y-3">
          <label className="block font-inter text-sm text-on-surface-variant">
            Hero Image{" "}
            <span className="text-red-400 ml-0.5" aria-hidden="true">
              *
            </span>
          </label>

          {thumbnailFile && thumbnailPreview ? (
            /* ── Thumbnail Preview ── */
            <div className="glass-card rounded-xl overflow-hidden group relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- FileReader blob URL, cannot use next/image */}
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-surface/80 backdrop-blur-sm text-on-surface px-4 py-2 rounded-lg text-sm font-inter hover:bg-surface-container-high transition-colors"
                  aria-label="Change thumbnail"
                >
                  Change
                </button>
                <button
                  onClick={removeThumbnail}
                  className="bg-red-500/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-inter hover:bg-red-600 transition-colors"
                  aria-label="Remove thumbnail"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            /* ── Upload Area ── */
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`glass-card p-8 rounded-xl flex flex-col items-center justify-center border-dashed border-2 transition-all cursor-pointer group min-h-[250px] w-full ${
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-outline-variant hover:border-primary"
              }`}
              aria-label="Upload hero image"
            >
              <span
                className="material-symbols-outlined text-[48px] text-on-surface-variant group-hover:text-primary transition-colors mb-4"
                aria-hidden="true"
              >
                {isDragOver ? "add_photo_alternate" : "image_search"}
              </span>
              <span className="font-geist text-base font-semibold text-on-surface mb-2">
                {isDragOver ? "Drop your image here" : "Hero Image"}
              </span>
              <p className="text-on-surface-variant font-inter text-xs text-center max-w-[200px]">
                {isDragOver
                  ? "Release to upload"
                  : "Drag and drop or click to upload. Recommended 1920×1080."}
              </p>
            </button>
          )}

          {/* Single hidden file input — the ONLY input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleThumbnailChange}
            className="hidden"
            aria-label="Select thumbnail image"
          />

          {errors.thumbnail && (
            <p className="text-red-400 text-xs font-inter" role="alert">
              {errors.thumbnail}
            </p>
          )}
        </div>

        {/* Gallery */}
        <GlassCard padding="md" className="space-y-4">
          <h3 className="font-geist text-base font-semibold text-on-surface">
            Gallery
          </h3>

          <MediaUploader
            mediaFiles={mediaFiles}
            setMediaFiles={setMediaFiles}
          />

          <p className="text-on-surface-variant font-inter text-xs">
            Add up to 6 detailed technical renders or photos.
          </p>
        </GlassCard>
      </div>
    </motion.section>
  );
}

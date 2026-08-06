import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import UploadProgress from "./UploadProgress";
import { uploadDocumentFile } from "../../lib/verification/verificationApi";

/**
 * SelfieVerificationStep — Camera capture + file upload with preview.
 *
 * Camera capture via getUserMedia, file upload fallback,
 * preview with retake option, liveness detection stubs.
 * The captured photo is uploaded for real (documentType 'selfie') — the
 * Next button stays disabled until the server confirms the upload.
 */
export default function SelfieVerificationStep({ onNext, onBack, onStateChange }) {
  const [mode, setMode] = useState(null); // 'camera' | 'upload' | null
  const [previewUrl, setPreviewUrl] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    setMode("camera");
    setCameraError("");
    setPreviewUrl(null);
    setCapturedFile(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setCameraError(
        "Camera access denied. Please allow camera permissions or use file upload."
      );
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Real upload of the captured/selected photo.
  const uploadSelfie = useCallback(
    async (file) => {
      setUploadProgress({ progress: 0, status: "uploading" });
      setCameraError("");
      try {
        const result = await uploadDocumentFile({
          file,
          documentType: "selfie",
          onProgress: (p) =>
            setUploadProgress({ progress: p, status: "uploading" }),
        });
        setUploadProgress({ progress: 100, status: "complete" });
        onStateChange?.({ selfieUploaded: true, selfieDocument: result?.document || null });
      } catch (err) {
        console.error("Selfie upload error:", err);
        setUploadProgress({ progress: 0, status: "error", error: err.message });
        onStateChange?.({ selfieUploaded: false, selfieDocument: null });
      }
    },
    [onStateChange]
  );

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `selfie-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          setCapturedFile(file);
          setPreviewUrl(URL.createObjectURL(blob));
          stopCamera();
          uploadSelfie(file);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [stopCamera, uploadSelfie]);

  // File upload fallback
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setCapturedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setMode("upload");
        uploadSelfie(file);
      }
    },
    [uploadSelfie]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // Retake
  const handleRetake = () => {
    setPreviewUrl(null);
    setCapturedFile(null);
    setUploadProgress(null);
    setMode(null);
    stopCamera();
    onStateChange?.({ selfieUploaded: false, selfieDocument: null });
  };

  // Liveness detection stub
  const runLivenessCheck = () => {
    // Architecture stub — in production, this would call a liveness detection API
    return { success: true, score: 0.95 };
  };

  const canProceed =
    capturedFile &&
    uploadProgress?.status === "complete" &&
    uploadProgress?.status !== "error";

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
              photo_camera
            </span>
          </div>
          <div>
            <h3 className="font-geist text-lg text-on-surface font-medium">
              Selfie Verification
            </h3>
            <p className="text-sm text-on-surface-variant font-inter mt-1">
              Take a clear selfie or upload a photo for identity confirmation.
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        {!mode && !previewUrl && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={startCamera}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container transition-all duration-200"
              aria-label="Open camera for selfie"
            >
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                photo_camera
              </span>
              <span className="text-sm font-inter text-on-surface font-medium">
                Take Photo
              </span>
              <span className="text-[10px] font-inter text-on-surface-variant/50">
                Use your webcam
              </span>
            </motion.button>

            <motion.button
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container transition-all duration-200"
              aria-label="Upload selfie file"
            >
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                upload
              </span>
              <span className="text-sm font-inter text-on-surface font-medium">
                Upload Photo
              </span>
              <span className="text-[10px] font-inter text-on-surface-variant/50">
                JPG, PNG
              </span>
            </motion.button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onDrop([file]);
              }}
              aria-label="Upload selfie file input"
            />
          </div>
        )}

        {/* Drag-drop zone */}
        {!mode && !previewUrl && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all duration-200 ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-outline-variant hover:border-primary/50"
            }`}
            role="button"
            aria-label="Drag and drop selfie photo"
            tabIndex={0}
          >
            <input {...getInputProps()} aria-label="Selfie file input" />
            <div className="flex items-center justify-center gap-2 text-center">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">
                cloud_upload
              </span>
              <span className="text-xs text-on-surface-variant/50 font-inter">
                Or drag and drop a photo here
              </span>
            </div>
          </div>
        )}

        {/* Camera Error */}
        <AnimatePresence>
          {cameraError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-danger-muted border border-danger/20"
            >
              <span className="material-symbols-outlined text-[18px] text-danger">
                error
              </span>
              <span className="text-sm text-danger font-inter">
                {cameraError}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera View */}
        <AnimatePresence>
          {mode === "camera" && !previewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-3"
            >
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  aria-label="Camera preview"
                />
                {/* Overlay guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-52 rounded-full border-2 border-primary/40 border-dashed" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
              <div className="flex justify-center gap-3">
                <button
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 transition-all duration-200"
                  aria-label="Capture selfie photo"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    camera
                  </span>
                  Capture
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    setMode(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] font-inter text-sm transition-all duration-200"
                  aria-label="Cancel camera"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-3"
            >
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element -- Camera/blob preview URL, cannot use next/image */}
                <img
                  src={previewUrl}
                  alt="Selfie preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Upload Progress */}
              {uploadProgress && uploadProgress.status !== "complete" && (
                <UploadProgress
                  progress={uploadProgress.progress}
                  status={uploadProgress.status}
                />
              )}

              {uploadProgress?.status === "complete" && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success-muted border border-success/20">
                  <span className="material-symbols-outlined text-[18px] text-success">
                    check_circle
                  </span>
                  <span className="text-sm text-success font-inter font-medium">
                    Photo uploaded successfully
                  </span>
                </div>
              )}

              {uploadProgress?.status === "error" && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-danger-muted border border-danger/20">
                  <span className="material-symbols-outlined text-[18px] text-danger">
                    error
                  </span>
                  <span className="text-sm text-danger font-inter">
                    {uploadProgress.error || "Photo upload failed. Please retake."}
                  </span>
                </div>
              )}

              {/* Liveness stub */}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50">
                  face
                </span>
                <span className="text-xs text-on-surface-variant/50 font-inter">
                  Liveness detection will be applied during review
                </span>
              </div>

              <button
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] font-inter text-xs transition-all duration-200"
                aria-label="Retake selfie photo"
              >
                <span className="material-symbols-outlined text-[14px]">
                  restart_alt
                </span>
                Retake Photo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            stopCamera();
            onBack?.();
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface font-inter text-sm transition-all duration-200"
          aria-label="Go back to identity verification"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-inter text-sm font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          aria-label="Continue to review"
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

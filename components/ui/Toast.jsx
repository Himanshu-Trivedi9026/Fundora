import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Toast — lightweight notification system.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Profile saved!");
 *   toast.error("Upload failed");
 *   toast.info("Processing...");
 */

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, "success", duration),
    error: (msg, duration) => addToast(msg, "error", duration),
    info: (msg, duration) => addToast(msg, "info", duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`pointer-events-auto px-5 py-3 rounded-xl shadow-lg border backdrop-blur-sm max-w-sm ${
                t.type === "success"
                  ? "bg-success-muted border-success/30 text-success"
                  : t.type === "error"
                    ? "bg-danger-muted border-danger/30 text-danger"
                    : "bg-surface-container-high border-outline-variant/30 text-on-surface"
              }`}
              role="alert"
            >
              <p className="font-inter text-sm font-medium">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return { toast: context };
}

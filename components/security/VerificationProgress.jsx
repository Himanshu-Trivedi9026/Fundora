import { motion } from "framer-motion";

/**
 * VerificationProgress — Horizontal progress bar showing verification level.
 *
 * Props:
 *   currentLevel — 0-5 current verification level
 *   targetLevel  — 0-5 target level (default: 5)
 *   showLabels   — boolean (default: true)
 *   className    — additional classes
 */
export default function VerificationProgress({
  currentLevel = 0,
  targetLevel = 5,
  showLabels = true,
  className = "",
}) {
  const levels = [
    { level: 0, label: "Email", icon: "mail" },
    { level: 1, label: "Phone", icon: "phone" },
    { level: 2, label: "ID", icon: "badge" },
    { level: 3, label: "Bank", icon: "account_balance" },
    { level: 4, label: "Business", icon: "business" },
    { level: 5, label: "Full", icon: "verified" },
  ];

  const progress = Math.min((currentLevel / targetLevel) * 100, 100);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full relative overflow-hidden"
          >
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                animation: "shimmer 2s infinite",
              }}
            />
          </motion.div>
        </div>

        {/* Level markers */}
        <div className="absolute top-0 left-0 right-0 h-2 flex justify-between items-center pointer-events-none">
          {levels.map((l) => (
            <div
              key={l.level}
              className={`w-3 h-3 rounded-full border-2 -mt-0.5 transition-colors duration-300 ${
                l.level <= currentLevel
                  ? "bg-primary border-primary"
                  : "bg-surface-container-high border-outline-variant/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between">
          {levels.map((l) => (
            <div
              key={l.level}
              className={`text-center flex flex-col items-center gap-1 ${
                l.level <= currentLevel ? "text-primary" : "text-on-surface-variant/50"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[14px] ${
                  l.level <= currentLevel ? "text-primary" : "text-on-surface-variant/30"
                }`}
                style={l.level <= currentLevel ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {l.icon}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider font-inter hidden sm:block">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

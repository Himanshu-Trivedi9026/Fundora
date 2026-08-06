import { motion } from "framer-motion";

const ID_TYPE_CONFIG = {
  pan: {
    label: "PAN Card",
    icon: "credit_card",
  },
  pan_card: {
    label: "PAN Card",
    icon: "credit_card",
  },
  aadhaar: {
    label: "Aadhaar",
    icon: "badge",
  },
  aadhaar_card: {
    label: "Aadhaar",
    icon: "badge",
  },
  passport: {
    label: "Passport",
    icon: "flight",
  },
  driving_license: {
    label: "Driving License",
    icon: "directions_car",
  },
  voter_id: {
    label: "Voter ID",
    icon: "how_to_vote",
  },
};

/**
 * IdentityCard — ID type display card.
 *
 * Props:
 *   type     — Document type string (e.g. 'pan_card', 'aadhaar_card')
 *   verified — Boolean indicating verification status
 */
export default function IdentityCard({ type, verified = false }) {
  const config = ID_TYPE_CONFIG[type] || {
    label: type || "Unknown",
    icon: "description",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-4 flex items-center gap-3 transition-all duration-200 ${
        verified ? "border-success/20" : ""
      }`}
    >
      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          verified ? "bg-success-muted" : "bg-primary/10"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[24px] ${
            verified ? "text-success" : "text-primary"
          }`}
        >
          {config.icon}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface font-inter font-medium">
          {config.label}
        </p>
        <p className="text-[10px] text-on-surface-variant/50 font-inter mt-0.5">
          Government-issued identity document
        </p>
      </div>

      {/* Verified badge */}
      {verified && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-success-muted border border-success/20"
        >
          <span className="material-symbols-outlined text-[12px] text-success">
            verified
          </span>
          <span className="text-[10px] text-success font-inter font-medium">
            Verified
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

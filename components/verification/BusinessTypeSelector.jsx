import { motion } from "framer-motion";

const BUSINESS_TYPES = [
  {
    value: "individual",
    label: "Individual",
    icon: "person",
    description: "Individual creator",
  },
  {
    value: "sole_proprietorship",
    label: "Sole Proprietorship",
    icon: "store",
    description: "Single owner business",
  },
  {
    value: "partnership",
    label: "Partnership",
    icon: "group",
    description: "Partnership firm",
  },
  {
    value: "llp",
    label: "LLP",
    icon: "corporate_fare",
    description: "Limited Liability Partnership",
  },
  {
    value: "private_limited",
    label: "Private Limited",
    icon: "apartment",
    description: "Private Ltd company",
  },
  {
    value: "public_limited",
    label: "Public Limited",
    icon: "domain",
    description: "Public Ltd company",
  },
  {
    value: "ngo",
    label: "NGO",
    icon: "volunteer_activism",
    description: "Non-profit organization",
  },
  {
    value: "trust",
    label: "Trust",
    icon: "handshake",
    description: "Trust organization",
  },
  {
    value: "society",
    label: "Society",
    icon: "groups",
    description: "Registered society",
  },
  {
    value: "startup",
    label: "Startup",
    icon: "rocket_launch",
    description: "DPIIT recognized startup",
  },
  {
    value: "government",
    label: "Government",
    icon: "account_balance",
    description: "Government entity",
  },
];

/**
 * BusinessTypeSelector — Grid selector for business types.
 *
 * @param {Object} props
 * @param {string} props.value — Selected business type
 * @param {Function} props.onChange — Callback with selected type
 */
export default function BusinessTypeSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {BUSINESS_TYPES.map((type) => (
        <motion.button
          key={type.value}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(type.value)}
          className={`p-3 rounded-xl border text-left transition-colors ${
            value === type.value
              ? "border-primary bg-primary/10"
              : "border-white/5 bg-surface-container-high/30 hover:border-white/10"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              value === type.value ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            {type.icon}
          </span>
          <p
            className={`text-xs font-semibold mt-1 ${
              value === type.value ? "text-primary" : "text-on-surface"
            }`}
          >
            {type.label}
          </p>
          <p className="text-[10px] text-on-surface-variant font-inter mt-0.5">
            {type.description}
          </p>
        </motion.button>
      ))}
    </div>
  );
}

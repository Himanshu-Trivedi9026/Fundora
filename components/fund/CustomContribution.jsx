import { motion } from "framer-motion";

/**
 * CustomContribution — Custom amount input with ₹ prefix.
 */
export default function CustomContribution({ value, onChange, selected, onSelect }) {
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className={`glass-card p-6 rounded-xl space-y-4 transition-all duration-200 ${
        selected
          ? "border-primary !bg-primary/5 shadow-glow"
          : "hover:border-white/[0.12]"
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="font-bold text-lg text-on-surface font-geist">Custom Contribution</span>
        <span className="text-xs text-on-surface-variant italic font-inter">No reward, just support</span>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-inter">
          ₹
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (Number(e.target.value) > 0) onSelect();
          }}
          onFocus={onSelect}
          placeholder="Enter amount"
          className="w-full bg-surface-container-lowest border border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg py-4 pl-8 pr-4 text-on-surface font-geist text-lg placeholder:text-on-surface-variant/30 transition-all outline-none"
        />
      </div>

      {value && Number(value) > 0 && Number(value) < 10 && (
        <p className="text-danger text-xs font-inter">Minimum amount is ₹10</p>
      )}
    </motion.div>
  );
}

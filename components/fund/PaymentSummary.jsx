import { motion } from "framer-motion";

const PLATFORM_FEE_RATE = 0.015; // 1.5%

/**
 * PaymentSummary — Sticky order summary with receipt breakdown and pay button.
 */
export default function PaymentSummary({ tierName, amount, loading, onPay, disabled }) {
  const pledgeAmount = Number(amount) || 0;
  const fee = pledgeAmount * PLATFORM_FEE_RATE;
  const total = pledgeAmount + fee;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card p-6 rounded-2xl shadow-glass-lg overflow-hidden relative"
    >
      {/* Glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[80px] rounded-full" />

      {/* Header */}
      <h3 className="font-geist text-lg font-semibold text-on-surface mb-6 flex items-center gap-2 relative z-10">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          receipt_long
        </span>
        Order Summary
      </h3>

      {/* Breakdown */}
      <div className="space-y-4 relative z-10">
        {/* Selected tier */}
        <div className="flex justify-between items-start border-b border-white/[0.06] pb-4">
          <div>
            <p className="text-sm font-bold text-on-surface font-inter">{tierName || "No Selection"}</p>
            <p className="text-xs text-on-surface-variant font-inter">Selected Reward</p>
          </div>
          <span className="font-bold text-primary font-geist">
            ₹{pledgeAmount.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-inter">
            <span className="text-on-surface-variant">Pledge Amount</span>
            <span className="text-on-surface">₹{pledgeAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm font-inter">
            <span className="text-on-surface-variant">Platform Fee (1.5%)</span>
            <span className="text-on-surface">₹{fee.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm font-inter">
            <span className="text-on-surface-variant">Network Gas Estimate</span>
            <span className="text-success font-medium">Sponsored</span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-4 mt-4 border-t border-primary/20">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-inter">Total Commitment</p>
              <p className="text-3xl font-extrabold text-on-surface font-geist">
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Pay button */}
        <div className="pt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPay}
            disabled={disabled || loading}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-lg font-geist
                       hover:opacity-90 transition-all flex items-center justify-center gap-3 group
                       disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                Processing...
              </span>
            ) : (
              <>
                Secure Checkout
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">lock</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Terms */}
        <p className="text-[10px] text-center text-on-surface-variant/60 mt-4 font-inter">
          By confirming, you agree to the{" "}
          <a className="underline hover:text-primary transition-colors" href="#">Terms of Service</a>{" "}
          and the project&rsquo;s{" "}
          <a className="underline hover:text-primary transition-colors" href="#">Fulfillment Policy</a>.
        </p>
      </div>
    </motion.div>
  );
}

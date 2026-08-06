import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

/* ─── Animation Variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function CreatorPayments() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [configured, setConfigured] = useState(false);

  const loadConfig = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setMessage(""));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        queueMicrotask(() => setMessage("Please login first."));
        return;
      }

      const res = await fetch("/api/creator/razorpay-config", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        queueMicrotask(() => setMessage(data?.error || "Failed to load config"));
        return;
      }

      queueMicrotask(() => setConfigured(Boolean(data?.configured)));
      queueMicrotask(() => setKeyId(data?.keyId || ""));
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadConfig());
  }, [loadConfig]);

  /* ================= SAVE CONFIG ================= */
  async function handleSave(e) {
    e.preventDefault();

    if (!keyId.trim() || !keySecret.trim()) {
      setMessage("Enter both Razorpay Key ID and Key Secret.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSaving(false);
      setMessage("Please login first.");
      return;
    }

    const res = await fetch("/api/creator/razorpay-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaving(false);
      setMessage(data?.error || "Failed to save config");
      return;
    }

    setConfigured(true);
    setKeySecret("");
    setSaving(false);
    setMessage(
      "Saved. This Razorpay account will be used for all your projects."
    );
  }

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
            aria-label="Loading payment configuration"
            className="text-on-surface-variant font-inter text-lg"
          >
            Loading payment configuration...
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-32 pb-24 min-h-screen flex-1 relative">
        {/* ─── Ambient Background Blobs ─── */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] -left-[5%] w-[30%] h-[30%] bg-primary-container/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-16">

          {/* ═══════════ HEADER ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-12"
          >
            <h1 className="font-geist text-3xl md:text-4xl font-bold text-on-surface tracking-tighter mb-3">
              Payment Management
            </h1>
            <p className="text-on-surface-variant font-inter text-lg max-w-2xl leading-relaxed">
              Integrate your Razorpay credentials to enable seamless payouts and investor funding.
              These credentials are encrypted and stored in a secure hardware module.
            </p>
          </motion.div>

          {/* ═══════════ MAIN CONFIG GRID ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">

            {/* ─── Payment Config Card ─── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:col-span-8"
            >
              <div className="glass-card rounded-xl p-8 md:p-12 relative overflow-hidden">
                {/* Subtle background glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[28px]" aria-hidden="true">payments</span>
                  </div>
                  <div>
                    <h3 className="font-geist text-lg font-semibold text-on-surface">
                      Razorpay Integration
                    </h3>
                    <p className="text-on-surface-variant font-inter text-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
                      Active Connection: Live Mode
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Key ID */}
                  <div className="space-y-2">
                    <label className="font-inter text-sm text-on-surface-variant ml-1">
                      Razorpay Key ID
                    </label>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary transition-colors" aria-hidden="true">
                        vpn_key
                      </span>
                      <input
                        type="text"
                        value={keyId}
                        onChange={(e) => setKeyId(e.target.value)}
                        placeholder="rzp_live_xxxxxxxxxxxxxx"
                        autoComplete="off"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-4 pl-12 pr-4 text-on-surface font-inter placeholder:text-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Key Secret */}
                  <div className="space-y-2">
                    <label className="font-inter text-sm text-on-surface-variant ml-1">
                      Razorpay Key Secret
                    </label>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary transition-colors" aria-hidden="true">
                        lock
                      </span>
                      <input
                        type="password"
                        value={keySecret}
                        onChange={(e) => setKeySecret(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        autoComplete="new-password"
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-4 pl-12 pr-4 text-on-surface font-inter placeholder:text-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Save Button + Status */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-on-surface-variant text-[13px] font-inter">
                      {configured ? (
                        <>
                          <span className="material-symbols-outlined text-success text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                            verified
                          </span>
                          Last verified: {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-[20px]" aria-hidden="true">
                            info
                          </span>
                          Not yet configured
                        </>
                      )}
                    </div>

                    <motion.button
                      type="submit"
                      disabled={saving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full sm:w-auto px-8 py-4 bg-primary text-on-primary font-geist text-sm rounded-xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : configured
                          ? "Update Razorpay Credentials"
                          : "Save Razorpay Credentials"}
                    </motion.button>
                  </div>

                  {/* Message */}
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      role="alert"
                      className={`p-4 rounded-xl text-sm font-inter ${
                        message.includes("Failed") || message.includes("Enter") || message.includes("login")
                          ? "bg-danger-muted text-danger border border-danger/20"
                          : "bg-success-muted text-success border border-success/20"
                      }`}
                    >
                      {message}
                    </motion.div>
                  )}
                </form>
              </div>
            </motion.div>

            {/* ─── Security Sidebar ─── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:col-span-4 space-y-6"
            >
              {/* Encryption Status */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 flex items-start gap-4">
                <div className="p-3 bg-primary-container/10 rounded-full shrink-0">
                  <span className="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">shield_lock</span>
                </div>
                <div>
                  <h4 className="font-geist text-sm font-semibold text-on-surface mb-1">
                    256-bit SSL Encryption
                  </h4>
                  <p className="text-[13px] text-on-surface-variant leading-relaxed font-inter">
                    Your keys are encrypted before storage using bank-grade AES-256 protocols.
                    Fundora never accesses your account balance.
                  </p>
                </div>
              </div>

              {/* Quick Tip */}
              <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl p-6">
                <h4 className="font-inter text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">info</span>
                  Setup Tip
                </h4>
                <p className="text-[13px] text-on-surface-variant font-inter leading-relaxed">
                  Generate a separate &quot;Fundora Restricted&quot; API key in your Razorpay Dashboard
                  to limit permissions for maximum security.
                </p>
              </div>
            </motion.div>
          </div>

          {/* ═══════════ BOTTOM FEATURE CARDS ═══════════ */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Payout Automation */}
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 hover:border-primary/40 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary-container/20 transition-all">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">
                  auto_mode
                </span>
              </div>
              <h4 className="font-geist text-sm font-semibold text-on-surface mb-2">
                Payout Automation
              </h4>
              <p className="text-sm text-on-surface-variant font-inter leading-relaxed">
                Automatically distribute funds to your team and vendors as soon as campaign milestones are reached.
              </p>
            </motion.div>

            {/* Real-time Tracking */}
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 hover:border-primary/40 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary-container/20 transition-all">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" aria-hidden="true">
                  monitoring
                </span>
              </div>
              <h4 className="font-geist text-sm font-semibold text-on-surface mb-2">
                Real-time Tracking
              </h4>
              <p className="text-sm text-on-surface-variant font-inter leading-relaxed">
                Monitor every pledge and transaction live. Integrated dashboard syncs instantly with your Razorpay ledger.
              </p>
            </motion.div>

            {/* Need Help? CTA */}
            <motion.div
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-xl p-6 flex flex-col justify-center items-center text-center"
            >
              <span className="material-symbols-outlined text-primary text-[32px] mb-3" aria-hidden="true">
                help_center
              </span>
              <h4 className="font-geist text-sm font-semibold text-on-surface mb-1">
                Need help?
              </h4>
              <p className="text-[13px] text-on-surface-variant font-inter mb-4">
                Read our guide on secure payment routing.
              </p>
              <a
                href="#"
                className="text-primary font-inter text-sm font-medium hover:underline"
              >
                View Documentation →
              </a>
            </motion.div>
          </motion.div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

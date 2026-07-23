// pages/payments/index.js
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

/* ─── Animation Variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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

const cardScale = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ─── Helpers ─── */
function generateTxnId(id) {
  const hex = typeof id === "string"
    ? id.replace(/-/g, "").slice(0, 8).toUpperCase()
    : String(id).padStart(4, "0");
  return `FD-${hex.slice(0, 4)}-${hex.slice(4, 8) || "0000"}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MyPayments() {
  const [payments, setPayments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);

  /* ================= LOAD USER ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ================= LOAD PAYMENTS ================= */
  useEffect(() => {
    if (!user) return;
    loadPayments();
  }, [user]);

  async function loadPayments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("public_donations")
      .select(`
        id,
        amount,
        status,
        created_at,
        payer_id,
        projects (
          id,
          title
        )
      `)
      .eq("payer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("My Payments error:", error);
      setPayments([]);
      setLoading(false);
      return;
    }

    setPayments(data || []);
    setLoading(false);
  }

  /* ================= DOWNLOAD RECEIPT ================= */
  async function downloadReceipt(payment) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert("Please login again");
        return;
      }

      const res = await fetch("/api/receipts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          donationId: payment.id,
        }),
      });

      const data = await res.json();

      if (!data?.receipt) {
        alert("Failed to generate receipt");
        return;
      }

      const { generateReceipt } = await import("../../lib/generateReceipt");
      const blob = await generateReceipt(data.receipt);

      if (!(blob instanceof Blob)) {
        throw new Error("Invalid PDF blob");
      }

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Fundora_Receipt_${data.receipt.receiptId}.pdf`;

      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Receipt error:", err);
      alert("Error downloading receipt");
    }
  }

  /* ================= STATUS BADGE ================= */
  function statusBadge(status) {
    const s = status?.toLowerCase();
    if (s === "success" || s === "paid") {
      return (
        <span className="bg-green-500/10 text-green-400 text-[11px] font-bold px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-tighter">
          Paid
        </span>
      );
    }
    if (s === "pending" || s === "processing") {
      return (
        <span className="bg-yellow-500/10 text-yellow-400 text-[11px] font-bold px-3 py-1 rounded-full border border-yellow-500/20 uppercase tracking-tighter">
          Pending
        </span>
      );
    }
    return (
      <span className="bg-red-500/10 text-red-400 text-[11px] font-bold px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-tighter">
        {status || "Unknown"}
      </span>
    );
  }

  function isPaid(status) {
    const s = status?.toLowerCase();
    return s === "success" || s === "paid";
  }

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <main className="flex-1 pt-32 pb-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-16">
            {/* Header skeleton */}
            <div className="mb-12 flex justify-between items-end">
              <div className="space-y-3">
                <div className="h-3 w-48 shimmer rounded" />
                <div className="h-10 w-64 shimmer rounded-lg" />
              </div>
              <div className="h-12 w-52 shimmer rounded-full" />
            </div>

            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-8 space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="h-8 w-24 shimmer rounded" />
                    <div className="h-6 w-16 shimmer rounded-full" />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="h-3 w-16 shimmer rounded" />
                      <div className="h-5 w-48 shimmer rounded" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 w-28 shimmer rounded" />
                      <div className="h-4 w-36 shimmer rounded" />
                    </div>
                    <div className="h-4 w-44 shimmer rounded" />
                  </div>
                  <div className="h-12 w-full shimmer rounded-lg mt-4" />
                </div>
              ))}
            </div>
          </div>
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
          <div className="absolute bottom-[10%] right-[10%] w-[25%] h-[25%] bg-success/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-16">

          {/* ═══════════ HEADER ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4"
          >
            <div>
              {/* Breadcrumb */}
              <nav className="flex gap-2 text-on-surface-variant text-[12px] mb-2 uppercase tracking-widest font-inter">
                <span>Account</span>
                <span>/</span>
                <span className="text-primary">Transactions</span>
              </nav>
              <h1 className="font-geist text-3xl md:text-4xl lg:text-[64px] lg:leading-[1.1] lg:tracking-tight font-bold text-on-surface">
                My Payments
              </h1>
            </div>

            {/* Total Payments Pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex items-center gap-3 bg-surface-container-high px-6 py-3 rounded-full border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-primary text-xl">
                receipt_long
              </span>
              <span className="font-inter text-sm text-on-surface">
                Total Payments:{" "}
                <span className="text-primary font-bold">
                  {String(payments.length).padStart(2, "0")}
                </span>
              </span>
            </motion.div>
          </motion.div>

          {/* ═══════════ PAYMENT GRID ═══════════ */}
          {payments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-16 rounded-xl text-center"
            >
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 block mb-4">
                receipts
              </span>
              <h3 className="font-geist text-xl font-semibold text-on-surface mb-2">
                No payments yet
              </h3>
              <p className="text-on-surface-variant font-inter text-sm max-w-xs mx-auto">
                Browse markets to start your first strategic investment.
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {/* ─── Payment Cards ─── */}
              {payments.map((p) => {
                const paid = isPaid(p.status);
                const txnId = generateTxnId(p.id);

                return (
                  <motion.div
                    key={p.id}
                    variants={cardScale}
                    whileHover={{ y: -4 }}
                    className="glass-card rounded-xl p-8 flex flex-col justify-between group"
                  >
                    {/* Top: Amount + Status */}
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="font-geist text-2xl lg:text-[28px] font-semibold text-on-surface flex items-center gap-1">
                          <span className="text-on-surface-variant text-lg font-light">
                            ₹
                          </span>
                          {Number(p.amount).toLocaleString("en-IN")}
                        </div>
                        {statusBadge(p.status)}
                      </div>

                      {/* Details */}
                      <div className="space-y-4">
                        {/* Project */}
                        <div className="flex flex-col">
                          <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                            Project
                          </span>
                          <span className="text-on-surface font-inter text-base font-semibold">
                            {p.projects?.title || "Unknown Project"}
                          </span>
                        </div>

                        {/* Transaction ID */}
                        <div className="flex flex-col">
                          <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                            Transaction ID
                          </span>
                          <span className="text-on-surface font-mono text-[13px] opacity-80">
                            #{txnId}
                          </span>
                        </div>

                        {/* Date + Time */}
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">
                            calendar_today
                          </span>
                          <span className="font-inter text-[13px]">
                            {formatDate(p.created_at)} • {formatTime(p.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Action Button */}
                    {paid ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReceipt(p);
                        }}
                        className="mt-8 w-full py-4 px-6 rounded-lg font-inter text-sm flex items-center justify-center gap-3 shadow-lg shadow-primary/10 transition-all"
                        style={{
                          background: "linear-gradient(135deg, #a078ff 0%, #d0bcff 100%)",
                          color: "#340080",
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          download
                        </span>
                        Download Receipt
                      </motion.button>
                    ) : (
                      <div className="mt-8 w-full py-4 px-6 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface-variant font-inter text-sm flex items-center justify-center gap-3 opacity-50 cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]">
                          lock
                        </span>
                        Download Receipt
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* ─── Fund a Project CTA Card ─── */}
              <motion.div
                variants={cardScale}
                whileHover={{ borderColor: "rgba(196, 168, 255, 0.4)" }}
                onClick={() => window.location.href = "/explore"}
                className="border-2 border-dashed border-outline-variant/20 rounded-xl p-8 flex flex-col items-center justify-center text-center group hover:border-primary/40 transition-colors cursor-pointer min-h-[280px]"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-4"
                >
                  <span className="material-symbols-outlined text-primary text-[32px]">
                    add
                  </span>
                </motion.div>
                <span className="font-geist text-base font-semibold text-on-surface mb-2">
                  Fund a Project
                </span>
                <p className="text-on-surface-variant font-inter text-sm max-w-[200px]">
                  Browse markets to start your next strategic investment.
                </p>
              </motion.div>
            </motion.div>
          )}
        </div>
      </main>

      {/* ═══════════ PAYMENT DETAIL MODAL ═══════════ */}
      <AnimatePresence>
        {selectedPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPayment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              role="dialog"
              aria-modal="true"
              aria-label="Payment details"
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-xl p-8 w-full max-w-md relative"
            >
              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment details"
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </motion.button>

              <h2 className="font-geist text-xl font-semibold text-on-surface mb-6">
                Payment Details
              </h2>

              <div className="space-y-4">
                {/* Amount */}
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                    Amount
                  </span>
                  <span className="text-on-surface font-geist text-2xl font-semibold">
                    ₹{Number(selectedPayment.amount).toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Project */}
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                    Project
                  </span>
                  <span className="text-on-surface font-inter font-semibold">
                    {selectedPayment.projects?.title}
                  </span>
                </div>

                {/* Transaction ID */}
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                    Transaction ID
                  </span>
                  <span className="text-on-surface font-mono text-[13px] opacity-80">
                    #{generateTxnId(selectedPayment.id)}
                  </span>
                </div>

                {/* Date */}
                <div className="flex flex-col">
                  <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                    Date
                  </span>
                  <span className="text-on-surface font-inter">
                    {formatDate(selectedPayment.created_at)} • {formatTime(selectedPayment.created_at)}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-on-surface-variant text-[12px] uppercase tracking-wider font-inter font-medium">
                    Status
                  </span>
                  {statusBadge(selectedPayment.status)}
                </div>
              </div>

              {/* Download Button */}
              {isPaid(selectedPayment.status) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => downloadReceipt(selectedPayment)}
                  className="mt-8 w-full py-4 px-6 rounded-lg font-inter text-sm flex items-center justify-center gap-3 shadow-lg shadow-primary/10 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #a078ff 0%, #d0bcff 100%)",
                    color: "#340080",
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    download
                  </span>
                  Download Receipt
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

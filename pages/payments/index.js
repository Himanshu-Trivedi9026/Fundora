import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";
import { generateReceipt } from "../../lib/generateReceipt";

export default function MyPayments() {
  const [payments, setPayments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);

  /* ---------------- LOAD USER ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------------- LOAD PAYMENTS ---------------- */
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

  /* 🔥 FIXED DOWNLOAD RECEIPT FUNCTION */
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ✅ FULL WIDTH CONTAINER */}
      <main className="flex-1 px-8 py-10">

        {/* ✅ HEADER UPGRADE */}
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">
            My Payments
          </h1>

          <div className="text-sm text-slate-400">
            Total Payments: {payments.length}
          </div>
        </div>

        {loading && (
          <p className="text-slate-400">Loading payments...</p>
        )}

        {!loading && payments.length === 0 && (
          <p className="text-slate-400">No payments made yet.</p>
        )}

        {/* ✅ RESPONSIVE GRID (4–5 CARDS PER ROW) */}
        <div className="grid gap-6 
          grid-cols-1 
          sm:grid-cols-2 
          md:grid-cols-3 
          lg:grid-cols-4 
          xl:grid-cols-5">

          {payments.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPayment(p)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPayment(p); } }}
              className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50
              rounded-2xl p-6 min-h-[180px] flex flex-col justify-between
              hover:scale-[1.03] hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
              <div>
                {/* ✅ BIG AMOUNT */}
                <p className="text-white text-2xl font-bold tracking-wide">
                  ₹{p.amount}
                </p>

                <p className="text-slate-400 text-sm mt-1">
                  Project: {p.projects?.title || "Unknown"}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  {new Date(p.created_at).toLocaleString()}
                </p>

                <p className="text-xs mt-1">
                  Status:{" "}
                  <span className="text-green-400 capitalize">
                    {p.status}
                  </span>
                </p>
              </div>

              {/* ✅ BUTTON IMPROVED */}
              {(p.status === "success" || p.status === "paid") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadReceipt(p);
                  }}
                  className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-500 
                  py-2 rounded-lg text-sm font-medium hover:scale-105 transition shadow-md"
                >
                  🧾 Download Receipt
                </button>
              )}
            </div>
          ))}
        </div>

        {/* MODAL */}
        {selectedPayment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">

            <div role="dialog" aria-modal="true" aria-label="Payment details" className="bg-slate-900 p-6 rounded-2xl w-[90%] max-w-md shadow-2xl relative">

              <button
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment details"
                className="absolute top-3 right-3 text-gray-400 hover:text-white"
              >
                ✖
              </button>

              <h2 className="text-xl font-bold text-white mb-4">
                Payment Details
              </h2>

              <p className="text-gray-300 mb-2">
                💰 Amount: ₹{selectedPayment.amount}
              </p>

              <p className="text-gray-300 mb-2">
                📁 Project: {selectedPayment.projects?.title}
              </p>

              <p className="text-gray-300 mb-2">
                📅 Date: {new Date(selectedPayment.created_at).toLocaleString()}
              </p>

              <p className="text-green-400 mb-4">
                ✅ Status: {selectedPayment.status}
              </p>

              <button
                onClick={() => downloadReceipt(selectedPayment)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-500 py-2 rounded-lg"
              >
                🧾 Download Receipt
              </button>

            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
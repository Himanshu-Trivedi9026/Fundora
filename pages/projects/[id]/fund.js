//pages/projects/[id]/fund.js
import { generateReceipt } from "../../../lib/generateReceipt";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { supabase } from "../../../lib/supabaseClient";

export default function FundProject() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [creator, setCreator] = useState(null);
  const [donors, setDonors] = useState([]);
  // 🔥 FUNDING STATS
  const totalRaised = donors.reduce((sum, d) => sum + (d.amount || 0), 0);
  const goal = project?.goal || 10000;
  const progress = Math.min((totalRaised / goal) * 100, 100);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  /* -------- REALTIME FUNDING UPDATE ---------- */
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel("project-funding-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setProject(payload.new);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  async function loadData() {
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (!projectData) return;
    setProject(projectData);

    const { data: creatorData } = await supabase
      .from("creators")
      .select("*")
      .eq("user_id", projectData.owner_id)
      .single();

    setCreator(creatorData || null);

    const { data: donorList } = await supabase
      .from("public_donations")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    setDonors(donorList || []);
  }

  /* ---------------- RAZORPAY PAYMENT ---------------- */
  async function handlePayment() {
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount");
      return;
    }

    if (!window.Razorpay) {
      alert("Payment system is loading. Please wait.");
      return;
    }

    setLoading(true);

    try {
      // Get session with access token for authenticated API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert("Please login to continue");
        setLoading(false);
        return;
      }

      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };

      /* 1️⃣ Create Razorpay Order */
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          amount: Number(amount),
          projectId: id,
        }),
      });

      const orderData = await res.json();

      if (!orderData?.orderId) {
        throw new Error("Order creation failed");
      }

      /* 2️⃣ Open Razorpay Checkout */
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: project?.title || "Fundora",
        description: "Support this project",
        order_id: orderData.orderId,

        handler: async function (response) {
          /* 3️⃣ Verify Payment */
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              projectId: id,
              amount: Number(amount),
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData?.success) {
  try {
    // Use donationId from verify response (no race condition with webhook)
    const donationId = verifyData.donationId;

    if (!donationId) {
      alert("Payment done but receipt failed");
      return;
    }

    // Call receipt API
    const receiptRes = await fetch("/api/receipts/generate", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        donationId: donationId,
      }),
    });

    const receiptData = await receiptRes.json();

    if (!receiptData?.receipt) {
      console.error("Receipt error:", receiptData);
      alert("Payment done, but receipt failed");
      return;
    }

    // 🔥 STEP 3: Generate PDF
    generateReceipt(receiptData.receipt);

    alert("✅ Payment successful & receipt downloaded!");

    setAmount("");
    loadData();

  } catch (err) {
    console.error("Receipt flow error:", err);
    alert("Payment done but receipt failed");
  }
} else {
            alert("Payment verification failed");
          }
        },

        theme: { color: "#2563eb" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert("Payment failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-4xl mx-auto p-6 space-y-6">
          {/* 🚀 PREMIUM PROJECT CARD */}
<div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl space-y-4">

  <h1 className="text-3xl font-bold text-white">
    {project?.title}
  </h1>

  <p className="text-slate-400">{project?.short}</p>

  {/* 🔥 FUNDING STATS */}
  <div className="grid grid-cols-3 gap-4 mt-4 text-center">
    <div>
      <p className="text-green-400 text-xl font-bold">
        ₹{totalRaised}
      </p>
      <p className="text-xs text-slate-400">Raised</p>
    </div>

    <div>
      <p className="text-blue-400 text-xl font-bold">
        ₹{goal}
      </p>
      <p className="text-xs text-slate-400">Goal</p>
    </div>

    <div>
      <p className="text-purple-400 text-xl font-bold">
        {donors.length}
      </p>
      <p className="text-xs text-slate-400">Backers</p>
    </div>
  </div>

  {/* 🔥 PROGRESS BAR */}
  <div className="w-full bg-slate-700 h-2 rounded-full mt-2">
    <div
      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Funding progress"
    />
  </div>
</div>

          {/* CREATOR */}
          {creator && (
            <div className="flex gap-4 border border-slate-800 p-4 rounded-lg">
              {creator.photo && (
                <img
                  src={creator.photo}
                  alt={creator.full_name || "Creator"}
                  className="w-20 h-20 rounded object-cover"
                />
              )}
              <div>
                <p className="text-white font-semibold">{creator.name}</p>
                <p className="text-slate-400">{creator.email}</p>
              </div>
            </div>
          )}

          {/* 💎 FUNDING TIERS */}
<div className="grid md:grid-cols-3 gap-4">

  {[
    { amount: 100, title: "Supporter", desc: "Basic support ❤️" },
    { amount: 500, title: "Backer", desc: "Special thanks + shoutout 🚀" },
    { amount: 1000, title: "Sponsor", desc: "Premium supporter badge 💎" },
  ].map((tier) => (

    <div
      key={tier.amount}
      onClick={() => setAmount(tier.amount)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAmount(tier.amount); } }}
      className="cursor-pointer bg-slate-900 border border-slate-700 p-4 rounded-xl hover:scale-105 transition"
    >
      <h3 className="text-white font-semibold">{tier.title}</h3>
      <p className="text-slate-400 text-sm">{tier.desc}</p>

      <p className="text-green-400 text-lg font-bold mt-2">
        ₹{tier.amount}
      </p>
    </div>

  ))}
</div>

          {/* 💖 PREMIUM PAYMENT */}
<div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">

  <h2 className="text-lg font-semibold text-white">
    💖 Fund this project
  </h2>

  {/* INPUT */}
  <div className="relative">
    <span className="absolute left-3 top-2 text-slate-400">₹</span>
    <input
      type="number"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder="Enter amount"
      aria-label="Funding amount in rupees"
      className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-purple-500 outline-none"
    />
  </div>

  {/* VALIDATION */}
  {amount && Number(amount) < 10 && (
    <p className="text-red-400 text-xs">
      Minimum amount is ₹10
    </p>
  )}

  {/* PAY BUTTON */}
  <button
    onClick={handlePayment}
    disabled={loading || Number(amount) < 10}
    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 rounded-lg font-semibold hover:scale-105 transition disabled:opacity-50"
  >
    {loading ? "Processing..." : "🚀 Fund Now"}
  </button>

  <p className="text-xs text-slate-400 text-center">
    🔒 Secure payments via Razorpay
  </p>
</div>

          {/* DONORS */}
          {donors.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-white font-semibold mb-3">
                Recent Supporters
              </h3>
              {donors.map((d) => (
                <div key={d.id} className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-2">
  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs">
    {d.payer_id ? "U" : "A"}
  </div>
  {d.payer_id ? "Supporter" : "Anonymous"}
</span>
                  <span className="text-green-400">₹{d.amount}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}

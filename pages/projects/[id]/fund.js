import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Script from "next/script";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { supabase } from "../../../lib/supabaseClient";

export default function FundProject() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [creator, setCreator] = useState(null);
  const [donors, setDonors] = useState([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

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

    if (!razorpayLoaded || !window.Razorpay) {
      alert("Payment system is loading. Please wait.");
      return;
    }

    setLoading(true);

    try {
      // 🔐 Get logged-in user
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        alert("Please login to continue");
        setLoading(false);
        return;
      }

      /* 1️⃣ Create Razorpay Order */
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              projectId: id,
              amount: Number(amount),
              payerId: auth.user.id, // ✅ CRITICAL FIX
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData?.success) {
            alert("Payment successful 🎉");
            setAmount("");
            loadData();
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
      {/* ✅ Razorpay SDK */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayLoaded(true)}
        onError={() => setRazorpayLoaded(false)}
      />

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-4xl mx-auto p-6 space-y-6">
          {/* PROJECT INFO */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h1 className="text-2xl font-bold text-white">{project?.title}</h1>
            <p className="text-slate-400">{project?.short}</p>
          </div>

          {/* CREATOR */}
          {creator && (
            <div className="flex gap-4 border border-slate-800 p-4 rounded-lg">
              {creator.photo && (
                <img
                  src={creator.photo}
                  className="w-20 h-20 rounded object-cover"
                />
              )}
              <div>
                <p className="text-white font-semibold">{creator.name}</p>
                <p className="text-slate-400">{creator.email}</p>
              </div>
            </div>
          )}

          {/* PAYMENT */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-white font-semibold">Support this project</h2>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="input"
            />

            <button
              onClick={handlePayment}
              disabled={!razorpayLoaded || loading || Number(amount) <= 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              {!razorpayLoaded
                ? "Loading Payment System..."
                : loading
                  ? "Processing..."
                  : "Pay with Razorpay"}
            </button>
          </div>

          {/* DONORS */}
          {donors.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-white font-semibold mb-3">
                Recent Supporters
              </h3>
              {donors.map((d) => (
                <div key={d.id} className="flex justify-between text-slate-300">
                  <span>{d.payer_id ? "User" : "Anonymous"}</span>
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

//pages/projects/[id]/fund.js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { supabase } from "../../../lib/supabaseClient";
import ProjectSummary from "../../../components/fund/ProjectSummary";
import FundingProgress from "../../../components/fund/FundingProgress";
import RewardTierCard from "../../../components/fund/RewardTierCard";
import CustomContribution from "../../../components/fund/CustomContribution";
import PaymentSummary from "../../../components/fund/PaymentSummary";
import TrustIndicators from "../../../components/fund/TrustIndicators";

const REWARD_TIERS = [
  { amount: 100,  title: "Supporter",   desc: "Basic support ❤️",               icon: "favorite",          badge: null,       deliveryDate: "Mar 2025", backers: 45 },
  { amount: 500,  title: "Backer",      desc: "Special thanks + shoutout 🚀",   icon: "rocket_launch",     badge: "Popular",  deliveryDate: "Jun 2025", backers: 23 },
  { amount: 1000, title: "Sponsor",     desc: "Premium supporter badge 💎",     icon: "workspace_premium", badge: "Premium",  deliveryDate: "Sep 2025", backers: 8 },
];

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

  // Tier selection state
  const [selectedTier, setSelectedTier] = useState(null); // null | tier index | "custom"

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

  /* ---------------- TIER SELECTION ---------------- */
  function selectTier(index) {
    setSelectedTier(index);
    setAmount(REWARD_TIERS[index].amount);
  }

  function selectCustom() {
    setSelectedTier("custom");
  }

  function handleCustomAmountChange(value) {
    setAmount(value);
    if (Number(value) > 0) {
      setSelectedTier("custom");
    } else {
      setSelectedTier(null);
    }
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

    // 🔥 STEP 3: Generate PDF (dynamic import — jspdf is ~29MB)
    const { generateReceipt } = await import("../../../lib/generateReceipt");
    generateReceipt(receiptData.receipt);

    alert("✅ Payment successful & receipt downloaded!");

    setAmount("");
    setSelectedTier(null);
    loadData();

  } catch (err) {
    console.error("Receipt flow error:", err);
    alert("Payment done but receipt failed");
  }
} else {
            alert("Payment verification failed");
          }
        },

        theme: { color: "#8b5cf6" },
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

  /* ---------------- DERIVED ---------------- */
  const currentTierName = selectedTier === "custom"
    ? "Custom Donation"
    : selectedTier !== null
      ? REWARD_TIERS[selectedTier].title
      : "No Selection";

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* Project Summary */}
            <ProjectSummary
              project={project}
              creator={creator}
              onBack={() => router.push(`/projects/${id}`)}
            />

            {/* Funding Progress */}
            <FundingProgress
              totalRaised={totalRaised}
              goal={goal}
              progress={progress}
              donorCount={donors.length}
            />

            {/* Reward Tiers */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-4"
            >
              <h2 className="font-geist text-xl font-semibold text-on-surface">
                Select Your Reward Tier
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {REWARD_TIERS.map((tier, i) => (
                  <RewardTierCard
                    key={tier.amount}
                    tier={tier}
                    selected={selectedTier === i}
                    onSelect={() => selectTier(i)}
                  />
                ))}

                <CustomContribution
                  value={selectedTier === "custom" ? amount : ""}
                  onChange={handleCustomAmountChange}
                  selected={selectedTier === "custom"}
                  onSelect={selectCustom}
                />
              </div>
            </motion.section>
          </div>

          {/* ── RIGHT COLUMN (Sticky Sidebar) ── */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <PaymentSummary
                tierName={currentTierName}
                amount={amount}
                loading={loading}
                onPay={handlePayment}
                disabled={!amount || Number(amount) < 10}
              />

              <TrustIndicators />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

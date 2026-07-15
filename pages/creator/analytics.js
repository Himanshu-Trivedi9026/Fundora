import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function CreatorAnalytics() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState("");
  const [aiActionData, setAiActionData] = useState(null);

  /* ---------------- LOAD USER ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    if (!user) return;

    loadAnalytics();

    const channel = supabase
      .channel("creator-analytics-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_donations" },
        loadAnalytics
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  async function loadAnalytics() {
    if (!user) return;

    setLoading(true);

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id);

    const { data: donationData } = await supabase
      .from("public_donations")
      .select("*, projects!inner(owner_id, title)")
      .eq("projects.owner_id", user.id);

    setProjects(projectData || []);
    setDonations(donationData || []);
    setLoading(false);
    if (projectData && donationData) {
  generateAIInsights();
}
  }
  async function generateAIInsights() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const res = await fetch("/api/ai/agent", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: `Analyze this creator data and give insights:

Projects: ${projects.length}
Total Earnings: ${totalEarnings}
Retention Rate: ${isNaN(retentionRate) ? 0 : retentionRate}%
Growth Score: ${growthEngine?.growthScore || 0}
Best Month: ${growthEngine?.bestMonth || "N/A"}

Give response ONLY in bullet points using this format:

• Point 1  
• Point 2  
• Point 3  

No paragraphs.`,
      }),
    });

    
    const data = await res.json();

setAiInsights(data.reply);   // ✅ THIS FIXES UI

setAiActionData({
  type: "auto",
  content: data.reply
});
  } catch (err) {
    console.error("AI Insight Error:", err);
  }
}

async function handleAIAction(type) {
  try {
    let prompt = "";

    if (type === "improve") {
  prompt = `You are Fundora AI, an elite crowdfunding strategist.You are a crowdfunding growth expert.

Analyze my campaign deeply.

Data:
• Total Projects: ${projects.length}
• Total Earnings: ₹${totalEarnings}
• Retention Rate: ${retentionRate}%
• Unique Donors: ${totalUniqueDonors}

Give:

1. 🔴 Weaknesses
2. 🟡 What is missing
3. 🟢 Exact improvements
4. ⚡ Priority actions (most important first)

Rules:
• Use bullet points only
• Keep it practical
• No long paragraphs`;
}

    if (type === "promotion") {
  prompt = `You are Fundora AI, an elite crowdfunding strategist.You are a crowdfunding marketing expert.

Create a high-conversion promotion strategy.

Data:
• Category: ${aiRecommendation?.category}
• Total Donors: ${totalUniqueDonors}
• Earnings: ₹${totalEarnings}

Give:

1. 📱 Best platforms (Instagram, LinkedIn, Reddit, etc.)
2. 🎯 Content strategy (what to post)
3. 🔥 Viral growth ideas
4. 💰 How to attract first 100 donors

Rules:
• Bullet points only
• Actionable tips
• No generic advice`;
}

   if (type === "goal") {
  prompt = `You are Fundora AI, an elite crowdfunding strategist.You are a crowdfunding financial advisor.

Suggest the optimal funding goal.

Data:
• Current Suggested Goal: ₹${aiRecommendation?.suggestedGoal}
• Earnings: ₹${totalEarnings}
• Donors: ${totalUniqueDonors}

Give:

1. 💰 Recommended goal
2. 📊 Why this goal is correct
3. ⚠️ Risk level (Low / Medium / High)
4. 🎯 Strategy to reach it

Rules:
• Bullet points only
• Keep it short
• Be practical`;
}

    const { data: { session } } = await supabase.auth.getSession();
    const headers = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const res = await fetch("/api/ai/agent", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: prompt }),
    });

    const data = await res.json();

    setAiActionData({
  type,
  content: data.reply
});

  } catch (err) {
    console.error("AI Action Error:", err);
  }
}

  /* ================= DONOR ANALYTICS ================= */

  const donorMap = useMemo(() => {
    const map = {};

    donations.forEach((d) => {
      if (!d.payer_id) return;

      if (!map[d.payer_id]) {
        map[d.payer_id] = {
  totalDonated: 0,
  donationCount: 0,
  lastDonation: new Date(d.created_at),
};
      }

      map[d.payer_id].totalDonated += d.amount;
      map[d.payer_id].donationCount += 1;
      map[d.payer_id].lastDonation = new Date(d.created_at);
    });

    return map;
  }, [donations]);

  const totalUniqueDonors = Object.keys(donorMap).length;

  const retentionRate = useMemo(() => {
    const returning = Object.values(donorMap).filter(
      (d) => d.donationCount > 1
    ).length;

    return totalUniqueDonors === 0
      ? 0
      : Math.round((returning / totalUniqueDonors) * 100);
  }, [donorMap]);

  /* =====================================================
   ⚠ DONOR CHURN PREDICTION AI
===================================================== */

const churnPredictions = useMemo(() => {

  const today = new Date();

  return Object.entries(donorMap).map(([payer, d]) => {

    // ----- RECENCY -----
    const daysSinceLast =
      Math.floor((today - d.lastDonation) / (1000 * 60 * 60 * 24));

    const recencyScore = Math.min(daysSinceLast * 1.5, 100);


    // ----- FREQUENCY -----
    const frequencyScore =
      d.donationCount >= 5
        ? 10
        : 60 - d.donationCount * 10;


    // ----- DONATION TREND -----
    const avgDonation = d.totalDonated / d.donationCount;

    const trendScore =
      avgDonation > 2000
        ? 10
        : 50;


    // ----- FINAL CHURN SCORE -----
    const churnScore = Math.round(
      0.4 * recencyScore +
      0.35 * frequencyScore +
      0.25 * trendScore
    );


    // ----- CLASSIFICATION -----
    let status = "🟢 Loyal";

    if (churnScore > 70) status = "🔴 High Risk";
    else if (churnScore > 40) status = "🟡 At Risk";

    return {
      payer,
      churnScore,
      status,
      lastDonationDays: daysSinceLast
    };

  }).sort((a,b) => b.churnScore - a.churnScore);

}, [donorMap]);


  /* ================= AI PROJECT RECOMMENDATION ================= */

  const aiRecommendation = useMemo(() => {
    if (!projects.length) return null;

    const categoryScore = {};

    projects.forEach((p) => {
      if (!p.categories) return;

      const success = (p.pledged || 0) / (p.goal || 1);

      p.categories.forEach((cat) => {
        categoryScore[cat] = (categoryScore[cat] || 0) + success;
      });
    });

    const bestCategory =
      Object.entries(categoryScore).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "General";

    const avgGoal =
      projects.reduce((s, p) => s + (p.goal || 0), 0) /
      (projects.length || 1);

    const avgDonation =
      donations.reduce((s, d) => s + d.amount, 0) /
      (donations.length || 1);

    return {
      category: bestCategory,
      suggestedGoal: Math.round(avgGoal * 1.1),
      donorStrength: Math.round(avgDonation),
    };
  }, [projects, donations]);

  /* ================= AI REVENUE FORECAST ================= */

  const monthlyRevenue = useMemo(() => {
    const map = {};

    donations.forEach((d) => {
      const month = new Date(d.created_at).toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      map[month] = (map[month] || 0) + d.amount;
    });

    return Object.entries(map).map(([month, amount]) => ({
      month,
      amount,
    }));
  }, [donations]);

  const revenueForecast = useMemo(() => {
    if (monthlyRevenue.length < 2) return [];

    const last = monthlyRevenue.at(-1).amount;
    const prev = monthlyRevenue.at(-2).amount;

    const growth = prev === 0 ? 0.1 : (last - prev) / prev;

    let current = last;
    const forecast = [];

    for (let i = 1; i <= 6; i++) {
      current = Math.max(0, current * (1 + growth));

      forecast.push({
        month: `+${i} Month`,
        predicted: Math.round(current),
      });
    }

    return forecast;
  }, [monthlyRevenue]);

  /* ================= ADVANCED CREATOR GROWTH ENGINE ================= */

  const growthEngine = useMemo(() => {
    if (!projects.length) return null;

    const successfulProjects = projects.filter(
      (p) => (p.pledged || 0) >= (p.goal || 1)
    ).length;

    const successRate = Math.round(
      (successfulProjects / projects.length) * 100
    );

    const donorProjectSpread = {};

    donations.forEach((d) => {
      if (!d.payer_id) return;

      donorProjectSpread[d.payer_id] =
        donorProjectSpread[d.payer_id] || new Set();

      donorProjectSpread[d.payer_id].add(d.project_id);
    });

    const multiProjectDonors = Object.values(donorProjectSpread)
      .filter((set) => set.size > 1).length;

    const donorExpansion =
      totalUniqueDonors === 0
        ? 0
        : Math.round((multiProjectDonors / totalUniqueDonors) * 100);

    const growthScore = Math.round(
      0.35 * successRate +
        0.3 * retentionRate +
        0.2 * donorExpansion +
        0.15 * Math.min(totalUniqueDonors * 5, 100)
    );

    const monthMap = {};

    donations.forEach((d) => {
      const m = new Date(d.created_at).toLocaleString("default", {
        month: "long",
      });

      monthMap[m] = (monthMap[m] || 0) + d.amount;
    });

    const bestMonth =
      Object.entries(monthMap).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "Unknown";

    const fundingProbability = Math.min(
      95,
      Math.round(
        0.5 * successRate +
          0.3 * retentionRate +
          0.2 * growthScore
      )
    );

    return {
      growthScore,
      successRate,
      donorExpansion,
      bestMonth,
      fundingProbability,
    };
  }, [projects, donations, retentionRate, totalUniqueDonors]);

  /* ================= EXISTING METRICS ================= */

  const totalEarnings = useMemo(
    () => donations.reduce((s, d) => s + d.amount, 0),
    [donations]
  );

  const earningsByDate = useMemo(() => {
    return Object.values(
      donations.reduce((acc, d) => {
        const date = new Date(d.created_at).toLocaleDateString();
        acc[date] = acc[date] || { date, amount: 0 };
        acc[date].amount += d.amount;
        return acc;
      }, {})
    );
  }, [donations]);

  const fundingByProject = useMemo(
    () =>
      projects.map((p) => ({
        name: p.title,
        amount: p.pledged || 0,
      })),
    [projects]
  );

  /* ================= UI ================= */

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-3xl font-bold text-white">
  🚀 Your Growth Dashboard
</h1>

        {loading && <p className="text-slate-400">Loading...</p>}

{/* 🔥 AI INSIGHTS */}
{!loading && (
  <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-700 rounded-xl p-4 shadow-lg">
    <h2 className="text-sm font-semibold text-purple-300 mb-2">
      🤖 AI Insights
    </h2>

    <div className="text-sm text-gray-300 whitespace-pre-line">
  {aiInsights || "Generating AI insights..."}
</div>
  </div>
)}
        {!loading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat title="Total Earnings" value={`₹${totalEarnings}`} />
              <Stat title="Unique Donors" value={totalUniqueDonors} />
              <Stat title="Retention Rate" value={`${retentionRate}%`} />
              <Stat title="Projects" value={projects.length} />
            </div>

            {aiRecommendation && (
              <ChartBox title="🤖 AI Project Recommendation">
                <p className="text-slate-300">
                  👉 Best Performing Category:
                  <span className="text-blue-400 ml-2">
                    {aiRecommendation.category}
                  </span>
                </p>

                <p className="text-slate-300 mt-2">
                  🎯 Suggested Funding Goal:
                  <span className="text-green-400 ml-2">
                    ₹{aiRecommendation.suggestedGoal}
                  </span>
                </p>

                <p className="text-slate-300 mt-2">
                  💰 Donor Avg Contribution:
                  <span className="text-yellow-400 ml-2">
                    ₹{aiRecommendation.donorStrength}
                  </span>
                </p>
              </ChartBox>
            )}

            {growthEngine && (
              <ChartBox title="🚀 Advanced Creator Growth Engine">

                {/* 🔥 Growth Score with Progress Bar */}
<div className="mb-4">
  <div className="flex justify-between text-sm mb-1">
    <span>Growth Score</span>

    <span
      className={`font-semibold ${
        growthEngine.growthScore > 70
          ? "text-green-400"
          : growthEngine.growthScore > 40
          ? "text-yellow-400"
          : "text-red-400"
      }`}
    >
      {growthEngine.growthScore}/100
    </span>
  </div>

  <div className="w-full bg-slate-700 h-2 rounded">
    <div
      className={`h-2 rounded ${
        growthEngine.growthScore > 70
          ? "bg-green-400"
          : growthEngine.growthScore > 40
          ? "bg-yellow-400"
          : "bg-red-400"
      }`}
      style={{ width: `${growthEngine.growthScore}%` }}
    />
  </div>
</div>

                <GrowthRow
                  label="Campaign Success Rate"
                  value={`${growthEngine.successRate}%`}
                  color="text-green-400"
                />

                <GrowthRow
                  label="Donor Expansion"
                  value={`${isNaN(growthEngine.donorExpansion) ? 0 : growthEngine.donorExpansion}%`}
                  color="text-blue-400"
                />

                <GrowthRow
                  label="Best Launch Month"
                  value={growthEngine.bestMonth}
                  color="text-yellow-400"
                />

                <GrowthRow
                  label="Next Project Funding Probability"
                  value={`${growthEngine.fundingProbability}%`}
                  color="text-pink-400"
                />
                <div className="mt-4 flex gap-2 flex-wrap">

  <button
    onClick={() => handleAIAction("improve")}
    className="bg-gradient-to-r from-purple-600 to-pink-500 px-3 py-2 rounded-lg text-sm hover:scale-105 transition"
  >
    🚀 Improve Campaign
  </button>

  <button
    onClick={() => handleAIAction("promotion")}
    className="bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 rounded-lg text-sm hover:scale-105 transition"
  >
    📢 Promotion Tips
  </button>

  <button
    onClick={() => handleAIAction("goal")}
    className="bg-gradient-to-r from-green-600 to-emerald-500 px-3 py-2 rounded-lg text-sm hover:scale-105 transition"
  >
    💰 Optimize Goal
  </button>

</div>
              </ChartBox>
            )}

{/* 🔥 AI ACTION PANEL */}
{aiActionData && (
  <ChartBox title={`🤖 AI ${aiActionData.type.toUpperCase()} ANALYSIS`}>
    
    <div className="text-sm text-gray-300 whitespace-pre-line">
      {aiActionData.content}
    </div>

  </ChartBox>
)}

            {/* ⚠ DONOR CHURN ALERTS */}
<ChartBox title="⚠ Donor Churn Risk">

  {churnPredictions.length === 0 && (
    <p className="text-slate-400">No donor data</p>
  )}

  {churnPredictions.slice(0,5).map((d,i) => (

    <div
      key={i}
      className="flex justify-between border-b border-slate-800 py-3"
    >
      <span className="text-slate-200">
        Donor #{i + 1}
      </span>

      <span className="text-slate-300">
        {d.status} ({isNaN(d.churnScore) ? 0 : d.churnScore})
      </span>

    </div>

  ))}

</ChartBox>


            <ChartBox title="🔮 AI Revenue Prediction">
              {revenueForecast.length === 0 ? (
                <p className="text-slate-400 text-center">
                  Need at least 2 months data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueForecast}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="predicted" stroke="#facc15" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartBox>

            <ChartBox title="Earnings Over Time">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={earningsByDate}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="amount" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="Funding by Project">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fundingByProject}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function Stat({ title, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-400">{title}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartBox({ title, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function GrowthRow({ label, value, color }) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-3">
      <span className="text-slate-300">{label}</span>
      <span className={`${color} font-semibold`}>{value}</span>
    </div>
  );
}

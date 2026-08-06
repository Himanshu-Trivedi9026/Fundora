import { useCallback, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

// Lazy-load recharts (~8.3MB) — only loaded when this page renders
const RevenueForecastChart = dynamic(
  () =>
    import("../../components/AnalyticsCharts").then(
      (m) => m.RevenueForecastChart,
    ),
  { ssr: false },
);
const EarningsOverTimeChart = dynamic(
  () =>
    import("../../components/AnalyticsCharts").then(
      (m) => m.EarningsOverTimeChart,
    ),
  { ssr: false },
);
const FundingByProjectChart = dynamic(
  () =>
    import("../../components/AnalyticsCharts").then(
      (m) => m.FundingByProjectChart,
    ),
  { ssr: false },
);

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

export default function CreatorAnalytics() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState("");
  const [aiActionData, setAiActionData] = useState(null);

  /* ================= LOAD USER (once) ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

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
      (d) => d.donationCount > 1,
    ).length;

    return totalUniqueDonors === 0
      ? 0
      : Math.round((returning / totalUniqueDonors) * 100);
  }, [donorMap, totalUniqueDonors]);

  /* ================= ADVANCED CREATOR GROWTH ENGINE ================= */

  const growthEngine = useMemo(() => {
    if (!projects.length) return null;

    const successfulProjects = projects.filter(
      (p) => (p.pledged || 0) >= (p.goal || 1),
    ).length;

    const successRate = Math.round(
      (successfulProjects / projects.length) * 100,
    );

    const donorProjectSpread = {};

    donations.forEach((d) => {
      if (!d.payer_id) return;

      donorProjectSpread[d.payer_id] =
        donorProjectSpread[d.payer_id] || new Set();

      donorProjectSpread[d.payer_id].add(d.project_id);
    });

    const multiProjectDonors = Object.values(donorProjectSpread).filter(
      (set) => set.size > 1,
    ).length;

    const donorExpansion =
      totalUniqueDonors === 0
        ? 0
        : Math.round((multiProjectDonors / totalUniqueDonors) * 100);

    const growthScore = Math.round(
      0.35 * successRate +
        0.3 * retentionRate +
        0.2 * donorExpansion +
        0.15 * Math.min(totalUniqueDonors * 5, 100),
    );

    const monthMap = {};

    donations.forEach((d) => {
      const m = new Date(d.created_at).toLocaleString("default", {
        month: "long",
      });

      monthMap[m] = (monthMap[m] || 0) + d.amount;
    });

    const bestMonth =
      Object.entries(monthMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

    const fundingProbability = Math.min(
      95,
      Math.round(0.5 * successRate + 0.3 * retentionRate + 0.2 * growthScore),
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
    [donations],
  );

  const generateAIInsights = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

      setAiInsights(data.reply);

      setAiActionData({
        type: "auto",
        content: data.reply,
      });
    } catch (err) {
      console.error("AI Insight Error:", err);
    }
  }, [projects, totalEarnings, retentionRate, growthEngine]);

  const loadAnalytics = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      if (!user) return;

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
      if (projectData && donationData) {
        generateAIInsights();
      }
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [user, generateAIInsights]);

  /* ================= REALTIME ================= */
  useEffect(() => {
    if (!user) return;

    loadAnalytics();

    const channel = supabase
      .channel("creator-analytics-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_donations" },
        loadAnalytics,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, loadAnalytics]);

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

      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        content: data.reply,
      });
    } catch (err) {
      console.error("AI Action Error:", err);
    }
  }

  /* ================= DONOR CHURN PREDICTION ================= */

  const churnPredictions = useMemo(() => {
    const today = new Date();

    return Object.entries(donorMap)
      .map(([payer, d]) => {
        const daysSinceLast = Math.floor(
          (today - d.lastDonation) / (1000 * 60 * 60 * 24),
        );

        const recencyScore = Math.min(daysSinceLast * 1.5, 100);

        const frequencyScore =
          d.donationCount >= 5 ? 10 : 60 - d.donationCount * 10;

        const avgDonation = d.totalDonated / d.donationCount;

        const trendScore = avgDonation > 2000 ? 10 : 50;

        const churnScore = Math.round(
          0.4 * recencyScore + 0.35 * frequencyScore + 0.25 * trendScore,
        );

        let status = "\u{1F7E2} Loyal";

        if (churnScore > 70) status = "\u{1F534} High Risk";
        else if (churnScore > 40) status = "\u{1F7E1} At Risk";

        return {
          payer,
          churnScore,
          status,
          lastDonationDays: daysSinceLast,
        };
      })
      .sort((a, b) => b.churnScore - a.churnScore);
  }, [donorMap]);

  /* ================= AI PROJECT RECOMMENDATION ================= */

  function getAiRecommendation() {
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
      projects.reduce((s, p) => s + (p.goal || 0), 0) / (projects.length || 1);

    const avgDonation =
      donations.reduce((s, d) => s + d.amount, 0) / (donations.length || 1);

    return {
      category: bestCategory,
      suggestedGoal: Math.round(avgGoal * 1.1),
      donorStrength: Math.round(avgDonation),
    };
  }

  const aiRecommendation = getAiRecommendation();

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

  const earningsByDate = useMemo(() => {
    return Object.values(
      donations.reduce((acc, d) => {
        const date = new Date(d.created_at).toLocaleDateString();
        acc[date] = acc[date] || { date, amount: 0 };
        acc[date].amount += d.amount;
        return acc;
      }, {}),
    );
  }, [donations]);

  const fundingByProject = useMemo(
    () =>
      projects.map((p) => ({
        name: p.title,
        amount: p.pledged || 0,
      })),
    [projects],
  );

  /* ================= UI ================= */

  const kpiCards = [
    {
      label: "Total Earnings",
      value: `₹${totalEarnings}`,
      icon: "account_balance_wallet",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Unique Donors",
      value: totalUniqueDonors,
      icon: "group",
      color: "text-success",
      bg: "bg-success-muted",
    },
    {
      label: "Retention Rate",
      value: `${retentionRate}%`,
      icon: "trending_up",
      color: "text-warning",
      bg: "bg-warning-muted",
    },
    {
      label: "Active Projects",
      value: projects.length,
      icon: "rocket_launch",
      color: "text-danger",
      bg: "bg-danger-muted",
    },
  ];

  const growthMetrics = [
    {
      label: "Campaign Success Rate",
      value: growthEngine?.successRate || 0,
      color: "bg-success",
      suffix: "%",
    },
    {
      label: "Donor Expansion",
      value: isNaN(growthEngine?.donorExpansion)
        ? 0
        : growthEngine?.donorExpansion || 0,
      color: "bg-primary",
      suffix: "%",
    },
    {
      label: "Best Launch Month",
      value: growthEngine?.bestMonth || "N/A",
      isText: true,
    },
    {
      label: "Funding Probability",
      value: growthEngine?.fundingProbability || 0,
      color: "bg-primary-container",
      suffix: "%",
    },
  ];

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
            aria-label="Loading analytics"
            className="text-on-surface-variant font-inter text-lg"
          >
            Loading analytics...
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
            <h1 className="font-geist text-4xl md:text-5xl font-bold text-on-surface tracking-tighter mb-3">
              Growth Dashboard
            </h1>
            <p className="text-on-surface-variant font-inter text-lg">
              Track your performance, discover insights, and grow faster
            </p>
          </motion.div>

          {/* ═══════════ AI INSIGHTS BANNER ═══════════ */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.1,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="glass-card border-l-4 border-primary p-6 rounded-xl mb-8 relative overflow-hidden"
          >
            <div className="absolute top-4 right-4">
              <span
                className="material-symbols-outlined text-primary text-3xl animate-pulse"
                aria-hidden="true"
              >
                auto_awesome
              </span>
            </div>
            <h2 className="font-geist text-sm font-semibold text-primary mb-3 uppercase tracking-wider">
              AI Insights
            </h2>
            <div className="text-on-surface-variant font-inter text-sm whitespace-pre-line leading-relaxed pr-12">
              {aiInsights || "Generating AI insights..."}
            </div>
          </motion.div>

          {/* ═══════════ KPI CARDS ═══════════ */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            {kpiCards.map((kpi) => (
              <motion.div
                key={kpi.label}
                variants={fadeUp}
                whileHover={{ y: -3 }}
                className="glass-card p-6 rounded-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center`}
                  >
                    <span
                      className={`material-symbols-outlined text-xl ${kpi.color}`}
                      aria-hidden="true"
                    >
                      {kpi.icon}
                    </span>
                  </div>
                </div>
                <p className="text-on-surface-variant font-inter text-sm mb-1">
                  {kpi.label}
                </p>
                <p className="font-geist text-2xl font-bold text-on-surface">
                  {kpi.value}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* ═══════════ BENTO GRID ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* ─── Project Recommendations ─── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:col-span-4"
            >
              <div className="glass-card p-6 rounded-xl h-full">
                <div className="flex items-center gap-2 mb-6">
                  <span
                    className="material-symbols-outlined text-primary"
                    aria-hidden="true"
                  >
                    lightbulb
                  </span>
                  <h3 className="font-geist text-lg font-semibold text-on-surface">
                    Project Recommendations
                  </h3>
                </div>

                {aiRecommendation ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-on-surface-variant font-inter text-xs uppercase tracking-wider mb-1">
                        Best Performing Category
                      </p>
                      <p className="text-primary font-inter text-sm font-semibold">
                        {aiRecommendation.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant font-inter text-xs uppercase tracking-wider mb-1">
                        Suggested Funding Goal
                      </p>
                      <p className="text-success font-inter text-sm font-semibold">
                        ₹{aiRecommendation.suggestedGoal}
                      </p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant font-inter text-xs uppercase tracking-wider mb-1">
                        Donor Avg Contribution
                      </p>
                      <p className="text-warning font-inter text-sm font-semibold">
                        ₹{aiRecommendation.donorStrength}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-on-surface-variant font-inter text-sm">
                    No recommendation data available
                  </p>
                )}
              </div>
            </motion.div>

            {/* ─── Growth Engine ─── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="lg:col-span-8"
            >
              <div className="glass-card p-6 rounded-xl h-full">
                <div className="flex items-center gap-2 mb-6">
                  <span
                    className="material-symbols-outlined text-primary"
                    aria-hidden="true"
                  >
                    speed
                  </span>
                  <h3 className="font-geist text-lg font-semibold text-on-surface">
                    Advanced Creator Growth Engine
                  </h3>
                </div>

                {growthEngine ? (
                  <>
                    {/* Growth Score — main metric */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-on-surface font-inter text-sm font-medium">
                          Growth Score
                        </span>
                        <span
                          className={`font-geist text-lg font-bold ${
                            growthEngine.growthScore > 70
                              ? "text-success"
                              : growthEngine.growthScore > 40
                                ? "text-warning"
                                : "text-danger"
                          }`}
                        >
                          {growthEngine.growthScore}/100
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{
                            width: `${growthEngine.growthScore}%`,
                          }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            growthEngine.growthScore > 70
                              ? "bg-success"
                              : growthEngine.growthScore > 40
                                ? "bg-warning"
                                : "bg-danger"
                          }`}
                          role="progressbar"
                          aria-valuenow={growthEngine.growthScore}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-label="Growth score progress"
                        />
                      </div>
                    </div>

                    {/* Other metrics — progress bars */}
                    <div className="space-y-4">
                      {growthMetrics
                        .filter((m) => m.isText === undefined)
                        .map((metric) => (
                          <div key={metric.label}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-on-surface-variant font-inter text-sm">
                                {metric.label}
                              </span>
                              <span className="text-on-surface font-inter text-sm font-medium">
                                {metric.value}
                                {metric.suffix || ""}
                              </span>
                            </div>
                            <div
                              className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={Math.min(
                                100,
                                typeof metric.value === "number"
                                  ? metric.value
                                  : 0,
                              )}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={metric.label}
                            >
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{
                                  width: `${Math.min(100, typeof metric.value === "number" ? metric.value : 0)}%`,
                                }}
                                viewport={{ once: true }}
                                transition={{
                                  duration: 1,
                                  ease: "easeOut",
                                  delay: 0.2,
                                }}
                                className={`h-full rounded-full ${metric.color}`}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        ))}

                      {/* Best Month — text row */}
                      <div className="flex justify-between items-center py-2 border-t border-outline-variant/20">
                        <span className="text-on-surface-variant font-inter text-sm">
                          Best Launch Month
                        </span>
                        <span className="text-warning font-inter text-sm font-semibold">
                          {growthEngine.bestMonth}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-3 flex-wrap">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAIAction("improve")}
                        className="px-4 py-2.5 bg-gradient-to-r from-primary-container to-primary rounded-lg font-inter text-sm font-medium text-on-primary shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-shadow"
                      >
                        Improve Campaign
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAIAction("promotion")}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg font-inter text-sm font-medium text-white shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.35)] transition-shadow"
                      >
                        Promotion Tips
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAIAction("goal")}
                        className="px-4 py-2.5 bg-gradient-to-r from-success to-emerald-400 rounded-lg font-inter text-sm font-medium text-on-primary shadow-[0_0_15px_rgba(52,211,153,0.2)] hover:shadow-[0_0_25px_rgba(52,211,153,0.35)] transition-shadow"
                      >
                        Optimize Goal
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <p className="text-on-surface-variant font-inter text-sm">
                    No growth data available
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* ═══════════ AI ACTION PANEL (conditional) ═══════════ */}
          {aiActionData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass-card p-6 rounded-xl mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-primary animate-pulse"
                  aria-hidden="true"
                >
                  psychology
                </span>
                <h3 className="font-geist text-lg font-semibold text-on-surface">
                  AI {aiActionData.type.toUpperCase()} Analysis
                </h3>
              </div>
              <div className="text-on-surface-variant font-inter text-sm whitespace-pre-line leading-relaxed">
                {aiActionData.content}
              </div>
            </motion.div>
          )}

          {/* ═══════════ CHARTS SECTION ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Earnings Over Time */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass-card p-6 rounded-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="material-symbols-outlined text-primary"
                  aria-hidden="true"
                >
                  bar_chart
                </span>
                <h3 className="font-geist text-lg font-semibold text-on-surface">
                  Earnings Over Time
                </h3>
              </div>
              <EarningsOverTimeChart data={earningsByDate} />
            </motion.div>

            {/* Funding by Project */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="glass-card p-6 rounded-xl"
            >
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="material-symbols-outlined text-primary"
                  aria-hidden="true"
                >
                  pie_chart
                </span>
                <h3 className="font-geist text-lg font-semibold text-on-surface">
                  Funding by Project
                </h3>
              </div>
              {fundingByProject.length > 0 ? (
                <div className="space-y-4">
                  {fundingByProject.map((item, i) => {
                    const maxAmount = Math.max(
                      ...fundingByProject.map((f) => f.amount),
                      1,
                    );
                    const progress = Math.min(
                      (item.amount / maxAmount) * 100,
                      100,
                    );

                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-on-surface font-inter text-sm truncate mr-4">
                            {item.name}
                          </span>
                          <span className="text-on-surface-variant font-inter text-sm shrink-0">
                            ₹{item.amount.toLocaleString()}
                          </span>
                        </div>
                        <div
                          className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={item.name}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${progress}%` }}
                            viewport={{ once: true }}
                            transition={{
                              duration: 1,
                              ease: "easeOut",
                              delay: i * 0.1,
                            }}
                            className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-on-surface-variant font-inter text-sm">
                  No project data
                </p>
              )}
            </motion.div>
          </div>

          {/* ═══════════ FOOTER ANALYSIS CARDS ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donor Churn Risk */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="glass-card p-6 rounded-xl border-l-4 border-danger"
            >
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="material-symbols-outlined text-danger"
                  aria-hidden="true"
                >
                  warning
                </span>
                <h3 className="font-geist text-lg font-semibold text-on-surface">
                  Donor Churn Risk
                </h3>
              </div>

              {churnPredictions.length === 0 ? (
                <p className="text-on-surface-variant font-inter text-sm">
                  No donor data
                </p>
              ) : (
                <div className="space-y-0">
                  {churnPredictions.slice(0, 5).map((d, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-3 border-b border-outline-variant/20 last:border-0"
                    >
                      <span className="text-on-surface font-inter text-sm">
                        Donor #{i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-inter text-sm ${
                            d.churnScore > 70
                              ? "text-danger"
                              : d.churnScore > 40
                                ? "text-warning"
                                : "text-success"
                          }`}
                        >
                          {d.status}
                        </span>
                        <span className="text-on-surface-variant font-inter text-xs">
                          ({isNaN(d.churnScore) ? 0 : d.churnScore})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Revenue Prediction */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="glass-card p-6 rounded-xl border-l-4 border-success"
            >
              <div className="flex items-center gap-2 mb-6">
                <span
                  className="material-symbols-outlined text-success"
                  aria-hidden="true"
                >
                  show_chart
                </span>
                <h3 className="font-geist text-lg font-semibold text-on-surface">
                  Revenue Prediction
                </h3>
              </div>
              <RevenueForecastChart data={revenueForecast} />
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

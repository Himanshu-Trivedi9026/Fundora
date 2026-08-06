import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SETTLED_DONATION_STATUS,
  DONATION_SELECT,
  RECOMMENDED_SELECT,
  clearInvestorCache,
  loadInvestorDonations,
  loadInvestorPortfolio,
  loadRecommendedProjects,
  loadInvestorAnalytics,
  derivePortfolioStats,
  computePortfolioHealth,
  derivePortfolioMetrics,
  deriveAiInsights,
  deriveAnalytics,
} from "../../../lib/investor/investorData";

/**
 * Build a fake supabase-js client whose `from(table)` returns an await-able
 * query chain resolving to the given payload (mirror of the landing tests).
 */
function makeClient(tables = {}) {
  const captured = [];
  const from = vi.fn((table) => {
    const result = tables[table] || { data: [], error: null };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve) => resolve(result),
    };
    captured.push({ table, chain });
    return chain;
  });
  return { client: { from }, from, captured };
}

const project = (id, title, overrides = {}) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  thumbnail: null,
  goal: 100000,
  pledged: 50000,
  categories: ["AI"],
  deleted: false,
  ...overrides,
});

const donation = (id, amount, status, project_id, created_at, overrides = {}) => ({
  id,
  amount,
  status,
  project_id,
  created_at,
  projects: project(project_id, `Project ${project_id}`, { pledged: 60000 }),
  ...overrides,
});

// 2026-07-15T00:00:00Z as ms (fixed "now" for deterministic range tests).
const NOW_MS = new Date("2026-07-15T00:00:00Z").getTime();

beforeEach(() => {
  clearInvestorCache();
});

describe("SETTLED_DONATION_STATUS", () => {
  it("is 'paid' (verify.js inserts 'paid'; nothing writes 'completed')", () => {
    expect(SETTLED_DONATION_STATUS).toBe("paid");
  });
});

describe("derivePortfolioStats", () => {
  it("counts only settled donations toward invested totals and reports the rest", () => {
    const stats = derivePortfolioStats([
      donation("d1", 5000, "paid", "p1", "2026-05-01"),
      donation("d2", 3000, "pending", "p2", "2026-05-02"),
      donation("d3", 2000, "failed", "p2", "2026-05-03"),
      donation("d4", 1000, "refunded", "p3", "2026-05-04"),
    ]);

    expect(stats.totalInvested).toBe(5000);
    expect(stats.completedCount).toBe(1);
    expect(stats.projectsFunded).toBe(1);
    expect(stats.pendingAmount).toBe(3000);
    expect(stats.failedCount).toBe(1);
    expect(stats.refundedCount).toBe(1);
    expect(stats.largestDonation).toBe(5000);
    expect(stats.averageDonation).toBe(5000);
  });

  it("dedupes to one entry per settled project with per-project invested totals", () => {
    const stats = derivePortfolioStats([
      donation("d1", 1000, "paid", "p1", "2026-04-01"),
      donation("d2", 2000, "paid", "p1", "2026-05-01"),
      donation("d3", 500, "paid", "p2", "2026-06-01"),
    ]);

    expect(stats.projectsFunded).toBe(2);
    expect(stats.totalInvested).toBe(3500);
    expect(stats.avgPerProject).toBe(1750);
    expect(stats.averageDonation).toBeCloseTo(1166.67, 2);

    const p1 = stats.fundedProjects.find((p) => p.id === "p1");
    expect(p1.invested).toBe(3000);
    expect(p1.donationCount).toBe(2);
    // Latest settled donation snapshot wins.
    expect(p1.lastDonatedAt).toBe("2026-05-01");
    // Newest-funded-first ordering.
    expect(stats.fundedProjects[0].id).toBe("p2");
  });

  it("tracks active month count and first/last settled dates for health scoring", () => {
    const stats = derivePortfolioStats([
      donation("d1", 100, "paid", "p1", "2026-01-05"),
      donation("d2", 100, "paid", "p2", "2026-01-20"),
      donation("d3", 100, "paid", "p3", "2026-03-10"),
    ]);
    expect(stats.activeMonths).toBe(2); // Jan + Mar
    expect(stats.firstSettledAt).toBe("2026-01-05");
    expect(stats.lastSettledAt).toBe("2026-03-10");
  });

  it("returns a safe zero-shaped stats object for empty input", () => {
    const stats = derivePortfolioStats(null);
    expect(stats.totalInvested).toBe(0);
    expect(stats.projectsFunded).toBe(0);
    expect(stats.fundedProjects).toEqual([]);
    expect(stats.averageDonation).toBe(0);
  });
});

describe("computePortfolioHealth", () => {
  it("returns a 0-100 composite that rewards diversification", () => {
    const concentrated = computePortfolioHealth({
      totalInvested: 1000,
      fundedProjects: [
        { invested: 1000, goal: 100, pledged: 50, categories: ["AI"] },
      ],
    });
    expect(concentrated.score).toBeGreaterThanOrEqual(0);
    expect(concentrated.score).toBeLessThanOrEqual(100);
    // Single project => zero diversification component.
    expect(concentrated.breakdown.diversification).toBe(0);
  });

  it("scores even, multi-category, well-funded portfolios higher", () => {
    const healthy = computePortfolioHealth({
      totalInvested: 1000,
      fundedProjects: [
        { invested: 250, goal: 100, pledged: 90, categories: ["AI"] },
        { invested: 250, goal: 100, pledged: 80, categories: ["Climate"] },
        { invested: 250, goal: 100, pledged: 70, categories: ["Health"] },
        { invested: 250, goal: 100, pledged: 60, categories: ["EdTech"] },
      ],
    });
    expect(healthy.breakdown.diversification).toBeGreaterThan(50);
    expect(healthy.breakdown.categorySpread).toBe(80); // 4 * 20, capped at 100
    expect(healthy.breakdown.fundingProgress).toBe(75);
    expect(healthy.score).toBeGreaterThan(60);
  });

  it("computes consistency from active months vs months since first donation", () => {
    const stats = derivePortfolioStats([
      donation("d1", 100, "paid", "p1", "2026-01-05"),
      donation("d2", 100, "paid", "p2", "2026-01-20"),
      donation("d3", 100, "paid", "p3", "2026-02-10"),
    ]);
    // 2 active months (Jan, Feb) over ~6 months since Jan → ~33.
    const health = computePortfolioHealth(stats, { now: NOW_MS });
    expect(health.breakdown.consistency).toBeGreaterThan(0);
    expect(health.breakdown.consistency).toBeLessThanOrEqual(100);
  });

  it("returns a zero score with no investments (no NaN)", () => {
    const health = computePortfolioHealth(derivePortfolioStats([]));
    expect(health.score).toBe(0);
    expect(health.breakdown).toEqual({
      diversification: 0,
      fundingProgress: 0,
      categorySpread: 0,
      consistency: 0,
    });
  });
});

describe("derivePortfolioMetrics", () => {
  it("computes ROI, current value, diversification, and category allocation from settled stats", () => {
    // Two settled projects (60/40 split) — mixed funding progress.
    const stats = derivePortfolioStats([
      donation("d1", 6000, "paid", "p1", "2026-05-01", {
        projects: project("p1", "Alpha Fund", { goal: 200000, pledged: 150000, categories: ["AI"] }),
      }),
      donation("d2", 4000, "paid", "p2", "2026-06-01", {
        projects: project("p2", "Beta Fund", { goal: 100000, pledged: 50000, categories: ["Climate"] }),
      }),
      // Pending donations are ignored for these settled-only figures.
      donation("d3", 9000, "pending", "p3", "2026-07-01"),
    ]);

    const m = derivePortfolioMetrics(stats);

    // ROI = avg funding progress: (75% + 50%) / 2 = 62.5 → 63.
    expect(m.roi).toBe(63);
    // Current value = invested (10,000) scaled by growth → 16,300.
    expect(m.currentValue).toBe(16300);
    // Diversification: shares 0.6/0.4 → HHI 0.52 → (1 - 0.52) * 100 = 48.
    expect(m.diversification).toBe(48);
    // Category allocation from the two settled projects' invested amounts.
    expect(m.categoryAllocation).toEqual([
      { name: "AI", value: 6000 },
      { name: "Climate", value: 4000 },
    ]);
  });

  it("rolls up categories beyond the top 6 into Others", () => {
    const stats = derivePortfolioStats(
      ["AI", "Climate", "Health", "Education", "Music", "Film", "Food"].map(
        (cat, i) =>
          donation(`d${i}`, 1000, "paid", `p${i}`, "2026-05-01", {
            projects: project(`p${i}`, `Project ${i}`, { categories: [cat] }),
          }),
      ),
    );

    const { categoryAllocation } = derivePortfolioMetrics(stats);
    expect(categoryAllocation.length).toBe(7); // 6 top + Others
    expect(categoryAllocation[6]).toEqual({ name: "Others", value: 1000 });
  });

  it("returns safe zero values for an empty portfolio (no NaN)", () => {
    const m = derivePortfolioMetrics(derivePortfolioStats([]));
    expect(m).toEqual({ roi: 0, currentValue: 0, diversification: 0, categoryAllocation: [] });
  });
});

describe("loadInvestorPortfolio", () => {
  it("fires donations, saved count, and follower count in parallel", () => {
    const { client, from } = makeClient({
      public_donations: { data: [donation("d1", 5000, "paid", "p1", "2026-05-01")] },
      saved_projects: { data: null, count: 3 },
      followers: { data: null, count: 7 },
    });

    const promise = loadInvestorPortfolio(client, "u1");

    expect(from).toHaveBeenCalledWith("public_donations");
    expect(from).toHaveBeenCalledWith("saved_projects");
    expect(from).toHaveBeenCalledWith("followers");

    return promise.then(({ stats, savedProjects, followers }) => {
      expect(stats.totalInvested).toBe(5000);
      expect(savedProjects).toBe(3);
      expect(followers).toBe(7);
    });
  });

  it("passes the payer filter and orders newest-first", async () => {
    const { client, captured } = makeClient({
      public_donations: { data: [] },
      saved_projects: { data: null, count: 0 },
      followers: { data: null, count: 0 },
    });
    await loadInvestorPortfolio(client, "u42");

    const donationsChain = captured.find((c) => c.table === "public_donations").chain;
    expect(donationsChain.select).toHaveBeenCalledWith(DONATION_SELECT);
    expect(donationsChain.eq).toHaveBeenCalledWith("payer_id", "u42");
    expect(donationsChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("loadInvestorDonations TTL cache", () => {
  it("reuses cached rows for a repeated userId without re-querying", async () => {
    const rows = [donation("d1", 100, "paid", "p1", "2026-05-01")];
    const { client, from } = makeClient({ public_donations: { data: rows } });

    await loadInvestorDonations(client, "u1");
    expect(from).toHaveBeenCalledTimes(1);

    await loadInvestorDonations(client, "u1");
    expect(from).toHaveBeenCalledTimes(1); // served from cache
  });

  it("returns a fresh copy so callers can't poison the cache", async () => {
    const rows = [donation("d1", 100, "paid", "p1", "2026-05-01")];
    const { client } = makeClient({ public_donations: { data: rows } });

    const first = await loadInvestorDonations(client, "u1");
    first[0].amount = 999999;

    const second = await loadInvestorDonations(client, "u1");
    expect(second[0].amount).toBe(100);
  });

  it("bypasses the cache with force", async () => {
    const { client, from } = makeClient({ public_donations: { data: [] } });
    await loadInvestorDonations(client, "u1");
    await loadInvestorDonations(client, "u1", { force: true });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("keeps different userIds independent", async () => {
    const { client, from } = makeClient({ public_donations: { data: [] } });
    await loadInvestorDonations(client, "u1");
    await loadInvestorDonations(client, "u2");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("single-flights concurrent loads for the same userId (dashboard race)", async () => {
    const rows = [donation("d1", 100, "paid", "p1", "2026-05-01")];
    const { client, from } = makeClient({ public_donations: { data: rows } });

    // loadInvestorPortfolio and loadRecommendedProjects both call
    // loadInvestorDonations and run in a Promise.all on the dashboard. On a
    // cold load neither has a cache entry, so the in-flight dedup must collapse
    // them into one public_donations query.
    const [a, b] = await Promise.all([
      loadInvestorDonations(client, "u1"),
      loadInvestorDonations(client, "u1"),
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a[0].amount).toBe(100);
  });

  it("propagates query errors instead of caching them", async () => {
    const { client } = makeClient({
      public_donations: { data: null, error: new Error("boom") },
    });
    await expect(loadInvestorDonations(client, "u1")).rejects.toThrow("boom");
  });
});

describe("loadRecommendedProjects", () => {
  it("prefers the user's top categories, excludes funded projects, and ranks by growth+overlap", async () => {
    const { client, captured } = makeClient({
      public_donations: {
        data: [
          // Two settled AI donations → AI is the top preferred category.
          donation("d1", 500, "paid", "funded-a", "2026-05-01", {
            projects: project("funded-a", "Already Backed", { categories: ["AI"] }),
          }),
          donation("d2", 300, "paid", "funded-b", "2026-05-02", {
            projects: project("funded-b", "Also Backed", { categories: ["AI"] }),
          }),
        ],
      },
      projects: {
        data: [
          project("cand-a", "AI Startup", { categories: ["AI"], pledged: 90000, owner_id: "u1" }),
          project("cand-b", "AI Alternative", { categories: ["AI", "SaaS"], pledged: 70000, owner_id: "u2" }),
          project("funded-a", "Already Backed", { categories: ["AI"] }), // excluded
          project("cand-c", "Climate Co", { categories: ["Climate"], pledged: 80000, owner_id: "u2" }),
        ],
      },
      profiles: {
        data: [
          { id: "u1", full_name: "Alice Founder" },
          { id: "u2", full_name: "Bob Builder" },
        ],
      },
    });

    const { recommendations, creatorMap, preferredCategories } = await loadRecommendedProjects(
      client,
      "u1",
      { limit: 3 },
    );

    expect(preferredCategories).toEqual(["AI"]);
    // Funded project excluded.
    expect(recommendations.map((r) => r.project.id)).not.toContain("funded-a");
    // AI candidates outrank the climate one (overlap bonus).
    expect(recommendations[0].project.id).toBe("cand-a");
    expect(recommendations.length).toBe(3);

    // Reasons are present and include the category match + score.
    const aiRec = recommendations.find((r) => r.project.id === "cand-a");
    expect(aiRec.reasons).toContain("Matches your interest in AI");
    expect(aiRec.reasons.some((r) => r.startsWith("AI growth score"))).toBe(true);
    // A funded project sharing the category → similarity reason (newest one wins).
    expect(aiRec.reasons.some((r) => r.startsWith("Similar to"))).toBe(true);
    // score is the pure growth score (0-98), displayable as /100.
    expect(aiRec.score).toBeGreaterThanOrEqual(0);
    expect(aiRec.score).toBeLessThanOrEqual(98);

    expect(creatorMap).toEqual({ u1: "Alice Founder", u2: "Bob Builder" });

    const projectsChain = captured.find((c) => c.table === "projects").chain;
    expect(projectsChain.select).toHaveBeenCalledWith(RECOMMENDED_SELECT);
    expect(projectsChain.eq).toHaveBeenCalledWith("deleted", false);
    expect(projectsChain.overlaps).toHaveBeenCalledWith("categories", ["AI"]);
    expect(projectsChain.order).toHaveBeenCalledWith("pledged", { ascending: false });
    expect(projectsChain.limit).toHaveBeenCalledWith(6); // limit * 2
  });

  it("degrades to a trending query (no overlaps filter) when the user has no preferences", async () => {
    const { client, captured } = makeClient({
      public_donations: { data: [] },
      projects: { data: [project("cand-a", "Top Campaign", { pledged: 90000 })] },
      profiles: { data: [] },
    });

    const { recommendations, preferredCategories } = await loadRecommendedProjects(client, "u1");

    expect(preferredCategories).toEqual([]);
    const projectsChain = captured.find((c) => c.table === "projects").chain;
    expect(projectsChain.overlaps).not.toHaveBeenCalled();
    expect(projectsChain.eq).toHaveBeenCalledWith("deleted", false);
    expect(recommendations).toHaveLength(1);
  });

  it("skips the profiles lookup when no recommendation has an owner", async () => {
    const { client, from } = makeClient({
      public_donations: { data: [] },
      projects: { data: [project("cand-a", "No Owner")] },
    });
    const { creatorMap } = await loadRecommendedProjects(client, "u1");
    expect(creatorMap).toEqual({});
    expect(from).not.toHaveBeenCalledWith("profiles");
  });
});

describe("deriveAiInsights", () => {
  it("computes confidence, strongest sector, and next recommended category", () => {
    const stats = derivePortfolioStats([
      donation("d1", 500, "paid", "p1", "2026-05-01", {
        projects: project("p1", "AI Fund", { categories: ["AI"] }),
      }),
    ]);
    const insights = deriveAiInsights({
      stats,
      donations: stats ? [donation("d1", 500, "paid", "p1", "2026-05-01", {
        projects: project("p1", "AI Fund", { categories: ["AI"] }),
      })] : [],
      recommendations: [
        { project: project("cand-a", "AI Co", { categories: ["AI"] }), score: 80 },
      ],
    });

    expect(insights.strongestSector).toBe("AI");
    expect(insights.topCategories).toEqual([{ name: "AI", value: 500 }]);
    expect(insights.confidence).toBeGreaterThanOrEqual(10);
    expect(insights.confidence).toBeLessThanOrEqual(100);
    // AI is already funded → falls back to a recommendation category.
    expect(insights.nextRecommendedCategory).toBe("AI");
    expect(insights.topPick.project.id).toBe("cand-a");
  });

  it("returns safe nulls for a new investor", () => {
    const insights = deriveAiInsights({ stats: derivePortfolioStats([]), donations: [], recommendations: [] });
    expect(insights.strongestSector).toBeNull();
    expect(insights.nextRecommendedCategory).toBeNull();
    expect(insights.topPick).toBeNull();
    // No history → low confidence floor.
    expect(insights.confidence).toBe(20);
  });
});

describe("deriveAnalytics", () => {
  const sampleDonations = [
    donation("d1", 1000, "paid", "p1", "2025-01-10", { projects: project("p1", "Alpha", { categories: ["AI"], pledged: 60000 }) }),
    donation("d2", 2000, "paid", "p2", "2026-06-05", { projects: project("p2", "Beta", { categories: ["Climate"], pledged: 60000 }) }),
    donation("d3", 500, "pending", "p2", "2026-07-01", { projects: project("p2", "Beta", { categories: ["Climate"], pledged: 60000 }) }),
    donation("d4", 3000, "paid", "p3", "2026-07-10", { projects: project("p3", "Gamma", { categories: ["AI", "Health"], pledged: 60000 }) }),
  ];

  it("builds cumulative growth, monthly totals, and the dual-series trends", () => {
    const a = deriveAnalytics(sampleDonations, { range: "all", now: NOW_MS });

    expect(a.performance.totalInvested).toBe(6000); // settled only (d1,d2,d4)
    expect(a.performance.projectsFunded).toBe(3);
    expect(a.performance.averageDonation).toBe(2000);
    expect(a.performance.largestDonation).toBe(3000);

    // Cumulative invested over months: Jan 1000, Jun 3000, Jul 6000.
    expect(a.investmentGrowth[a.investmentGrowth.length - 1].invested).toBe(6000);
    expect(a.investmentGrowth.map((g) => g.month)).toEqual(
      expect.arrayContaining(["Jan 25", "Jun 26", "Jul 26"]),
    );
    // Historical trends align with the same series + per-month counts.
    expect(a.historicalTrends.length).toBe(3);
    expect(a.historicalTrends[0]).toMatchObject({ month: "Jan 25", invested: 1000, donations: 1 });
  });

  it("filters every widget by the global range", () => {
    const a30 = deriveAnalytics(sampleDonations, { range: "30d", now: NOW_MS });
    // Only d4 (2026-07-10) falls within 30 days of 2026-07-15.
    expect(a30.performance.totalInvested).toBe(3000);
    expect(a30.counts.completed).toBe(1);
    expect(a30.investmentGrowth).toEqual([{ month: "Jul 26", invested: 3000 }]);

    const a90 = deriveAnalytics(sampleDonations, { range: "90d", now: NOW_MS });
    // d2 (Jun 05), d3 (Jul 01), d4 (Jul 10) — pending excluded from invested.
    expect(a90.counts).toEqual({ completed: 2, pending: 1, failed: 0, refunded: 0 });
    expect(a90.performance.totalInvested).toBe(5000);
  });

  it("rolls up the by-project donut to top 6 + Others", () => {
    const many = [];
    for (let i = 1; i <= 8; i += 1) {
      many.push(donation(`d${i}`, 100 * i, "paid", `p${i}`, "2026-06-01", {
        projects: project(`p${i}`, `Project ${i}`, { categories: ["AI"] }),
      }));
    }
    const a = deriveAnalytics(many, { range: "all", now: NOW_MS });
    expect(a.portfolioAllocation.byProject).toHaveLength(7); // 6 + Others
    expect(a.portfolioAllocation.byProject[a.portfolioAllocation.byProject.length - 1].name).toBe("Others");
    expect(a.portfolioAllocation.byCategory).toEqual([{ name: "AI", value: 3600 }]);
  });

  it("attributes multi-category donations to each sector and sorts the funding timeline oldest-first", () => {
    const a = deriveAnalytics(sampleDonations, { range: "all", now: NOW_MS });

    // Gamma contributes 3000 to AI and 3000 to Health.
    const ai = a.sectorDistribution.find((s) => s.name === "AI");
    expect(ai.value).toBe(4000); // Alpha 1000 + Gamma 3000
    const health = a.sectorDistribution.find((s) => s.name === "Health");
    expect(health.value).toBe(3000);

    // Oldest → newest across every status.
    expect(a.fundingTimeline.map((t) => t.date)).toEqual([
      "2025-01-10",
      "2026-06-05",
      "2026-07-01",
      "2026-07-10",
    ]);
    expect(a.fundingTimeline[0].projectTitle).toBe("Alpha");
  });

  it("computes ROI as average funding progress and success rate from captured payments", () => {
    const a = deriveAnalytics(sampleDonations, { range: "all", now: NOW_MS });
    // Funded: Alpha (60%), Beta (60%), Gamma (60%) → avg 60%.
    expect(a.roi).toBe(60);
    // 4 captured (3 settled + 1 pending? pending is not terminal) → settled 3 + failed 0 + refunded 0 → 100%.
    expect(a.performance.successRate).toBe(100);
    // activeProjects: all three funded projects are not deleted.
    expect(a.performance.activeProjects).toBe(3);
  });

  it("returns an empty-safe bundle for a new investor", () => {
    const a = deriveAnalytics([], { range: "all", now: NOW_MS });
    expect(a.performance.totalInvested).toBe(0);
    expect(a.investmentGrowth).toEqual([]);
    expect(a.fundingTimeline).toEqual([]);
    expect(a.portfolioAllocation.byProject).toEqual([]);
    expect(a.roi).toBe(0);
  });
});

describe("loadInvestorAnalytics", () => {
  it("reuses the cached donations fetch (no second query) and applies the range", async () => {
    const rows = [
      donation("d1", 1000, "paid", "p1", "2026-06-10"),
      donation("d2", 500, "paid", "p2", "2026-07-10"),
    ];
    const { client, from } = makeClient({ public_donations: { data: rows } });

    await loadInvestorAnalytics(client, "u1", { range: "30d", now: NOW_MS });
    await loadInvestorAnalytics(client, "u1", { range: "all", now: NOW_MS });

    // Both calls share one donations query thanks to the TTL cache.
    expect(from).toHaveBeenCalledTimes(1);
  });
});

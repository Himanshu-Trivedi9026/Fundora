/**
 * lib/investor/investorData.js
 *
 * Dependency-injected loaders + pure derivations for the investor area
 * (Overview home page + Analytics). Mirrors the DI pattern of
 * lib/landing/landingData.js: every loader takes a supabase client so the
 * logic is unit-testable without a live database.
 *
 * Live schema facts (verified):
 *   - public_donations: id, amount, created_at, status, payer_id, project_id
 *   - projects: id, title, slug, thumbnail, goal, pledged, owner_id,
 *     categories text[], deleted
 *   - profiles: id, full_name
 *   - saved_projects: user_id, project_id
 *   - followers: follower_id, following_id
 *
 * Donation statuses (see memory: donation-status-paid): rows are inserted as
 * "paid" by the razorpay verify flow; the webhook transitions "paid" → "failed"
 * or → "refunded". Nothing ever writes "completed", so SETTLED_DONATION_STATUS
 * is "paid". totalInvested counts only settled rows (intentional divergence
 * from pages/investor/portfolio.js, which filters on the never-written value).
 */

import { computeGrowthScore } from "../ai/projectScore";
import { monthKey, monthLabel } from "./investorFormat";

/** Statuses that count as settled money held for the user. */
export const SETTLED_DONATION_STATUS = "paid";

/** Columns fetched for every donation row (project join carries the fields
 *  the derivations need: goal/pledged for ROI & health, categories for
 *  sector/allocation/recommendations, deleted for active-project counts). */
export const DONATION_SELECT = `
  id, amount, created_at, status, project_id,
  projects:project_id (id, title, slug, thumbnail, goal, pledged, categories, deleted)
`;

/** Columns fetched for recommended projects (matches the card's needs). */
export const RECOMMENDED_SELECT = `
  id, title, slug, thumbnail, goal, pledged, deadline, short, owner_id, categories, updated_at
`;

/** How long a donations fetch is reused across Overview ↔ Analytics nav. */
export const CACHE_TTL_MS = 60_000;

// Module-level TTL cache keyed by userId. Next.js keeps one JS context across
// client-side navigations, so this survives Overview → Analytics without a
// second Supabase query. Reset on full reload (module state is not persisted).
const donationCache = new Map(); // userId -> { at, data }
// Single-flight map: an in-flight public_donations fetch per userId. Overview
// loads donations through two paths at once (loadInvestorPortfolio AND
// loadRecommendedProjects run in a Promise.all on the dashboard); without this,
// both miss the cache on a cold load and fire a duplicate identical query.
const donationInflight = new Map(); // userId -> Promise<rows>

/** Clear the module-level donations cache (used by tests). */
export function clearInvestorCache() {
  donationCache.clear();
  donationInflight.clear();
}

/**
 * Load the user's donations (with project join) from public_donations.
 *
 * Rows arrive newest-first. Results are cached for CACHE_TTL_MS and a fresh
 * shallow copy is returned each call so page state mutations never poison the
 * cache. Pass { force: true } to bypass the cache.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {string} userId
 * @param {object} [opts] — { force } bypasses the cache.
 * @returns {Promise<object[]>} donation rows (or []).
 */
export async function loadInvestorDonations(
  client,
  userId,
  { force = false } = {},
) {
  const hit = !force && donationCache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data.map((d) => ({ ...d }));
  }

  // Reuse an already-running fetch for this user instead of firing a duplicate
  // query (cold-load race on the dashboard's Promise.all).
  const inflight = !force && donationInflight.get(userId);
  if (inflight) return inflight;

  const fetchRows = (async () => {
    const { data, error } = await client
      .from("public_donations")
      .select(DONATION_SELECT)
      .eq("payer_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    donationCache.set(userId, { at: Date.now(), data: rows });
    return rows.map((d) => ({ ...d }));
  })();

  donationInflight.set(userId, fetchRows);
  try {
    return await fetchRows;
  } finally {
    donationInflight.delete(userId);
  }
}

/** Count the user's saved projects. @returns {Promise<number>} */
export async function loadSavedCount(client, userId) {
  const { count, error } = await client
    .from("saved_projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count || 0;
}

/** Count the user's followers. @returns {Promise<number>} */
export async function loadFollowerCount(client, userId) {
  const { count, error } = await client
    .from("followers")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId);
  if (error) throw error;
  return count || 0;
}

/**
 * Pure aggregation of a donation list into portfolio stats. Settled rows
 * ("paid") drive invested totals; pending/failed/refunded are surfaced
 * separately. `fundedProjects` is one entry per settled project (the latest
 * donation's project snapshot) with per-project `invested` and `donationCount`,
 * ordered newest-funded-first.
 *
 * @param {object[]} donations
 * @returns {object} stats (see shape below).
 */
export function derivePortfolioStats(donations) {
  const rows = Array.isArray(donations) ? donations : [];

  let totalInvested = 0;
  let settledCount = 0;
  let pendingAmount = 0;
  let failedCount = 0;
  let refundedCount = 0;
  let largestDonation = 0;
  const activeMonthSet = new Set();
  let firstSettledAt = null;
  let lastSettledAt = null;
  const byProject = new Map(); // project_id -> funded project entry

  for (const d of rows) {
    const amount = Number(d.amount) || 0;
    const status = d.status;

    if (status === SETTLED_DONATION_STATUS) {
      totalInvested += amount;
      settledCount += 1;
      if (amount > largestDonation) largestDonation = amount;
      if (d.created_at) {
        activeMonthSet.add(monthKey(new Date(d.created_at)));
        if (
          !firstSettledAt ||
          new Date(d.created_at) < new Date(firstSettledAt)
        ) {
          firstSettledAt = d.created_at;
        }
        if (
          !lastSettledAt ||
          new Date(d.created_at) > new Date(lastSettledAt)
        ) {
          lastSettledAt = d.created_at;
        }
      }

      const project = d.projects || null;
      if (d.project_id && project) {
        const existing = byProject.get(d.project_id);
        if (existing) {
          existing.invested += amount;
          existing.donationCount += 1;
          if (
            !existing.lastDonatedAt ||
            new Date(d.created_at) > new Date(existing.lastDonatedAt)
          ) {
            existing.lastDonatedAt = d.created_at;
            existing.title = project.title || existing.title;
            existing.thumbnail = project.thumbnail ?? existing.thumbnail;
          }
        } else {
          byProject.set(d.project_id, {
            id: d.project_id,
            title: project.title || "Unknown Project",
            slug: project.slug,
            thumbnail: project.thumbnail,
            goal: Number(project.goal) || 0,
            pledged: Number(project.pledged) || 0,
            categories: Array.isArray(project.categories)
              ? project.categories
              : [],
            invested: amount,
            donationCount: 1,
            lastDonatedAt: d.created_at,
          });
        }
      }
    } else if (status === "pending") {
      pendingAmount += amount;
    } else if (status === "failed") {
      failedCount += 1;
    } else if (status === "refunded") {
      refundedCount += 1;
    }
  }

  const fundedProjects = [...byProject.values()].sort(
    (a, b) => new Date(b.lastDonatedAt) - new Date(a.lastDonatedAt),
  );
  const projectsFunded = fundedProjects.length;
  const averageDonation = settledCount > 0 ? totalInvested / settledCount : 0;
  const avgPerProject = projectsFunded > 0 ? totalInvested / projectsFunded : 0;

  return {
    totalInvested,
    projectsFunded,
    avgPerProject,
    averageDonation,
    largestDonation,
    pendingAmount,
    failedCount,
    refundedCount,
    completedCount: settledCount,
    fundedProjects,
    activeMonths: activeMonthSet.size,
    firstSettledAt,
    lastSettledAt,
  };
}

/**
 * Portfolio Health Score (0–100), a composite of four sub-scores:
 *   - diversification: inverse Herfindahl of invested share across projects
 *   - fundingProgress: average pledged/goal of funded projects
 *   - categorySpread: distinct funded categories (capped at 5 → 100)
 *   - consistency: months with activity ÷ months since first settled donation
 * Weights: 0.3 / 0.3 / 0.2 / 0.2.
 *
 * Pure — `now` is injectable for deterministic tests.
 *
 * @param {object} stats output of derivePortfolioStats
 * @param {object} [opts] — { now } timestamp for the consistency window.
 * @returns {{ score: number, breakdown: object }}
 */
export function computePortfolioHealth(stats, { now = Date.now() } = {}) {
  const fundedProjects = (stats && stats.fundedProjects) || [];
  const totalInvested = stats?.totalInvested || 0;

  let diversification = 0;
  if (fundedProjects.length > 0 && totalInvested > 0) {
    const hhi = fundedProjects.reduce((acc, p) => {
      const share = (p.invested || 0) / totalInvested;
      return acc + share * share;
    }, 0);
    // hhi ∈ [1/n, 1]; invert so evenly-spread portfolios score high.
    diversification = Math.max(0, Math.min(100, Math.round((1 - hhi) * 100)));
  }

  let fundingProgress = 0;
  const withGoals = fundedProjects.filter((p) => p.goal > 0);
  if (withGoals.length > 0) {
    const avg =
      withGoals.reduce(
        (acc, p) => acc + Math.min((p.pledged || 0) / p.goal, 1),
        0,
      ) / withGoals.length;
    fundingProgress = Math.round(avg * 100);
  }

  const distinctCategories = new Set(
    fundedProjects.flatMap((p) => p.categories || []),
  ).size;
  const categorySpread = Math.min(100, distinctCategories * 20);

  let consistency = 0;
  const activeMonths = stats?.activeMonths || 0;
  const firstAt = stats?.firstSettledAt;
  if (firstAt && activeMonths > 0) {
    const elapsedMs = Math.max(
      0,
      new Date(now).getTime() - new Date(firstAt).getTime(),
    );
    const monthsElapsed = Math.max(
      1,
      Math.round(elapsedMs / (1000 * 60 * 60 * 24 * 30.44)),
    );
    consistency = Math.min(
      100,
      Math.round((activeMonths / monthsElapsed) * 100),
    );
  }

  const score = Math.round(
    diversification * 0.3 +
      fundingProgress * 0.3 +
      categorySpread * 0.2 +
      consistency * 0.2,
  );

  return {
    score,
    breakdown: {
      diversification,
      fundingProgress,
      categorySpread,
      consistency,
    },
  };
}

/**
 * Pure portfolio-view metrics on top of derivePortfolioStats, for the
 * investor Portfolio page. All figures come from settled ("paid") donations
 * only — nothing from legacy tables.
 *
 *   - roi: average funding progress across funded projects (mean of
 *     pledged/goal, capped at 100%), matching the Analytics ROI definition.
 *   - currentValue: totalInvested scaled by portfolio growth — the invested
 *     principal plus the (conservative) growth implied by funding progress.
 *   - diversification: inverse Herfindahl of invested share across projects
 *     (0 = one project, 100 = perfectly spread), same formula as the health
 *     score's sub-metric.
 *   - categoryAllocation: invested amount grouped by project category,
 *     sorted desc, top 6 + "Others".
 *
 * @param {object} stats output of derivePortfolioStats
 * @returns {{ roi: number, currentValue: number, diversification: number, categoryAllocation: object[] }}
 */
export function derivePortfolioMetrics(stats) {
  const fundedProjects = (stats && stats.fundedProjects) || [];
  const totalInvested = stats?.totalInvested || 0;

  // ROI = average funding progress (capped so a 2×-funded project counts 100%).
  const withGoals = fundedProjects.filter((p) => p.goal > 0);
  const roi =
    withGoals.length > 0
      ? Math.round(
          (withGoals.reduce(
            (acc, p) => acc + Math.min((p.pledged || 0) / p.goal, 1),
            0,
          ) /
            withGoals.length) *
            100,
        )
      : 0;

  const currentValue = Math.round(totalInvested * (1 + roi / 100));

  let diversification = 0;
  if (fundedProjects.length > 0 && totalInvested > 0) {
    const hhi = fundedProjects.reduce((acc, p) => {
      const share = (p.invested || 0) / totalInvested;
      return acc + share * share;
    }, 0);
    diversification = Math.max(0, Math.min(100, Math.round((1 - hhi) * 100)));
  }

  const categoryAmounts = new Map();
  for (const p of fundedProjects) {
    for (const c of p.categories || []) {
      categoryAmounts.set(c, (categoryAmounts.get(c) || 0) + (p.invested || 0));
    }
  }
  const sorted = [...categoryAmounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 6).map(([name, value]) => ({ name, value }));
  const othersSum = sorted.slice(6).reduce((acc, [, v]) => acc + v, 0);
  const categoryAllocation =
    othersSum > 0 ? [...top, { name: "Others", value: othersSum }] : top;

  return { roi, currentValue, diversification, categoryAllocation };
}

/**
 * Load the Overview's portfolio bundle in parallel: donations (cached), saved
 * count, follower count.
 *
 * @returns {Promise<{ stats: object, savedProjects: number, followers: number, donations: object[] }>}
 */
export async function loadInvestorPortfolio(client, userId) {
  const [donations, savedProjects, followers] = await Promise.all([
    loadInvestorDonations(client, userId),
    loadSavedCount(client, userId),
    loadFollowerCount(client, userId),
  ]);
  return {
    stats: derivePortfolioStats(donations),
    savedProjects,
    followers,
    donations,
  };
}

/**
 * Premium deterministic "AI Recommendations" insights, computed purely from the
 * user's settled donations + the recommendation list (no LLM call). Provides
 * the confidence score, strongest sector, top categories, next recommended
 * category, and the top pick surfaced on the Overview card.
 *
 * @param {object} args — { stats, donations, recommendations }
 * @returns {object} see shape below.
 */
export function deriveAiInsights({ stats, donations, recommendations }) {
  const rows = Array.isArray(donations) ? donations : [];
  const recs = Array.isArray(recommendations) ? recommendations : [];

  // Sector → settled invested amount (multi-category projects attributed to
  // each of their categories — same convention as the analytics donut).
  const sectorAmounts = new Map();
  for (const d of rows) {
    if ((d.status || "") !== SETTLED_DONATION_STATUS) continue;
    const amount = Number(d.amount) || 0;
    for (const c of d.projects?.categories || []) {
      sectorAmounts.set(c, (sectorAmounts.get(c) || 0) + amount);
    }
  }
  const topCategories = [...sectorAmounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, value }));
  const strongestSector = topCategories[0]?.name || null;

  // Confidence rises with settled donation count, breadth, and how much the
  // recommendation scores discriminate. Low base so a brand-new investor (no
  // history → trending-only picks) reads as low confidence. Capped 10..100.
  const settledCount = stats?.completedCount || 0;
  const scores = recs.map((r) => r.score).filter((s) => typeof s === "number");
  const spread =
    scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
  const confidence = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        20 + settledCount * 5 + topCategories.length * 8 + Math.min(spread, 20),
      ),
    ),
  );

  // Next recommended category: a top-3 preferred category the user hasn't yet
  // funded; otherwise the most common category across the recommendations.
  const fundedCats = new Set(
    rows
      .filter((d) => (d.status || "") === SETTLED_DONATION_STATUS)
      .flatMap((d) => d.projects?.categories || []),
  );
  const nextRecommendedCategory =
    topCategories.map((c) => c.name).find((c) => !fundedCats.has(c)) ||
    mostCommonCategory(recs.map((r) => r.project)) ||
    null;

  return {
    confidence,
    strongestSector,
    topCategories,
    nextRecommendedCategory,
    topPick: recs[0] || null,
  };
}

/** Most frequently occurring category across a list of projects. */
function mostCommonCategory(projects) {
  const counts = new Map();
  for (const p of projects || []) {
    for (const c of p?.categories || []) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Load personalised project recommendations from live tables.
 *
 * Preferred categories = the user's top-3 settled-funded categories by amount.
 * When there are no preferences (new investor) this degrades to a trending
 * query (active campaigns by pledged desc) so the empty state still surfaces
 * discoverable projects. Candidates are filtered to exclude already-funded
 * projects, scored with computeGrowthScore + an overlap bonus, sliced to
 * `limit`, and each recommendation carries human-readable reasons.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {string} userId
 * @param {object} [opts] — { limit } number of recommendations (default 6).
 * @returns {Promise<{ recommendations: object[], creatorMap: object, preferredCategories: string[] }>}
 */
export async function loadRecommendedProjects(
  client,
  userId,
  { limit = 6 } = {},
) {
  const donations = await loadInvestorDonations(client, userId);
  const stats = derivePortfolioStats(donations);
  const fundedIds = new Set(stats.fundedProjects.map((p) => p.id));

  const prefAmounts = new Map();
  for (const d of donations) {
    if ((d.status || "") !== SETTLED_DONATION_STATUS) continue;
    for (const c of d.projects?.categories || []) {
      prefAmounts.set(c, (prefAmounts.get(c) || 0) + (Number(d.amount) || 0));
    }
  }
  const preferred = [...prefAmounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  let query = client
    .from("projects")
    .select(RECOMMENDED_SELECT)
    .eq("deleted", false);
  if (preferred.length > 0) {
    query = query.overlaps("categories", preferred);
  }
  const { data, error } = await query
    .order("pledged", { ascending: false })
    .limit(limit * 2);

  if (error) throw error;

  const candidates = (Array.isArray(data) ? data : []).filter(
    (p) => !fundedIds.has(p.id),
  );

  const scored = candidates.map((p) => {
    const cats = Array.isArray(p.categories) ? p.categories : [];
    const overlap = cats.filter((c) => preferred.includes(c)).length;
    const growthScore = computeGrowthScore({ ...p, category: cats[0] || null });
    return {
      project: p,
      growthScore,
      rankScore: growthScore + overlap * 5,
      overlap,
      cats,
    };
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);
  const top = scored.slice(0, limit);

  const recommendations = top.map(({ project, growthScore, overlap, cats }) => {
    const reasons = [];
    const match = cats.find((c) => preferred.includes(c));
    if (overlap > 0 && match) reasons.push(`Matches your interest in ${match}`);
    reasons.push(`AI growth score ${growthScore}/100`);
    const similar = stats.fundedProjects.find((fp) =>
      (fp.categories || []).some((c) => cats.includes(c)),
    );
    if (similar) reasons.push(`Similar to ${similar.title}`);
    return { project, score: growthScore, reasons };
  });

  const ownerIds = [
    ...new Set(recommendations.map((r) => r.project.owner_id).filter(Boolean)),
  ];
  let creatorMap = {};
  if (ownerIds.length > 0) {
    const { data: profiles, error: profError } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    if (profError) throw profError;
    (profiles || []).forEach((p) => {
      creatorMap[p.id] = p.full_name;
    });
  }

  return { recommendations, creatorMap, preferredCategories: preferred };
}

const RANGE_DAYS = { "30d": 30, "90d": 90, "1y": 365, all: null };

/**
 * Pure derivation of every Analytics widget from a donation list, under a
 * global time-range filter. `now` is injectable for deterministic tests.
 *
 * Ranges: "30d" | "90d" | "1y" | "all". Month buckets are keyed by "YYYY-MM"
 * (rendered as "Jul 26") so the cumulative series sorts chronologically.
 * Multi-category projects attribute their amount to each category in the
 * allocation/sector views (documented double-count).
 *
 * @param {object[]} donations
 * @param {object} [opts] — { range, now }.
 * @returns {object} the analytics bundle.
 */
export function deriveAnalytics(
  donations,
  { range = "all", now = Date.now() } = {},
) {
  const rows = Array.isArray(donations) ? donations : [];
  const cutoffDays = RANGE_DAYS[range];
  const cutoffMs = cutoffDays != null ? now - cutoffDays * 86400000 : null;
  const filtered =
    cutoffMs == null
      ? rows
      : rows.filter(
          (d) => d.created_at && new Date(d.created_at).getTime() >= cutoffMs,
        );

  const settled = filtered.filter(
    (d) => (d.status || "") === SETTLED_DONATION_STATUS,
  );
  const pending = filtered.filter((d) => (d.status || "") === "pending");
  const failed = filtered.filter((d) => (d.status || "") === "failed");
  const refunded = filtered.filter((d) => (d.status || "") === "refunded");

  // ---- Month-bucketed series (settled only) ----
  const byMonth = new Map(); // "YYYY-MM" -> { label, sum, count }
  for (const d of settled) {
    const date = new Date(d.created_at);
    const key = monthKey(date);
    const entry = byMonth.get(key) || {
      label: monthLabel(date),
      sum: 0,
      count: 0,
    };
    entry.sum += Number(d.amount) || 0;
    entry.count += 1;
    byMonth.set(key, entry);
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, e]) => e);

  let cumulative = 0;
  const investmentGrowth = months.map((m) => {
    cumulative += m.sum;
    return { month: m.label, invested: cumulative };
  });
  const monthlyInvestment = months.map((m) => ({
    month: m.label,
    amount: m.sum,
  }));
  const historicalTrends = months.map((m, i) => ({
    month: m.label,
    invested: investmentGrowth[i].invested,
    donations: m.count,
  }));

  // ---- Portfolio allocation (tabbed donut: by project / by category) ----
  const projectAmounts = new Map(); // project_id -> { title, sum }
  const categoryAmounts = new Map();
  for (const d of settled) {
    const amount = Number(d.amount) || 0;
    const p = d.projects;
    if (d.project_id) {
      const entry = projectAmounts.get(d.project_id) || {
        title: p?.title || "Unknown",
        sum: 0,
      };
      entry.sum += amount;
      projectAmounts.set(d.project_id, entry);
    }
    for (const c of p?.categories || []) {
      categoryAmounts.set(c, (categoryAmounts.get(c) || 0) + amount);
    }
  }

  const projectSorted = [...projectAmounts.values()].sort(
    (a, b) => b.sum - a.sum,
  );
  const topProjects = projectSorted.slice(0, 6);
  const othersSum = projectSorted.slice(6).reduce((acc, p) => acc + p.sum, 0);
  const byProject = topProjects.map((p) => ({ name: p.title, value: p.sum }));
  if (othersSum > 0) byProject.push({ name: "Others", value: othersSum });

  const byCategory = [...categoryAmounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // ---- Funding timeline (oldest → newest, every status) ----
  const fundingTimeline = [...filtered]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((d) => ({
      id: d.id,
      date: d.created_at,
      projectTitle: d.projects?.title || "Unknown Project",
      amount: Number(d.amount) || 0,
      status: d.status,
    }));

  // ---- Performance metrics ----
  const totalInvested = settled.reduce(
    (acc, d) => acc + (Number(d.amount) || 0),
    0,
  );
  const fundedIds = new Set(settled.map((d) => d.project_id).filter(Boolean));
  const projectsFunded = fundedIds.size;
  const avgPerProject = projectsFunded > 0 ? totalInvested / projectsFunded : 0;
  const averageDonation =
    settled.length > 0 ? totalInvested / settled.length : 0;
  const largestDonation = settled.reduce(
    (m, d) => Math.max(m, Number(d.amount) || 0),
    0,
  );

  // Success rate: captured payments (settled + refunded) that weren't failed.
  const terminal = settled.length + failed.length + refunded.length;
  const successRate =
    terminal > 0
      ? Math.round(((settled.length + refunded.length) / terminal) * 100)
      : 0;

  const activeProjects = new Set(
    settled
      .filter((d) => d.projects && d.projects.deleted === false)
      .map((d) => d.project_id),
  ).size;

  // ---- ROI: average funding progress of the user's funded projects ----
  const fundedInRange = new Map(); // project_id -> { goal, pledged }
  for (const d of settled) {
    const p = d.projects;
    if (!p || fundedInRange.has(d.project_id)) continue;
    fundedInRange.set(d.project_id, {
      goal: Number(p.goal) || 0,
      pledged: Number(p.pledged) || 0,
    });
  }
  const progressList = [...fundedInRange.values()].filter((x) => x.goal > 0);
  const roi =
    progressList.length > 0
      ? Math.round(
          (progressList.reduce(
            (acc, x) => acc + Math.min(x.pledged / x.goal, 1),
            0,
          ) /
            progressList.length) *
            100,
        )
      : 0;

  return {
    investmentGrowth,
    monthlyInvestment,
    portfolioAllocation: { byProject, byCategory },
    sectorDistribution: byCategory,
    fundingTimeline,
    historicalTrends,
    performance: {
      totalInvested,
      projectsFunded,
      avgPerProject,
      averageDonation,
      largestDonation,
      successRate,
      activeProjects,
    },
    roi,
    counts: {
      completed: settled.length,
      pending: pending.length,
      failed: failed.length,
      refunded: refunded.length,
    },
  };
}

/**
 * Load the Analytics bundle for a user. Reuses the cached donations fetch so
 * Overview → Analytics navigation performs no duplicate Supabase query.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {string} userId
 * @param {object} [opts] — { range, now }.
 * @returns {Promise<object>} deriveAnalytics output.
 */
export async function loadInvestorAnalytics(
  client,
  userId,
  { range = "all", now } = {},
) {
  const donations = await loadInvestorDonations(client, userId);
  return deriveAnalytics(donations, { range, now });
}

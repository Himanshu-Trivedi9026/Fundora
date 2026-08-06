/**
 * lib/landing/landingData.js
 *
 * Pure, dependency-injected loaders for the landing page's live (public) data.
 * Shared by the ISR page (getStaticProps) and the client components so the
 * server-rendered payload and the realtime-driven client refetch always agree.
 *
 * The landing page contains only public data (platform stats + trending
 * campaigns) — never authenticated or role-specific rows. These loaders read
 * through the public anon-key client and cache nothing themselves; ISR caches
 * the rendered HTML via `revalidate`.
 *
 * Mirrors the query-builder DI pattern of lib/explore/exploreQuery.js and
 * lib/landing/trendingQuery.js: every loader takes a supabase client so the
 * logic is unit-testable without a live database.
 */

import { buildTrendingQuery, TRENDING_LIMIT } from "./trendingQuery";

/** Safe zero-state for the stats panel (never fabricated numbers). */
export const EMPTY_STATS = {
  totalRaised: 0,
  totalProjects: 0,
  totalBackers: 0,
  totalTeamMembers: 0,
};

/**
 * Load the four platform statistics in parallel from a single pass over
 * public_donations (drives both Capital Raised and Total Backers) plus
 * head-counts of live projects and team members.
 *
 * Live schema facts (verified):
 *   - Capital Raised: SUM(public_donations.amount WHERE status = 'paid')
 *   - Projects Launched: COUNT(projects WHERE deleted = false)
 *   - Total Backers: COUNT(DISTINCT public_donations.payer_id)
 *   - Team Members: COUNT(team_members) — existing schema only
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @returns {Promise<object>} the four stats.
 */
export async function loadLandingStats(client) {
  // All three reads fire at once; the donations row set is fetched once and
  // derives both raised + backers (no duplicate query for either stat).
  const [donationsRes, projectsRes, teamRes] = await Promise.all([
    client.from("public_donations").select("amount, payer_id, status"),
    client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("deleted", false),
    client.from("team_members").select("*", { count: "exact", head: true }),
  ]);

  const donationRows = Array.isArray(donationsRes?.data) ? donationsRes.data : [];
  const totalRaised = donationRows.reduce(
    (sum, d) => (d.status === "paid" ? sum + (Number(d.amount) || 0) : sum),
    0,
  );
  const totalBackers = new Set(
    donationRows.map((d) => d.payer_id).filter(Boolean),
  ).size;

  return {
    totalRaised,
    totalProjects: projectsRes?.count || 0,
    totalBackers,
    totalTeamMembers: teamRes?.count || 0,
  };
}

/**
 * Load the trending campaigns plus the batch-fetched creator names they render.
 *
 * Delegates ranking/filtering to buildTrendingQuery (active campaigns only,
 * pledged desc then updated_at desc, bounded), then resolves owner names from
 * public.profiles in one `.in()` lookup — no N+1.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {object} [opts] — { limit } forwarded to buildTrendingQuery.
 * @returns {Promise<{ projects: object[], creatorMap: Record<string,string> }>}
 */
export async function loadTrendingProjects(client, opts = {}) {
  const { data } = await buildTrendingQuery(client, {
    limit: opts.limit ?? TRENDING_LIMIT,
  });

  const projects = Array.isArray(data) ? data : [];
  const ownerIds = [
    ...new Set(projects.map((p) => p.owner_id).filter(Boolean)),
  ];

  let creatorMap = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    creatorMap = {};
    (profiles || []).forEach((p) => {
      creatorMap[p.id] = p.full_name;
    });
  }

  return { projects, creatorMap };
}

/**
 * Compose the landing page's initial data for getStaticProps.
 *
 * Fetches stats + trending in parallel, each guarded so a transient DB failure
 * (or an unreachable DB at build time) never fails the render — the page falls
 * back to zeros / an empty state and the client realtime subscription fills in
 * real rows on first load.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @returns {Promise<{ initialStats: object, initialTrending: { projects: object[], creatorMap: Record<string,string> } }>}
 */
export async function loadLandingPageData(client) {
  const [initialStats, initialTrending] = await Promise.all([
    loadLandingStats(client).catch(() => ({ ...EMPTY_STATS })),
    loadTrendingProjects(client).catch(() => ({ projects: [], creatorMap: {} })),
  ]);
  return { initialStats, initialTrending };
}

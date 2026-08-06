/**
 * lib/landing/trendingQuery.js
 *
 * Pure query-builder for the landing page's "Trending Campaigns" section.
 *
 * Mirrors the /explore query-builder pattern (lib/explore/exploreQuery.js):
 * dependency-injected so the ranking/filter logic is unit-testable without a
 * live database, and it selects only the columns the cards actually render.
 *
 * Live schema facts this encodes (verified against the live DB):
 *   - `projects.categories` is a text[] of category *labels*. There is NO
 *     `category` column — the trending card must read `categories`.
 *   - `projects.updated_at` is bumped on donation, so it is the real
 *     "recently updated" signal used to break pledged-amount ties.
 *   - "Active campaigns only" matches the rest of the app (see
 *     buildExploreQuery): rows with `deleted = false`.
 */

/** Columns the trending cards render. `description` is the fallback when
 *  `short` is empty. Never select `*` here — media/team/owner payloads are
 *  heavy. */
export const TRENDING_SELECT =
  "id, title, short, description, goal, pledged, deadline, owner_id, categories, thumbnail, updated_at";

/** Default number of trending campaigns to fetch. */
export const TRENDING_LIMIT = 3;

/**
 * Build a supabase query for the top trending campaigns.
 *
 * Ranking (per product spec):
 *   1. Highest pledged amount  -> `pledged` descending
 *   2. Recently updated        -> `updated_at` descending (donations bump it)
 *   3. Active campaigns only   -> `deleted = false`
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {object} [opts]
 * @param {number} [opts.limit] max rows (default TRENDING_LIMIT).
 * @returns {object} chained supabase query (await-able).
 */
export function buildTrendingQuery(client, { limit = TRENDING_LIMIT } = {}) {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || TRENDING_LIMIT));

  return client
    .from("projects")
    .select(TRENDING_SELECT)
    .eq("deleted", false)
    .order("pledged", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(safeLimit);
}

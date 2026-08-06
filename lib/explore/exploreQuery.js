/**
 * lib/explore/exploreQuery.js
 *
 * Pure query-builder for campaign discovery (the /explore page).
 *
 * Kept as a standalone, dependency-injected module so the filter, sort, and
 * pagination logic is unit-testable without a live database.
 *
 * Live schema facts this encodes (verified against the live DB):
 *   - `projects.categories` is a text[] of category *labels* (e.g.
 *     "Artificial Intelligence"). There is NO `category` column — the old
 *     filter that referenced `category.in.(...)` made PostgREST return 400
 *     and broke category filtering entirely.
 *   - `projects.updated_at` is bumped on donation, so it is a real
 *     "recently active" signal for the Trending sort.
 *   - Only the columns ExploreCard actually renders are selected.
 */

export const EXPLORE_PAGE_SIZE = 10;

/** Columns ExploreCard renders. `description` is the fallback when `short`
 *  is empty. Never select `*` here — media/team/owner payloads are heavy. */
export const EXPLORE_SELECT =
  "id, title, short, description, goal, pledged, deadline, owner_id, categories, thumbnail, created_at";

/** sort value → PostgREST ordering. */
export const SORT_DEFINITIONS = {
  newest: { column: "created_at", ascending: false }, // Newest first
  oldest: { column: "created_at", ascending: true }, // Oldest first
  trending: { column: "updated_at", ascending: false }, // Recently active (donations bump updated_at)
  funded: { column: "pledged", ascending: false }, // Most Funded = most money raised
  ending: { column: "deadline", ascending: true }, // Ending Soon = nearest deadline
};

/** User-facing sort options in display order. */
export const EXPLORE_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "trending", label: "Trending" },
  { value: "funded", label: "Most Funded" },
  { value: "ending", label: "Ending Soon" },
];

export const DEFAULT_EXPLORE_FILTERS = {
  categories: [],
  minGoal: "",
  maxGoal: "",
  sort: "newest",
  stage: "",
};

/**
 * Build a supabase query for one page of discoverable campaigns.
 *
 * @param {object} client — a supabase-js client (injected for testability).
 * @param {object} opts
 * @param {string[]} [opts.categories] selected category labels.
 * @param {number|string} [opts.minGoal]  exclusive funding floor.
 * @param {number|string} [opts.maxGoal]  exclusive funding ceiling.
 * @param {string} [opts.sort] one of SORT_DEFINITIONS keys.
 * @param {number} [opts.page] 1-based page number.
 * @param {number} [opts.pageSize] rows per page (default 10).
 * @returns {object} chained supabase query (await-able). Also exposes
 *   `page`/`pageSize` for consumers that need range math.
 */
export function buildExploreQuery(
  client,
  {
    categories = [],
    minGoal = "",
    maxGoal = "",
    sort = "newest",
    page = 1,
    pageSize = EXPLORE_PAGE_SIZE,
  } = {},
) {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));

  let q = client
    .from("projects")
    .select(EXPLORE_SELECT, { count: "exact" })
    .eq("deleted", false);

  const sortDef = SORT_DEFINITIONS[sort] || SORT_DEFINITIONS.newest;
  q = q.order(sortDef.column, { ascending: sortDef.ascending });

  if (Array.isArray(categories) && categories.length > 0) {
    // Array-overlap. .overlaps() quotes each value, so labels with spaces and
    // "&" (e.g. "Technology & Web3") are handled correctly. Do NOT append a
    // `category.in.(...)` clause — the column does not exist and returns 400.
    q = q.overlaps("categories", categories);
  }

  if (minGoal !== "" && minGoal != null) q = q.gte("goal", Number(minGoal));
  if (maxGoal !== "" && maxGoal != null) q = q.lte("goal", Number(maxGoal));

  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  q.page = safePage;
  q.pageSize = pageSize;
  return q;
}

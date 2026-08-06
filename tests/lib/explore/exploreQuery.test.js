/**
 * exploreQuery tests — filter, sort, and pagination query construction.
 * buildExploreQuery is dependency-injected, so a plain mock client verifies
 * the exact PostgREST chain without a database.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildExploreQuery,
  EXPLORE_PAGE_SIZE,
  EXPLORE_SELECT,
  EXPLORE_SORT_OPTIONS,
  SORT_DEFINITIONS,
  DEFAULT_EXPLORE_FILTERS,
} from "../../../lib/explore/exploreQuery";

/** Build a mock supabase client + a log of chain calls. */
function createClient() {
  const calls = [];
  const chain = {
    select: vi.fn(function (...args) {
      calls.push(["select", args]);
      return this;
    }),
    eq: vi.fn(function (...args) {
      calls.push(["eq", args]);
      return this;
    }),
    order: vi.fn(function (...args) {
      calls.push(["order", args]);
      return this;
    }),
    overlaps: vi.fn(function (...args) {
      calls.push(["overlaps", args]);
      return this;
    }),
    gte: vi.fn(function (...args) {
      calls.push(["gte", args]);
      return this;
    }),
    lte: vi.fn(function (...args) {
      calls.push(["lte", args]);
      return this;
    }),
    range: vi.fn(function (...args) {
      calls.push(["range", args]);
      return this;
    }),
  };
  const client = {
    from: vi.fn(() => chain),
  };
  return { client, chain, calls };
}

describe("buildExploreQuery", () => {
  it("selects only the columns ExploreCard renders, with exact count", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client);

    expect(client.from).toHaveBeenCalledWith("projects");
    expect(calls[0]).toEqual(["select", [EXPLORE_SELECT, { count: "exact" }]]);
    // Never select("*") — would pull media/team/description payloads.
    expect(EXPLORE_SELECT).not.toBe("*");
  });

  it("excludes soft-deleted projects", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client);
    expect(calls).toContainEqual(["eq", ["deleted", false]]);
  });

  it("defaults to newest (created_at desc)", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client);
    expect(calls).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
  });

  it("maps every sort option to the correct column + direction", () => {
    const expectations = {
      newest: ["created_at", { ascending: false }],
      oldest: ["created_at", { ascending: true }],
      trending: ["updated_at", { ascending: false }],
      funded: ["pledged", { ascending: false }],
      ending: ["deadline", { ascending: true }],
    };
    // EXPLORE_SORT_OPTIONS and SORT_DEFINITIONS must stay in lockstep.
    expect(EXPLORE_SORT_OPTIONS.map((o) => o.value).sort()).toEqual(
      Object.keys(expectations).sort(),
    );

    for (const [sort, expected] of Object.entries(expectations)) {
      const { client, calls } = createClient();
      buildExploreQuery(client, { sort });
      expect(calls).toContainEqual(["order", expected]);
    }
  });

  it("falls back to newest on an unknown sort", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { sort: "bogus" });
    expect(calls).toContainEqual([
      "order",
      ["created_at", { ascending: false }],
    ]);
  });

  it("applies category filter via overlaps (no category column)", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, {
      categories: ["Artificial Intelligence", "Technology & Web3"],
    });

    // Must NOT reference a `category` column (it does not exist live → 400).
    expect(calls.some(([m, [col]]) => m === "eq" && col === "category")).toBe(
      false,
    );
    expect(calls).toContainEqual([
      "overlaps",
      ["categories", ["Artificial Intelligence", "Technology & Web3"]],
    ]);
  });

  it("skips the category clause when no categories are selected", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { categories: [] });
    expect(calls.some(([m]) => m === "overlaps")).toBe(false);
  });

  it("applies goal min/max ranges", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { minGoal: 1000, maxGoal: 500000 });
    expect(calls).toContainEqual(["gte", ["goal", 1000]]);
    expect(calls).toContainEqual(["lte", ["goal", 500000]]);
  });

  it("skips empty goal bounds", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { minGoal: "", maxGoal: null });
    expect(calls.some(([m]) => m === "gte" || m === "lte")).toBe(false);
  });

  it("paginates page 1 → range(0, 9)", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { page: 1, pageSize: 10 });
    expect(calls).toContainEqual(["range", [0, 9]]);
  });

  it("paginates page 3 → range(20, 29)", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { page: 3, pageSize: 10 });
    expect(calls).toContainEqual(["range", [20, 29]]);
  });

  it("clamps pages below 1 to page 1", () => {
    const { client, calls } = createClient();
    buildExploreQuery(client, { page: 0 });
    expect(calls).toContainEqual(["range", [0, 9]]);
  });

  it("exposes the resolved page/pageSize", () => {
    const { client } = createClient();
    const q = buildExploreQuery(client, { page: 2, pageSize: 10 });
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(10);
  });

  it("uses EXPLORE_PAGE_SIZE = 10", () => {
    expect(EXPLORE_PAGE_SIZE).toBe(10);
  });

  it("has sane defaults for empty filters", () => {
    expect(DEFAULT_EXPLORE_FILTERS.sort).toBe("newest");
    expect(DEFAULT_EXPLORE_FILTERS.categories).toEqual([]);
  });

  it("orders every sort definition through SORT_DEFINITIONS", () => {
    expect(Object.keys(SORT_DEFINITIONS)).toHaveLength(5);
    for (const def of Object.values(SORT_DEFINITIONS)) {
      expect(typeof def.column).toBe("string");
      expect(typeof def.ascending).toBe("boolean");
    }
  });
});

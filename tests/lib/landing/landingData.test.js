import { describe, it, expect, vi } from "vitest";
import {
  loadLandingStats,
  loadTrendingProjects,
  loadLandingPageData,
  EMPTY_STATS,
} from "../../../lib/landing/landingData";

/**
 * Build a fake supabase-js client whose `from(table)` returns an await-able
 * query chain resolving to the given payload. Each table's result is looked up
 * from `tables`, mirroring how supabase-js `.then()` resolves a query.
 *
 * @param {object} [tables] map of table -> { data, count?, error? }
 * @returns {{ client: object, from: Mock, captured: Array<{table, chain}> }}
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
      in: vi.fn().mockReturnThis(),
      then: (resolve) => resolve(result),
    };
    captured.push({ table, chain });
    return chain;
  });
  return { client: { from }, from, captured };
}

describe("loadLandingStats", () => {
  it("fires all three stat reads in parallel (no sequential awaits)", () => {
    const { client, from } = makeClient({
      public_donations: { data: [] },
      projects: { data: null, count: 2 },
      team_members: { data: null, count: 4 },
    });

    // Invoking the loader initiates every query before any promise resolves —
    // Promise.all launches the three reads together.
    const promise = loadLandingStats(client);

    expect(from).toHaveBeenCalledWith("public_donations");
    expect(from).toHaveBeenCalledWith("projects");
    expect(from).toHaveBeenCalledWith("team_members");

    return promise.then((stats) => {
      expect(stats.totalProjects).toBe(2);
      expect(stats.totalTeamMembers).toBe(4);
    });
  });

  it("sums only paid donations for Capital Raised and dedupes payer ids", async () => {
    const { client } = makeClient({
      public_donations: {
        data: [
          { amount: 100000, payer_id: "p1", status: "paid" },
          { amount: 40000, payer_id: "p1", status: "pending" }, // excluded
          { amount: 20000, payer_id: "p2", status: "paid" },
          { amount: 1000, payer_id: "p2", status: "paid" },
        ],
      },
      projects: { data: null, count: 3 },
      team_members: { data: null, count: 5 },
    });

    const stats = await loadLandingStats(client);

    expect(stats).toEqual({
      totalRaised: 121000,
      totalProjects: 3,
      totalBackers: 2, // p1, p2 — deduped across four rows
      totalTeamMembers: 5,
    });
  });

  it("treats a missing donations payload as zero (never fabricates)", async () => {
    const { client } = makeClient({
      public_donations: { data: null, error: new Error("nope") },
      projects: { data: null, count: 0 },
      team_members: { data: null, count: 0 },
    });

    const stats = await loadLandingStats(client);
    expect(stats).toEqual(EMPTY_STATS);
  });
});

describe("loadTrendingProjects", () => {
  it("returns projects plus a creator map from one deduped in() batch", async () => {
    const { client, captured } = makeClient({
      projects: {
        data: [
          { id: "p1", title: "One", owner_id: "u1" },
          { id: "p2", title: "Two", owner_id: "u1" },
          { id: "p3", title: "Three", owner_id: "u2" },
        ],
      },
      profiles: {
        data: [
          { id: "u1", full_name: "Alice Founder" },
          { id: "u2", full_name: "Bob Builder" },
        ],
      },
    });

    const { projects, creatorMap } = await loadTrendingProjects(client);

    expect(projects).toHaveLength(3);
    expect(creatorMap).toEqual({ u1: "Alice Founder", u2: "Bob Builder" });

    // Duplicate owner u1 is collapsed into a single profiles lookup.
    const profilesChain = captured.find((c) => c.table === "profiles").chain;
    expect(profilesChain.in).toHaveBeenCalledWith("id", ["u1", "u2"]);
    expect(profilesChain.select).toHaveBeenCalledWith("id, full_name");
  });

  it("skips the profiles lookup entirely when no project has an owner", async () => {
    const { client, from } = makeClient({
      projects: { data: [{ id: "p1", title: "No Owner" }] },
    });

    const { projects, creatorMap } = await loadTrendingProjects(client);
    expect(projects).toHaveLength(1);
    expect(creatorMap).toEqual({});
    expect(from).not.toHaveBeenCalledWith("profiles");
  });

  it("forwards a custom limit to the trending query", async () => {
    const { client, captured } = makeClient({
      projects: { data: [] },
      profiles: { data: [] },
    });

    await loadTrendingProjects(client, { limit: 5 });

    const projectsChain = captured.find((c) => c.table === "projects").chain;
    expect(projectsChain.limit).toHaveBeenCalledWith(5);
  });
});

describe("loadLandingPageData", () => {
  it("fetches stats and trending in parallel", () => {
    const { client, from } = makeClient({
      public_donations: { data: [] },
      projects: { data: null, count: 1 },
      team_members: { data: null, count: 1 },
      profiles: { data: [] },
    });

    const promise = loadLandingPageData(client);

    // Both loaders start immediately: all stat tables plus the trending
    // projects table are queried before any result resolves.
    expect(from).toHaveBeenCalledWith("public_donations");
    expect(from).toHaveBeenCalledWith("projects");
    expect(from).toHaveBeenCalledWith("team_members");

    return promise.then(({ initialStats, initialTrending }) => {
      expect(initialStats.totalProjects).toBe(1);
      expect(initialTrending).toEqual({ projects: [], creatorMap: {} });
    });
  });

  it("falls back to empty values when a loader throws (never fails the page)", async () => {
    const failingClient = {
      from: vi.fn(() => {
        throw new Error("database unreachable");
      }),
    };

    const { initialStats, initialTrending } =
      await loadLandingPageData(failingClient);

    expect(initialStats).toEqual(EMPTY_STATS);
    expect(initialTrending).toEqual({ projects: [], creatorMap: {} });
  });
});

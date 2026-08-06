import { describe, it, expect, vi } from "vitest";
import {
  buildTrendingQuery,
  TRENDING_LIMIT,
  TRENDING_SELECT,
} from "../../../lib/landing/trendingQuery";

/** A minimal supabase-js client whose query builder records every call. */
function makeClient() {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);

  const client = {
    from: vi.fn(() => chain),
  };
  return { client, chain };
}

describe("buildTrendingQuery", () => {
  it("builds the ranking chain: active, pledged desc, updated_at desc, limit", () => {
    const { client, chain } = makeClient();

    buildTrendingQuery(client);

    expect(client.from).toHaveBeenCalledWith("projects");
    expect(chain.select).toHaveBeenCalledWith(TRENDING_SELECT);
    // Active campaigns only
    expect(chain.eq).toHaveBeenCalledWith("deleted", false);
    // 1. Highest pledged amount
    expect(chain.order).toHaveBeenNthCalledWith(1, "pledged", {
      ascending: false,
    });
    // 2. Recently updated (donations bump updated_at)
    expect(chain.order).toHaveBeenNthCalledWith(2, "updated_at", {
      ascending: false,
    });
    // 3. Bounded result set
    expect(chain.limit).toHaveBeenCalledWith(TRENDING_LIMIT);
  });

  it("respects a custom limit", () => {
    const { client, chain } = makeClient();

    buildTrendingQuery(client, { limit: 5 });

    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("clamps invalid limits to a safe value", () => {
    // 0 is falsy so it falls back to the default
    expect(
      buildTrendingQuery(makeClient().client, { limit: 0 }).limit,
    ).toHaveBeenCalledWith(TRENDING_LIMIT);
    // negative -> clamped up to 1
    expect(
      buildTrendingQuery(makeClient().client, { limit: -5 }).limit,
    ).toHaveBeenCalledWith(1);
    // NaN -> default
    expect(
      buildTrendingQuery(makeClient().client, { limit: "abc" }).limit,
    ).toHaveBeenCalledWith(TRENDING_LIMIT);
    // fractional -> floored
    expect(
      buildTrendingQuery(makeClient().client, { limit: 2.7 }).limit,
    ).toHaveBeenCalledWith(2);
  });
});

describe("TRENDING_SELECT", () => {
  it("selects every column the cards render, without the heavy media/team payloads", () => {
    for (const col of [
      "id",
      "title",
      "short",
      "description",
      "goal",
      "pledged",
      "deadline",
      "owner_id",
      "categories",
      "thumbnail",
      "updated_at",
    ]) {
      expect(TRENDING_SELECT).toContain(col);
    }
    // The category comes from the text[] `categories` column, not a `category` scalar.
    expect(TRENDING_SELECT).not.toContain("category,");
  });
});

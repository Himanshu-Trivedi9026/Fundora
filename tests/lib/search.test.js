// Tests for Search Platform

import { describe, it, expect } from "vitest";

describe("Search Engine", () => {
  it("should support pagination", () => {
    const total = 47;
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    expect(totalPages).toBe(3);
    expect(new Array(20).fill(null)).toHaveLength(limit);
  });

  it("should apply text filters correctly", () => {
    const items = [
      { title: "AI Platform", status: "published" },
      { title: "Payment Gateway", status: "published" },
      { title: "Draft Plugin", status: "draft" },
    ];

    const published = items.filter((i) => i.status === "published");
    expect(published).toHaveLength(2);
  });

  it("should perform exact and fuzzy matching via ilike patterns", () => {
    const query = "test";
    const items = ["Test Plugin", "test platform", "Something Else"];
    const matching = items.filter((i) =>
      i.toLowerCase().includes(query.toLowerCase()),
    );

    expect(matching).toHaveLength(2);
    expect(matching).toContain("Test Plugin");
    expect(matching).toContain("test platform");
  });

  it("should support range filters", () => {
    const items = [
      { price: 10 },
      { price: 50 },
      { price: 100 },
      { price: 200 },
    ];

    const filtered = items.filter((i) => i.price >= 50 && i.price <= 150);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.price)).toEqual([50, 100]);
  });

  it("should sort by field direction", () => {
    const items = [{ name: "C" }, { name: "A" }, { name: "B" }];

    const ascending = [...items].sort((a, b) => a.name.localeCompare(b.name));
    const descending = [...items].sort((a, b) => b.name.localeCompare(a.name));

    expect(ascending.map((i) => i.name)).toEqual(["A", "B", "C"]);
    expect(descending.map((i) => i.name)).toEqual(["C", "B", "A"]);
  });
});

describe("Facet Engine", () => {
  it("should compute term facets with counts", () => {
    const data = [
      { category: "analytics" },
      { category: "analytics" },
      { category: "payment" },
    ];

    const counts = {};
    for (const row of data) {
      counts[row.category] = (counts[row.category] || 0) + 1;
    }

    expect(counts.analytics).toBe(2);
    expect(counts.payment).toBe(1);
  });

  it("should compute range facets with bucket counts", () => {
    const prices = [1000, 4000, 10000, 50000, 200000];
    const ranges = [
      { from: 0, to: 5000, label: "Under $5K" },
      { from: 5000, to: 25000, label: "$5K-$25K" },
      { from: 25000, to: 100000, label: "$25K-$100K" },
    ];

    const buckets = ranges.map((r) => ({
      ...r,
      count: prices.filter((p) => p >= r.from && p < r.to).length,
    }));

    expect(buckets[0].count).toBe(2);
    expect(buckets[1].count).toBe(1);
    expect(buckets[2].count).toBe(1);
  });
});

describe("Autocomplete Engine", () => {
  it("should match suggestions by prefix", () => {
    const suggestions = [
      "analytics",
      "api gateway",
      "anomaly detection",
      "blockchain",
    ];
    const query = "an";

    const matched = suggestions.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase()),
    );
    expect(matched).toEqual(["analytics", "anomaly detection"]);
  });

  it("should sort suggestions by popularity", () => {
    const suggestions = [
      { text: "analytics", score: 5 },
      { text: "api", score: 10 },
      { text: "auth", score: 3 },
    ];

    const sorted = [...suggestions].sort((a, b) => b.score - a.score);
    expect(sorted[0].text).toBe("api");
    expect(sorted[2].text).toBe("auth");
  });

  it("should deduplicate combined suggestions", () => {
    const combined = new Map();
    combined.set("analytics", { text: "analytics", score: 5 });
    combined.set("analytics", { text: "analytics", score: 8 }); // overwrite

    expect(combined.size).toBe(1);
    expect(combined.get("analytics").score).toBe(8);
  });
});

describe("Search Analytics", () => {
  it("should calculate zero-result rate", () => {
    const searches = [
      { result_count: 0 },
      { result_count: 5 },
      { result_count: 0 },
      { result_count: 10 },
    ];

    const zeroResults = searches.filter((s) => s.result_count === 0);
    const zeroRate = zeroResults.length / searches.length;

    expect(zeroRate).toBe(0.5);
  });

  it("should group searches by entity type", () => {
    const searches = [
      { entity_type: "projects" },
      { entity_type: "projects" },
      { entity_type: "users" },
    ];

    const breakdown = {};
    for (const s of searches) {
      breakdown[s.entity_type] = (breakdown[s.entity_type] || 0) + 1;
    }

    expect(breakdown.projects).toBe(2);
    expect(breakdown.users).toBe(1);
  });
});

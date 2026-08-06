// Autocomplete Engine — search suggestion and autocomplete
// Provides query suggestions and type-ahead completions

import { supabaseAdmin } from "../supabaseAdmin.js";

export const SUGGESTION_SOURCES = {
  popular: { weight: 1.0, ttl: 3600000 }, // 1 hour
  recent: { weight: 0.7, ttl: 1800000 }, // 30 min
  trending: { weight: 1.5, ttl: 600000 }, // 10 min
};

const _cache = { popular: null, recent: null, trending: null, lastFetched: {} };

function isCacheValid(source) {
  const entry = _cache[source];
  if (!entry) return false;
  const ttl = SUGGESTION_SOURCES[source]?.ttl || 3600000;
  return (
    _cache.lastFetched[source] && Date.now() - _cache.lastFetched[source] < ttl
  );
}

export async function getSuggestions(query, options = {}) {
  try {
    const maxResults = Math.min(options.limit || 10, 25);
    const q = query.trim().toLowerCase();
    if (!q) return { success: true, data: { suggestions: [], query } };

    // Refresh cache if needed
    for (const source of Object.keys(SUGGESTION_SOURCES)) {
      if (!isCacheValid(source)) {
        await refreshSuggestionCache(source);
      }
    }

    const combined = new Map();

    for (const [source, config] of Object.entries(SUGGESTION_SOURCES)) {
      const entries = _cache[source] || [];
      for (const entry of entries) {
        if (entry.text.toLowerCase().includes(q)) {
          const existing = combined.get(entry.text);
          if (existing) {
            existing.score += config.weight;
          } else {
            combined.set(entry.text, {
              text: entry.text,
              type: entry.type || "query",
              score: config.weight * entry.popularity,
              category: entry.category || null,
            });
          }
        }
      }
    }

    const suggestions = Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return { success: true, data: { suggestions, query } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function refreshSuggestionCache(source) {
  try {
    let data = [];

    switch (source) {
      case "popular":
        ({ data } = await supabaseAdmin
          .from("search_analytics")
          .select("search_query, result_count")
          .order("result_count", { ascending: false })
          .limit(100));
        _cache.popular = (data || []).map((r) => ({
          text: r.search_query,
          type: "query",
          popularity: r.result_count || 1,
        }));
        break;

      case "recent":
        ({ data } = await supabaseAdmin
          .from("search_analytics")
          .select("search_query")
          .order("searched_at", { ascending: false })
          .limit(50));
        _cache.recent = (data || []).map((r) => ({
          text: r.search_query,
          type: "query",
          popularity: 1,
        }));
        break;

      case "trending":
        const since = new Date(Date.now() - 3600000).toISOString();
        ({ data } = await supabaseAdmin
          .from("search_analytics")
          .select("search_query, result_count")
          .gte("searched_at", since)
          .limit(50));

        const freq = {};
        for (const r of data || []) {
          freq[r.search_query] = (freq[r.search_query] || 0) + 1;
        }
        _cache.trending = Object.entries(freq)
          .map(([text, count]) => ({ text, type: "query", popularity: count }))
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 50);
        break;
    }

    _cache.lastFetched[source] = Date.now();
  } catch (err) {
    // Cache refresh failures are non-critical
  }
}

export async function clearSuggestionCache() {
  for (const key of Object.keys(_cache)) {
    _cache[key] = null;
    _cache.lastFetched[key] = 0;
  }
  return { success: true };
}

export async function getTrendingSearches(options = {}) {
  try {
    const since =
      options.since || new Date(Date.now() - 86400000).toISOString();
    const limit = Math.min(options.limit || 20, 50);

    const { data, error } = await supabaseAdmin
      .from("search_analytics")
      .select("search_query, result_count, searched_at")
      .gte("searched_at", since)
      .order("searched_at", { ascending: false })
      .limit(1000);

    if (error) return { success: false, error: error.message };

    // Aggregate and count
    const freq = {};
    for (const row of data || []) {
      const q = row.search_query?.trim().toLowerCase();
      if (q) freq[q] = (freq[q] || 0) + 1;
    }

    const trending = Object.entries(freq)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return { success: true, data: trending };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

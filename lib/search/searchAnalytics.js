// Search Analytics — search query insights and reporting
// Tracks zero-result queries, popular searches, and performance

import { supabaseAdmin } from "../supabaseAdmin.js";

export async function getSearchAnalytics(options = {}) {
  try {
    const since = options.since || new Date(Date.now() - 7 * 86400000).toISOString();
    const until = options.until || new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("search_analytics")
      .select("*")
      .gte("searched_at", since)
      .lte("searched_at", until)
      .order("searched_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const totalSearches = data?.length || 0;
    const zeroResultSearches = (data || []).filter((r) => r.result_count === 0);
    const entityBreakdown = {};
    const queryFrequencies = {};

    for (const row of data || []) {
      // Entity breakdown
      const entity = row.entity_type || "unknown";
      entityBreakdown[entity] = (entityBreakdown[entity] || 0) + 1;

      // Query frequency
      const q = row.search_query?.trim().toLowerCase();
      if (q) {
        queryFrequencies[q] = (queryFrequencies[q] || 0) + 1;
      }
    }

    const topQueries = Object.entries(queryFrequencies)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return {
      success: true,
      data: {
        totalSearches,
        zeroResultCount: zeroResultSearches.length,
        zeroResultRate: totalSearches > 0 ? zeroResultSearches.length / totalSearches : 0,
        entityBreakdown,
        topQueries,
        period: { since, until },
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getZeroResultQueries(options = {}) {
  try {
    const since = options.since || new Date(Date.now() - 7 * 86400000).toISOString();
    const limit = Math.min(options.limit || 50, 200);

    const { data, error } = await supabaseAdmin
      .from("search_analytics")
      .select("search_query, entity_type, searched_at")
      .eq("result_count", 0)
      .gte("searched_at", since)
      .order("searched_at", { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getSearchPerformance(options = {}) {
  try {
    const since = options.since || new Date(Date.now() - 7 * 86400000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("search_analytics")
      .select("searched_at, result_count, entity_type")
      .gte("searched_at", since)
      .order("searched_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    // Group by day
    const daily = {};
    for (const row of data || []) {
      const day = new Date(row.searched_at).toISOString().split("T")[0];
      if (!daily[day]) {
        daily[day] = { searches: 0, results: 0, entities: {} };
      }
      daily[day].searches++;
      daily[day].results += row.result_count || 0;
      daily[day].entities[row.entity_type] = (daily[day].entities[row.entity_type] || 0) + 1;
    }

    return {
      success: true,
      data: {
        daily: Object.entries(daily).map(([day, stats]) => ({ day, ...stats })),
        totalSearches: data?.length || 0,
        avgResults: data?.length > 0
          ? data.reduce((s, r) => s + (r.result_count || 0), 0) / data.length
          : 0,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

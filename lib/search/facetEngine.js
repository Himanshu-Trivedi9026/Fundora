// Facet Engine — faceted search for drill-down filtering
// Extracts and aggregates facet values from search results

import { supabaseAdmin } from "../supabaseAdmin.js";

const FACET_DEFINITIONS = {
  projects: {
    category: { field: "category", type: "terms", label: "Category" },
    status: { field: "status", type: "terms", label: "Status" },
    funding_goal: { field: "funding_goal", type: "range", label: "Funding Goal", ranges: [
      { from: 0, to: 5000, label: "Under $5K" },
      { from: 5000, to: 25000, label: "$5K - $25K" },
      { from: 25000, to: 100000, label: "$25K - $100K" },
      { from: 100000, to: null, label: "$100K+" },
    ]},
    risk_level: { field: "risk_level", type: "terms", label: "Risk Level" },
  },
  plugins: {
    category: { field: "category", type: "terms", label: "Category" },
    pricing_model: { field: "pricing_model", type: "terms", label: "Pricing" },
    risk_level: { field: "risk_level", type: "terms", label: "Risk Level" },
  },
  campaigns: {
    status: { field: "status", type: "terms", label: "Status" },
    platform: { field: "platform", type: "terms", label: "Platform" },
  },
};

export async function getFacets(entityType, queryFilters = {}) {
  try {
    const facets = FACET_DEFINITIONS[entityType];
    if (!facets) return { success: false, error: `No facet definitions for ${entityType}` };

    const facetResults = {};

    for (const [facetName, config] of Object.entries(facets)) {
      if (config.type === "terms") {
        const result = await computeTermFacet(entityType, config, queryFilters);
        if (result.success) facetResults[facetName] = result.data;
      } else if (config.type === "range") {
        const result = await computeRangeFacet(entityType, config, queryFilters);
        if (result.success) facetResults[facetName] = result.data;
      }
    }

    return { success: true, data: facetResults };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function computeTermFacet(entityType, config, queryFilters) {
  try {
    const { table } = getEntityInfo(entityType);
    let query = supabaseAdmin
      .from(table)
      .select(config.field, { count: "exact", head: false });

    // Apply query filters (excluding the facet's own field to avoid interference)
    for (const [key, value] of Object.entries(queryFilters)) {
      if (key !== config.field && value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    // Count occurrences of each term value
    const counts = {};
    for (const row of data || []) {
      const val = row[config.field];
      if (val) {
        counts[String(val)] = (counts[String(val)] || 0) + 1;
      }
    }

    const buckets = Object.entries(counts)
      .map(([value, count]) => ({ value, count, label: value }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      data: {
        name: config.field,
        label: config.label,
        type: "terms",
        buckets,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function computeRangeFacet(entityType, config, queryFilters) {
  try {
    const { table } = getEntityInfo(entityType);
    const buckets = [];

    for (const range of config.ranges || []) {
      let query = supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true });

      if (range.from !== null) query = query.gte(config.field, range.from);
      if (range.to !== null) query = query.lt(config.field, range.to);

      for (const [key, value] of Object.entries(queryFilters)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }

      const { count, error } = await query;
      if (error) return { success: false, error: error.message };

      buckets.push({
        from: range.from,
        to: range.to,
        label: range.label,
        count: count || 0,
      });
    }

    return {
      success: true,
      data: {
        name: config.field,
        label: config.label,
        type: "range",
        buckets,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getEntityInfo(entityType) {
  const tableMap = {
    projects: { table: "projects" },
    plugins: { table: "plugins" },
    campaigns: { table: "campaigns" },
  };
  return tableMap[entityType] || { table: entityType };
}

export function getFacetDefinitions(entityType) {
  return FACET_DEFINITIONS[entityType] || null;
}

export function getAllFacetDefinitions() {
  return FACET_DEFINITIONS;
}

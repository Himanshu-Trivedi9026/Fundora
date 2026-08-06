// Search Engine — unified full-text search across Fundora entities
// Supports filtering, sorting, pagination, and relevance scoring

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logDebug } from "../verification/secureLogger.js";

const SEARCH_ENTITIES = {
  projects: {
    table: "projects",
    searchFields: ["title", "description", "tags"],
    defaultLimit: 20,
  },
  users: {
    table: "profiles",
    searchFields: ["full_name", "username", "bio"],
    defaultLimit: 20,
  },
  campaigns: {
    table: "campaigns",
    searchFields: ["title", "description"],
    defaultLimit: 20,
  },
  plugins: {
    table: "plugins",
    searchFields: ["name", "description", "tags"],
    defaultLimit: 20,
  },
};

export async function search(options = {}) {
  try {
    const {
      query = "",
      entity = "projects",
      filters = {},
      sort = { field: "created_at", direction: "desc" },
      page = 1,
      limit = 20,
      organizationId = null,
    } = options;

    const entityConfig = SEARCH_ENTITIES[entity];
    if (!entityConfig)
      return { success: false, error: `Unknown search entity: ${entity}` };

    const pageLimit = Math.min(limit, 100);
    const offset = (page - 1) * pageLimit;

    // Build search query
    let dbQuery = supabaseAdmin
      .from(entityConfig.table)
      .select("*", { count: "exact" });

    // Full-text search using OR across searchable fields
    if (query.trim()) {
      const terms = query.trim().split(/\s+/).filter(Boolean);
      const conditions = entityConfig.searchFields.map((field) =>
        terms.map((t) => `${field}.ilike.%${t}%`).join(","),
      );
      dbQuery = dbQuery.or(conditions.join(","));
    }

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          dbQuery = dbQuery.in(key, value);
        } else if (typeof value === "object" && value.gte && value.lte) {
          dbQuery = dbQuery.gte(key, value.gte).lte(key, value.lte);
        } else {
          dbQuery = dbQuery.eq(key, value);
        }
      }
    }

    if (organizationId) dbQuery = dbQuery.eq("organization_id", organizationId);

    // Sort
    dbQuery = dbQuery.order(sort.field || "created_at", {
      ascending: sort.direction === "asc",
    });

    // Paginate
    dbQuery = dbQuery.range(offset, offset + pageLimit - 1);

    const { data, count, error } = await dbQuery;
    if (error) return { success: false, error: error.message };

    // Record search analytics
    recordSearchAnalytics(query, entity, data?.length || 0).catch(() => {});

    return {
      success: true,
      data: {
        results: data || [],
        total: count || 0,
        page,
        pageSize: pageLimit,
        totalPages: Math.ceil((count || 0) / pageLimit),
        query,
        entity,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function searchProjects(query, options = {}) {
  return search({ ...options, query, entity: "projects" });
}

export async function searchUsers(query, options = {}) {
  return search({ ...options, query, entity: "users" });
}

export async function searchCampaigns(query, options = {}) {
  return search({ ...options, query, entity: "campaigns" });
}

export async function searchPlugins(query, options = {}) {
  return search({ ...options, query, entity: "plugins" });
}

export async function globalSearch(query, options = {}) {
  try {
    const entities = options.entities || Object.keys(SEARCH_ENTITIES);
    const results = {};

    for (const entity of entities) {
      const result = await search({
        ...options,
        query,
        entity,
        limit: options.perEntityLimit || 5,
      });
      if (result.success) {
        results[entity] = result.data;
      }
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function recordSearchAnalytics(query, entity, resultCount) {
  try {
    await supabaseAdmin.from("search_analytics").insert({
      search_query: query,
      entity_type: entity,
      result_count: resultCount,
      searched_at: new Date().toISOString(),
    });
  } catch (err) {
    // Analytics failures are non-critical
    logDebug("Search analytics insert failed", { error: err.message });
  }
}

export function getSearchEntities() {
  return SEARCH_ENTITIES;
}

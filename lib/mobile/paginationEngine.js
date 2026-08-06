// Pagination Engine — cursor-based pagination for mobile APIs
// Provides efficient, stable pagination for mobile clients

import { supabaseAdmin } from "../supabaseAdmin.js";

export async function cursorPaginate(options = {}) {
  try {
    const {
      table,
      select = "*",
      cursor = null,
      limit = 20,
      orderBy = "created_at",
      orderDirection = "desc",
      filters = {},
      cursorField = "id",
    } = options;

    const pageLimit = Math.min(limit, 100);
    let query = supabaseAdmin.from(table).select(select, { count: "exact" });

    // Apply cursor if provided
    if (cursor) {
      const op = orderDirection === "desc" ? "lt" : "gt";
      query = query[op](cursorField, cursor);
    }

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === "object" && value.gte !== undefined) {
          query = query.gte(key, value.gte);
          if (value.lte !== undefined) query = query.lte(key, value.lte);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    // Order and limit
    query = query
      .order(orderBy, { ascending: orderDirection === "asc" })
      .limit(pageLimit + 1); // Fetch one extra to know if there's a next page

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };

    const records = data || [];
    const hasMore = records.length > pageLimit;
    const items = hasMore ? records.slice(0, pageLimit) : records;

    // Build next cursor from last item
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem[cursorField] : null;

    return {
      success: true,
      data: {
        items,
        total: count || 0,
        nextCursor: nextCursor ? String(nextCursor) : null,
        hasMore,
        pageLimit,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function offsetPaginate(options = {}) {
  try {
    const {
      table,
      select = "*",
      page = 1,
      limit = 20,
      orderBy = "created_at",
      orderDirection = "desc",
      filters = {},
    } = options;

    const pageLimit = Math.min(limit, 100);
    const offset = (page - 1) * pageLimit;

    let query = supabaseAdmin.from(table).select(select, { count: "exact" });

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    }

    const { data, count, error } = await query
      .order(orderBy, { ascending: orderDirection === "asc" })
      .range(offset, offset + pageLimit - 1);

    if (error) return { success: false, error: error.message };

    const total = count || 0;

    return {
      success: true,
      data: {
        items: data || [],
        total,
        page,
        pageSize: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
        hasMore: offset + pageLimit < total,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function buildCursorPayload(data, cursorField = "id") {
  if (!data || data.length === 0) {
    return { cursor: null, hasMore: false };
  }

  const lastItem = data[data.length - 1];
  return {
    cursor: lastItem[cursorField] ? String(lastItem[cursorField]) : null,
    hasMore: data.length > 0,
  };
}

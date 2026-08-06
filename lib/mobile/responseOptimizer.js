// Response Optimizer — response size reduction for mobile APIs
// Supports field selection, sparse fieldsets, and data compression

export function selectFields(data, fields) {
  if (!data) return data;
  if (!fields || fields.length === 0) return data;

  if (Array.isArray(data)) {
    return data.map((item) => selectFields(item, fields));
  }

  const result = {};
  for (const field of fields) {
    if (field.includes(".")) {
      // Handle nested paths like "user.name"
      const parts = field.split(".");
      let value = data;
      for (const part of parts) {
        if (value && typeof value === "object") {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        setNestedValue(result, parts, value);
      }
    } else {
      if (field in data) {
        result[field] = data[field];
      }
    }
  }

  return result;
}

function setNestedValue(obj, parts, value) {
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

export function paginatedResponse(items, total, page, pageSize) {
  return {
    data: items,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
  };
}

export function cursorResponse(items, nextCursor, hasMore) {
  return {
    data: items,
    meta: {
      nextCursor,
      hasMore,
      count: items.length,
    },
  };
}

export function apiResponse(data, options = {}) {
  const response = { success: true };

  if (options.fields) {
    response.data = selectFields(data, options.fields);
  } else {
    response.data = data;
  }

  if (options.meta) {
    response.meta = options.meta;
  }

  if (options.timestamp !== false) {
    response.timestamp = new Date().toISOString();
  }

  return response;
}

export function errorResponse(error, code = "error") {
  return {
    success: false,
    error: typeof error === "string" ? error : error.message || "Unknown error",
    code,
    timestamp: new Date().toISOString(),
  };
}

export function reducePayloadSize(data) {
  if (!data) return data;

  // Remove null/undefined fields
  if (Array.isArray(data)) {
    return data.map(reducePayloadSize);
  }

  if (typeof data === "object" && !Buffer.isBuffer(data)) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        result[key] = reducePayloadSize(value);
      }
    }
    return result;
  }

  return data;
}

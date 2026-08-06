// Offline Sync Engine — offline data synchronization for mobile clients
// Handles conflict resolution, change tracking, and batch operations
//
// SECURITY (CR-4): Mobile Sync is a mobile-facing API that runs with the
// service-role client, which bypasses PostgREST RLS. It therefore MUST enforce
// its own authorization:
//   * Only a strict allowlist of tables may be synced (SYNC_TABLES).
//   * Only a strict allowlist of columns may be read/written per table.
//   * Client-supplied ownership/sensitive columns (owner_id, creator_id,
//     user_id, role, permissions, …) are never accepted — ownership is forced
//     server-side to the authenticated caller.
//   * Ownership is verified BEFORE the service role is used for any
//     read/insert/update/delete.

import { supabaseAdmin } from "../supabaseAdmin.js";

export const SYNC_OPERATIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
};

export const CONFLICT_STRATEGIES = {
  CLIENT_WINS: "client_wins",
  SERVER_WINS: "server_wins",
  LAST_WRITE_WINS: "last_write_wins",
  MANUAL: "manual",
};

/**
 * Strict allowlist of tables the Mobile Sync engine may access.
 *
 * Each entry declares the columns a mobile client may read, the columns it may
 * write, the ownership column(s) that scope every row to its owner, and which
 * operations are permitted. Anything not listed here is rejected outright.
 */
export const SYNC_TABLES = {
  projects: {
    readColumns: [
      "id", "title", "description", "category", "deadline", "image",
      "status", "pledged", "created_at", "updated_at",
    ],
    writeColumns: ["title", "description", "category", "deadline", "image"],
    ownership: ["owner_id", "creator_id"],
    operations: { create: true, update: true, delete: true },
  },
  campaigns: {
    readColumns: [
      "id", "title", "category", "goal_amount", "status",
      "created_at", "updated_at",
    ],
    writeColumns: ["title", "category", "goal_amount"],
    ownership: ["creator_id"],
    operations: { create: true, update: true, delete: true },
  },
  profiles: {
    readColumns: [
      "id", "full_name", "username", "bio", "avatar_url", "role",
      "created_at", "updated_at",
    ],
    writeColumns: ["full_name", "username", "bio", "avatar_url"],
    ownership: ["id"],
    operations: { create: false, update: true, delete: false },
  },
  notifications: {
    readColumns: [
      "id", "type", "is_read", "actor_id", "entity_id", "title", "body",
      "created_at",
    ],
    writeColumns: ["is_read"],
    ownership: ["user_id"],
    operations: { create: false, update: true, delete: false },
  },
};

/**
 * Columns a client may NEVER set — regardless of table. Covers identity,
 * role, permission, ownership, auth, security, and audit fields.
 */
export const FORBIDDEN_COLUMNS = new Set([
  "id",
  "role",
  "permissions",
  "owner_id",
  "creator_id",
  "user_id",
  "organization_id",
  "org_id",
  "created_by",
  "created_at",
  "updated_at",
  "updated_by",
  "is_admin",
  "is_platform_admin",
  "is_staff",
  "is_verified",
  "verified_at",
  "email",
  "phone",
  "mobile",
  "password",
  "password_hash",
  "token",
  "api_key",
  "secret",
  "otp",
  "verification_code",
  "session_id",
  "risk_score",
  "fraud_status",
  "banned",
  "balance",
  "stripe_customer_id",
]);

/** Validate + sanitize a client write payload against a table's allowlist. */
function sanitizeWriteColumns(table, data) {
  const config = SYNC_TABLES[table];
  const allowed = config.writeColumns;
  const sanitized = {};

  for (const [key, value] of Object.entries(data || {})) {
    if (key === "id") continue; // row identifier, handled by the caller
    if (FORBIDDEN_COLUMNS.has(key)) {
      return { error: `Field '${key}' is not allowed for sync` };
    }
    if (!allowed.includes(key)) {
      return { error: `Column '${key}' is not allowed for table '${table}'` };
    }
    sanitized[key] = value;
  }

  return { data: sanitized };
}

/**
 * Verify the caller owns a row BEFORE the service role is used to mutate it.
 * Returns { ok: true } or { error }.
 */
async function assertOwnership(table, rowId, userId) {
  const config = SYNC_TABLES[table];
  if (!config) return { error: "Table not allowed" };

  const selectCols = config.ownership.join(",");
  const { data: row, error } = await supabaseAdmin
    .from(table)
    .select(selectCols)
    .eq("id", rowId)
    .maybeSingle();

  if (error || !row) return { error: "Not found" };
  const owned = config.ownership.some((col) => String(row[col]) === String(userId));
  if (!owned) return { error: "You can only sync your own data" };

  return { ok: true };
}

export async function processSyncBatch(batch, options = {}) {
  try {
    const userId = options.userId;
    if (!userId) return { success: false, error: "userId is required" };

    const strategy = options.conflictStrategy || CONFLICT_STRATEGIES.LAST_WRITE_WINS;
    const results = [];

    for (const operation of batch || []) {
      const result = await processOperation(operation, strategy, userId);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failure: failureCount,
        },
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function processOperation(operation, conflictStrategy, userId) {
  try {
    const { table, operation: op, data, clientTimestamp, clientId } = operation;

    if (!table || !op || !data) {
      return { success: false, operation: op, error: "Missing required fields" };
    }

    const config = SYNC_TABLES[table];
    if (!config) {
      return { success: false, operation: op, error: `Table '${table}' is not allowed` };
    }

    switch (op) {
      case SYNC_OPERATIONS.CREATE:
        if (!config.operations.create) {
          return { success: false, operation: op, error: `Create is not allowed for '${table}'` };
        }
        return await handleCreate(table, data, userId);
      case SYNC_OPERATIONS.UPDATE:
        if (!config.operations.update) {
          return { success: false, operation: op, error: `Update is not allowed for '${table}'` };
        }
        return await handleUpdate(table, data, conflictStrategy, userId);
      case SYNC_OPERATIONS.DELETE:
        if (!config.operations.delete) {
          return { success: false, operation: op, error: `Delete is not allowed for '${table}'` };
        }
        return await handleDelete(table, data, userId);
      default:
        return { success: false, operation: op, error: `Unknown operation: ${op}` };
    }
  } catch (err) {
    return { success: false, operation: operation?.operation, error: err.message };
  }
}

async function handleCreate(table, data, userId) {
  const sanitized = sanitizeWriteColumns(table, data);
  if (sanitized.error) return { success: false, operation: "create", error: sanitized.error };

  // Ownership is forced server-side to the authenticated caller. The client
  // never supplies owner/creator/user columns (they are in FORBIDDEN_COLUMNS).
  for (const col of SYNC_TABLES[table].ownership) {
    sanitized.data[col] = userId;
  }

  const { data: result, error } = await supabaseAdmin
    .from(table)
    .insert(sanitized.data)
    .select()
    .single();

  if (error) return { success: false, operation: "create", error: error.message };
  return { success: true, operation: "create", data: result };
}

async function handleUpdate(table, data, conflictStrategy, userId) {
  const id = data.id;
  if (!id) return { success: false, operation: "update", error: "No ID provided" };

  const sanitized = sanitizeWriteColumns(table, data);
  if (sanitized.error) return { success: false, operation: "update", error: sanitized.error };

  // Ownership must be verified BEFORE the service role is used.
  const ownership = await assertOwnership(table, id, userId);
  if (ownership.error) return { success: false, operation: "update", error: ownership.error };

  if (conflictStrategy === CONFLICT_STRATEGIES.SERVER_WINS) {
    // Fetch server version and compare
    const { data: serverData } = await supabaseAdmin
      .from(table)
      .select("updated_at")
      .eq("id", id)
      .single();

    if (serverData) {
      // Server version wins; don't overwrite
      return { success: true, operation: "update", data: serverData, conflict: true, resolved: "server_wins" };
    }
  }

  const { data: result, error } = await supabaseAdmin
    .from(table)
    .update(sanitized.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, operation: "update", error: error.message };
  return { success: true, operation: "update", data: result };
}

async function handleDelete(table, data, userId) {
  const id = data.id;
  if (!id) return { success: false, operation: "delete", error: "No ID provided" };

  // Ownership must be verified BEFORE the service role is used.
  const ownership = await assertOwnership(table, id, userId);
  if (ownership.error) return { success: false, operation: "delete", error: ownership.error };

  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("id", id);

  if (error) return { success: false, operation: "delete", error: error.message };
  return { success: true, operation: "delete", data: { id } };
}

export async function getChangesSince(userId, timestamp, options = {}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    const since = new Date(timestamp).toISOString();
    const results = {};

    const tables = options.tables || ["projects", "campaigns", "profiles"];

    // Reject any table outside the allowlist instead of reading it.
    const unknown = tables.filter((t) => !SYNC_TABLES[t]);
    if (unknown.length > 0) {
      return { success: false, error: `Unknown table(s): ${unknown.join(", ")}` };
    }

    for (const table of tables) {
      const config = SYNC_TABLES[table];

      let query = supabaseAdmin
        .from(table)
        .select(config.readColumns.join(","))
        .gte("updated_at", since);

      // Scope every read to the caller's own rows via the ownership columns.
      if (config.ownership.length === 1) {
        query = query.eq(config.ownership[0], userId);
      } else {
        const orString = config.ownership.map((c) => `${c}.eq.${userId}`).join(",");
        query = query.or(orString);
      }

      query = query.order("updated_at", { ascending: true });

      const { data, error } = await query;
      if (!error && data) {
        results[table] = data;
      }
    }

    const totalChanges = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return {
      success: true,
      data: {
        changes: results,
        since,
        totalChanges,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

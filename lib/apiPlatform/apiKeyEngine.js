/**
 * API Key Engine — Generate, validate, revoke, and audit API keys.
 *
 * Keys are stored as hashes. The plaintext key is returned only once on creation.
 * Each key has scopes, rate limits, and optional expiration.
 */

import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key and return its components.
 */
function generateKey() {
  const raw = randomBytes(32).toString("hex"); // 64 chars
  const prefix = raw.substring(0, 8); // First 8 chars for lookup
  const fullKey = `fk_${prefix}_${raw}`; // Format: fk_{prefix}_{body}
  return { fullKey, prefix, hash: hashApiKey(fullKey) };
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Create a new API key. Returns the plaintext key only once.
 */
export async function createApiKey({
  userId,
  organizationId,
  name,
  scopes = [],
  rateLimit = 100,
  rateWindowMs = 60000,
  expiresAt,
}) {
  try {
    if (!userId || !name) {
      return { success: false, error: "userId and name are required" };
    }

    const { fullKey, prefix, hash } = generateKey();

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        user_id: userId,
        organization_id: organizationId || null,
        name,
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        rate_limit: rateLimit,
        rate_window_ms: rateWindowMs,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) {
      logError("APIKey", "createApiKey insert error", { error: error.message });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "api_key_created",
      entityType: "api_key",
      entityId: data.id,
      userId,
      details: { name, scopes, organizationId },
    });

    logInfo("APIKey", "API key created", { keyId: data.id, name, userId });

    // Return the full key only on creation
    return {
      success: true,
      data: { ...data, key: fullKey },
    };
  } catch (err) {
    logError("APIKey", "createApiKey unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Validate an API key by its hash.
 */
export async function validateApiKey(keyHash) {
  try {
    if (!keyHash) {
      return { success: false, error: "keyHash is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logError("APIKey", "validateApiKey query error", { error: error.message });
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Invalid or revoked API key" };
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { success: false, error: "API key has expired" };
    }

    // Update last_used_at
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    return { success: true, data };
  } catch (err) {
    logError("APIKey", "validateApiKey unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(keyId, userId) {
  try {
    if (!keyId || !userId) {
      return { success: false, error: "keyId and userId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", keyId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "API key not found or not owned by user" };
    }

    await logAuditEvent({
      eventType: "api_key_revoked",
      entityType: "api_key",
      entityId: keyId,
      userId,
      details: { name: data.name },
    });

    return { success: true, data };
  } catch (err) {
    logError("APIKey", "revokeApiKey unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List API keys for a user or organization.
 */
export async function listApiKeys({ userId, organizationId, status, limit = 50, offset = 0 } = {}) {
  try {
    let query = supabaseAdmin
      .from("api_keys")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq("user_id", userId);
    if (organizationId) query = query.eq("organization_id", organizationId);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("APIKey", "listApiKeys unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get usage logs for an API key.
 */
export async function getApiKeyUsage(keyId, { startDate, endDate, limit = 100, offset = 0 } = {}) {
  try {
    if (!keyId) {
      return { success: false, error: "keyId is required" };
    }

    let query = supabaseAdmin
      .from("api_logs")
      .select("*", { count: "exact" })
      .eq("api_key_id", keyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("APIKey", "getApiKeyUsage unexpected error", { error: err.message });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Developer App Engine — Register, manage, and revoke OAuth-ready applications.
 */

import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Helpers ────────────────────────────────────────────────────────

function generateClientId() {
  return randomBytes(16).toString("hex"); // 32 chars
}

function generateClientSecret() {
  return `fks_${randomBytes(32).toString("hex")}`;
}

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Create a developer app. Returns client_secret only once.
 */
export async function createDeveloperApp({
  userId,
  organizationId,
  name,
  description,
  appType = "web",
  redirectUris = [],
}) {
  try {
    if (!userId || !name) {
      return { success: false, error: "userId and name are required" };
    }

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const clientSecretHash = hashSecret(clientSecret);

    const { data, error } = await supabaseAdmin
      .from("developer_apps")
      .insert({
        user_id: userId,
        organization_id: organizationId || null,
        name,
        description,
        app_type: appType,
        redirect_uris: redirectUris,
        client_id: clientId,
        client_secret_hash: clientSecretHash,
      })
      .select()
      .single();

    if (error) {
      logError("DeveloperApp", "createDeveloperApp insert error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "developer_app_created",
      entityType: "developer_app",
      entityId: data.id,
      userId,
      details: { name, appType, clientId },
    });

    logInfo("DeveloperApp", "Developer app created", {
      appId: data.id,
      name,
      userId,
    });

    // Return secret only on creation
    return {
      success: true,
      data: { ...data, client_secret: clientSecret },
    };
  } catch (err) {
    logError("DeveloperApp", "createDeveloperApp unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Validate a developer app's credentials.
 */
export async function validateDeveloperApp(clientId, clientSecret) {
  try {
    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "clientId and clientSecret are required",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("developer_apps")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "App not found or inactive" };
    }

    // Verify secret hash
    const secretHash = hashSecret(clientSecret);
    if (secretHash !== data.client_secret_hash) {
      return { success: false, error: "Invalid client secret" };
    }

    return { success: true, data };
  } catch (err) {
    logError("DeveloperApp", "validateDeveloperApp unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Revoke a developer app.
 */
export async function revokeDeveloperApp(appId, userId) {
  try {
    if (!appId || !userId) {
      return { success: false, error: "appId and userId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("developer_apps")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", appId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message || "App not found or not owned by user",
      };
    }

    await logAuditEvent({
      eventType: "developer_app_revoked",
      entityType: "developer_app",
      entityId: appId,
      userId,
      details: { name: data.name },
    });

    return { success: true, data };
  } catch (err) {
    logError("DeveloperApp", "revokeDeveloperApp unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List developer apps for a user.
 */
export async function listDeveloperApps({
  userId,
  organizationId,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("developer_apps")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq("user_id", userId);
    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("DeveloperApp", "listDeveloperApps unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get a developer app by client_id.
 */
export async function getDeveloperApp(clientId) {
  try {
    if (!clientId) {
      return { success: false, error: "clientId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("developer_apps")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("DeveloperApp", "getDeveloperApp unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

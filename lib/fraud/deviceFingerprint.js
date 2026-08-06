/**
 * Device Fingerprinting — Tracks and analyzes device fingerprints.
 *
 * Fingerprint data:
 *   - Browser, platform, timezone, language, screen resolution
 *   - User agent string
 *   - Canvas hash, WebGL hash, fonts hash (all SHA-256)
 *
 * Security:
 *   - All fingerprint hashes are SHA-256 (never store raw)
 *   - Never expose raw fingerprints to frontend
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError, logInfo } from "../verification/secureLogger";
import { hashMetadata } from "../verification/metadataEncryption";

const crypto = require("crypto");

// ─── Core Functions ───

/**
 * Record a device fingerprint.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.fingerprint — Raw fingerprint data
 * @param {string} [params.fingerprint.hash] — Pre-computed hash
 * @param {string} [params.fingerprint.browser]
 * @param {string} [params.fingerprint.platform]
 * @param {string} [params.fingerprint.timezone]
 * @param {string} [params.fingerprint.language]
 * @param {string} [params.fingerprint.screenResolution]
 * @param {string} [params.fingerprint.userAgent]
 * @param {string} [params.fingerprint.canvasHash]
 * @param {string} [params.fingerprint.webglHash]
 * @param {string} [params.fingerprint.fontsHash]
 * @returns {Promise<{success: boolean, id?: string, isNew?: boolean, error?: string}>}
 */
export async function recordFingerprint({ userId, fingerprint }) {
  try {
    if (!userId || !fingerprint) {
      return { success: false, error: "Missing required fields" };
    }

    // Compute or use provided hash
    const fingerprintHash =
      fingerprint.hash || computeFingerprintHash(fingerprint);

    // Check if this fingerprint already exists for the user
    const { data: existing } = await supabaseAdmin
      .from("device_fingerprints")
      .select("id, is_known, session_count")
      .eq("user_id", userId)
      .eq("fingerprint_hash", fingerprintHash)
      .single();

    if (existing) {
      // Update existing fingerprint
      const { error } = await supabaseAdmin
        .from("device_fingerprints")
        .update({
          last_seen_at: new Date().toISOString(),
          session_count: (existing.session_count || 0) + 1,
          is_known: true,
        })
        .eq("id", existing.id);

      if (error) {
        logError("DeviceFingerprint", "Update error", { error: error.message });
      }

      return { success: true, id: existing.id, isNew: false };
    }

    // Create new fingerprint
    const { data, error } = await supabaseAdmin
      .from("device_fingerprints")
      .insert({
        user_id: userId,
        fingerprint_hash: fingerprintHash,
        browser: fingerprint.browser || null,
        platform: fingerprint.platform || null,
        timezone: fingerprint.timezone || null,
        language: fingerprint.language || null,
        screen_resolution: fingerprint.screenResolution || null,
        user_agent: fingerprint.userAgent || null,
        canvas_hash: fingerprint.canvasHash || null,
        webgl_hash: fingerprint.webglHash || null,
        fonts_hash: fingerprint.fontsHash || null,
        is_known: false,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        session_count: 1,
        risk_flags: [],
      })
      .select("id")
      .single();

    if (error) {
      logError("DeviceFingerprint", "Insert error", { error: error.message });
      return { success: false, error: "Failed to record fingerprint" };
    }

    logInfo("DeviceFingerprint", "New fingerprint recorded", {
      userId: userId.substring(0, 8) + "...",
      browser: fingerprint.browser,
      platform: fingerprint.platform,
    });

    return { success: true, id: data.id, isNew: true };
  } catch (err) {
    logError("DeviceFingerprint", "Record error", { error: err.message });
    return { success: false, error: "Failed to record fingerprint" };
  }
}

/**
 * Get all device fingerprints for a user.
 *
 * @param {string} userId
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @returns {Promise<{success: boolean, devices?: Object[], total?: number, error?: string}>}
 */
export async function getDeviceFingerprints(
  userId,
  { limit = 50, offset = 0 } = {},
) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error, count } = await supabaseAdmin
      .from("device_fingerprints")
      .select(
        "id, browser, platform, timezone, language, screen_resolution, is_known, first_seen_at, last_seen_at, session_count, risk_flags",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("DeviceFingerprint", "Query error", { error: error.message });
      return { success: false, error: "Failed to fetch devices" };
    }

    return {
      success: true,
      devices: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("DeviceFingerprint", "Query error", { error: err.message });
    return { success: false, error: "Failed to fetch devices" };
  }
}

/**
 * Get device statistics for a user.
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
 */
export async function getDeviceStats(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("device_fingerprints")
      .select(
        "browser, platform, is_known, first_seen_at, last_seen_at, session_count, risk_flags",
      )
      .eq("user_id", userId);

    if (error) {
      logError("DeviceFingerprint", "Stats query error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch stats" };
    }

    const devices = data || [];
    const browsers = {};
    const platforms = {};
    let totalSessions = 0;
    let knownDevices = 0;
    let allRiskFlags = [];

    devices.forEach((d) => {
      browsers[d.browser || "unknown"] =
        (browsers[d.browser || "unknown"] || 0) + 1;
      platforms[d.platform || "unknown"] =
        (platforms[d.platform || "unknown"] || 0) + 1;
      totalSessions += d.session_count || 0;
      if (d.is_known) knownDevices++;
      allRiskFlags.push(...(d.risk_flags || []));
    });

    return {
      success: true,
      stats: {
        totalDevices: devices.length,
        knownDevices,
        unknownDevices: devices.length - knownDevices,
        totalSessions,
        browsers,
        platforms,
        uniqueRiskFlags: [...new Set(allRiskFlags)],
      },
    };
  } catch (err) {
    logError("DeviceFingerprint", "Stats error", { error: err.message });
    return { success: false, error: "Failed to fetch stats" };
  }
}

/**
 * Flag a device fingerprint with risk flags.
 *
 * @param {string} deviceId
 * @param {string[]} riskFlags
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function flagDevice(deviceId, riskFlags) {
  try {
    if (!deviceId || !riskFlags || riskFlags.length === 0) {
      return { success: false, error: "Missing required fields" };
    }

    // Get current flags
    const { data: device } = await supabaseAdmin
      .from("device_fingerprints")
      .select("risk_flags")
      .eq("id", deviceId)
      .single();

    const currentFlags = device?.risk_flags || [];
    const newFlags = [...new Set([...currentFlags, ...riskFlags])];

    const { error } = await supabaseAdmin
      .from("device_fingerprints")
      .update({ risk_flags: newFlags })
      .eq("id", deviceId);

    if (error) {
      logError("DeviceFingerprint", "Flag error", { error: error.message });
      return { success: false, error: "Failed to flag device" };
    }

    return { success: true };
  } catch (err) {
    logError("DeviceFingerprint", "Flag error", { error: err.message });
    return { success: false, error: "Failed to flag device" };
  }
}

/**
 * Get device risk summary across all users (admin).
 *
 * @param {Object} [params]
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @returns {Promise<{success: boolean, devices?: Object[], total?: number, error?: string}>}
 */
export async function getHighRiskDevices({ limit = 50, offset = 0 } = {}) {
  try {
    const { data, error, count } = await supabaseAdmin
      .from("device_fingerprints")
      .select(
        "id, user_id, browser, platform, is_known, session_count, risk_flags, last_seen_at",
        { count: "exact" },
      )
      .not("risk_flags", "eq", "{}")
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("DeviceFingerprint", "High-risk query error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch high-risk devices" };
    }

    return {
      success: true,
      devices: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("DeviceFingerprint", "High-risk query error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch high-risk devices" };
  }
}

// ─── Helpers ───

/**
 * Compute a SHA-256 hash of fingerprint data.
 * @param {Object} fingerprint
 * @returns {string} Hex-encoded hash
 */
function computeFingerprintHash(fingerprint) {
  const components = [
    fingerprint.browser || "",
    fingerprint.platform || "",
    fingerprint.timezone || "",
    fingerprint.language || "",
    fingerprint.screenResolution || "",
    fingerprint.userAgent || "",
    fingerprint.canvasHash || "",
    fingerprint.webglHash || "",
    fingerprint.fontsHash || "",
  ].join("|");

  return crypto.createHash("sha256").update(components).digest("hex");
}

/**
 * Sanitize a device response for frontend (strip hashes).
 * @param {Object} device
 * @returns {Object}
 */
export function sanitizeDeviceResponse(device) {
  if (!device) return null;

  const safe = { ...device };
  delete safe.fingerprint_hash;
  delete safe.canvas_hash;
  delete safe.webgl_hash;
  delete safe.fonts_hash;
  delete safe.user_agent;

  return safe;
}

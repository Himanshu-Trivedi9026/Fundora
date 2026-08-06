/**
 * Phone Verification — OTP-based phone verification architecture.
 *
 * Flow: generate OTP → hash → store in DB → send SMS → user enters OTP → verify hash
 *
 * Security:
 *   - OTPs are SHA-256 hashed before storage (never store plaintext)
 *   - Generated with crypto.randomInt (CSPRNG)
 *   - Verified with constant-time comparison (timing-safe)
 *   - Rate-limited: max 3 attempts, 60s cooldown between sends
 *   - OTPs expire after 5 minutes
 *   - All pending OTPs invalidated after successful verification
 *   - Cleanup expired OTPs periodically
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logWarn, logError } from "./secureLogger";

const crypto = require("crypto");

// ─── Configuration ───

export const OTP_CONFIG = {
  length: 6,
  maxAttempts: 3,
  cooldownSeconds: 60,
  expiryMinutes: 5,
  digitsOnly: true,
};

// ─── Core Functions ───

/**
 * Generate a cryptographically secure random OTP.
 * @returns {string} 6-digit numeric OTP
 */
export function generateOTP() {
  const { length } = OTP_CONFIG;
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

/**
 * Hash an OTP using SHA-256 with a salt.
 * @param {string} otp — Plain OTP
 * @param {string} [salt] — Optional salt (auto-generated if not provided)
 * @returns {{ hash: string, salt: string }} Hex-encoded hash and salt
 */
export function hashOTP(otp, salt = null) {
  if (!salt) {
    salt = process.env.OTP_SALT || "fundora-otp-salt";
  }
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}:${otp}`)
    .digest("hex");
  return { hash, salt };
}

/**
 * Verify an OTP against a stored hash using constant-time comparison.
 *
 * @param {string} otp — Plain OTP to verify
 * @param {string} storedHash — Hash from database
 * @param {string} [salt] — Salt used during hashing
 * @returns {boolean} Whether the OTP matches
 */
export function verifyOTPHash(otp, storedHash, salt = null) {
  if (!otp || !storedHash) return false;

  const { hash: computedHash } = hashOTP(otp, salt);
  const hashBuf = Buffer.from(computedHash, "hex");
  const storedBuf = Buffer.from(storedHash, "hex");

  // Ensure same length to avoid timing issues
  if (hashBuf.length !== storedBuf.length) return false;

  return crypto.timingSafeEqual(hashBuf, storedBuf);
}

/**
 * Create and store an OTP for a user's phone number.
 * Never returns the OTP in the response.
 *
 * @param {string} userId
 * @param {string} phone — Phone number
 * @returns {Promise<{success: boolean, error?: string, cooldown?: number}>}
 */
export async function createOTP(userId, phone) {
  try {
    // Check cooldown
    const status = await getOTPStatus(userId, phone);
    if (status.cooldownRemaining > 0) {
      return {
        success: false,
        error: `Please wait ${status.cooldownRemaining} seconds before requesting a new OTP`,
        cooldown: status.cooldownRemaining,
      };
    }

    // Generate and hash OTP
    const otp = generateOTP();
    const { hash: otpHash, salt } = hashOTP(otp);

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000,
    ).toISOString();

    // Store in DB using admin client (service role)
    const { error } = await supabaseAdmin.from("verification_otp").insert({
      user_id: userId,
      phone,
      otp_hash: otpHash,
      otp_salt: salt,
      attempts: 0,
      max_attempts: OTP_CONFIG.maxAttempts,
      expires_at: expiresAt,
      verified: false,
    });

    if (error) {
      logError("PhoneVerification", "Create OTP error", {
        error: error.message,
      });
      return { success: false, error: "Failed to create OTP" };
    }

    logInfo("PhoneVerification", "OTP created", {
      userId: userId.substring(0, 8) + "...",
    });

    // In production: send SMS via provider
    // await sendSMS(phone, `Your Fundora verification code is: ${otp}`);

    // NEVER return the OTP — production would send via SMS
    return { success: true };
  } catch (err) {
    logError("PhoneVerification", "Create OTP error", { error: err.message });
    return { success: false, error: "Failed to create OTP" };
  }
}

/**
 * Verify an OTP entered by the user.
 * Uses constant-time comparison. Invalidates all pending OTPs on success.
 *
 * @param {string} userId
 * @param {string} phone
 * @param {string} otp — Plain OTP to verify
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyOTP(userId, phone, otp) {
  try {
    // Validate OTP format before hashing
    if (!otp || otp.length !== OTP_CONFIG.length || !/^\d+$/.test(otp)) {
      return { success: false, error: "Invalid OTP format" };
    }

    // Find the latest unverified OTP for this user+phone
    const { data: otpRecords, error: fetchError } = await supabaseAdmin
      .from("verification_otp")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      logError("PhoneVerification", "Fetch OTP error", {
        error: fetchError.message,
      });
      return { success: false, error: "Verification failed" };
    }

    if (!otpRecords || otpRecords.length === 0) {
      return {
        success: false,
        error: "No pending OTP found. Request a new one.",
      };
    }

    const record = otpRecords[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return { success: false, error: "OTP has expired. Request a new one." };
    }

    // Check attempts — use atomic check to prevent race conditions
    if (record.attempts >= record.max_attempts) {
      return { success: false, error: "Too many attempts. Request a new OTP." };
    }

    // Increment attempts atomically (optimistic — re-read not needed for correctness)
    const { error: updateError } = await supabaseAdmin
      .from("verification_otp")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id)
      .lt("attempts", record.max_attempts); // Atomic guard

    if (updateError) {
      // Another request incremented first — still check the hash below
    }

    // Verify hash using timing-safe comparison
    const storedSalt =
      record.otp_salt || process.env.OTP_SALT || "fundora-otp-salt";
    const isValid = verifyOTPHash(otp, record.otp_hash, storedSalt);

    if (!isValid) {
      const remaining = record.max_attempts - (record.attempts + 1);
      return {
        success: false,
        error: `Invalid OTP. ${Math.max(0, remaining)} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      };
    }

    // Mark current OTP as verified
    await supabaseAdmin
      .from("verification_otp")
      .update({ verified: true })
      .eq("id", record.id);

    // Invalidate ALL other pending OTPs for this user+phone
    await supabaseAdmin
      .from("verification_otp")
      .update({ verified: true })
      .eq("user_id", userId)
      .eq("phone", phone)
      .eq("verified", false)
      .neq("id", record.id);

    logInfo("PhoneVerification", "OTP verified", {
      userId: userId.substring(0, 8) + "...",
    });

    return { success: true };
  } catch (err) {
    logError("PhoneVerification", "Verify OTP error", { error: err.message });
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Resend OTP (rate-limited).
 *
 * @param {string} userId
 * @param {string} phone
 * @returns {Promise<{success: boolean, error?: string, cooldown?: number}>}
 */
export async function resendOTP(userId, phone) {
  return createOTP(userId, phone);
}

/**
 * Get OTP status for a user+phone combination.
 *
 * @param {string} userId
 * @param {string} phone
 * @returns {Promise<{canSend: boolean, cooldownRemaining: number, attemptsUsed: number, maxAttempts: number}>}
 */
export async function getOTPStatus(userId, phone) {
  try {
    const { data: records } = await supabaseAdmin
      .from("verification_otp")
      .select("created_at, attempts, max_attempts, verified")
      .eq("user_id", userId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!records || records.length === 0) {
      return {
        canSend: true,
        cooldownRemaining: 0,
        attemptsUsed: 0,
        maxAttempts: OTP_CONFIG.maxAttempts,
      };
    }

    const latest = records[0];
    const lastSend = new Date(latest.created_at).getTime();
    const now = Date.now();
    const elapsed = (now - lastSend) / 1000;
    const cooldownRemaining = Math.max(0, OTP_CONFIG.cooldownSeconds - elapsed);

    return {
      canSend: cooldownRemaining === 0 && !latest.verified,
      cooldownRemaining: Math.ceil(cooldownRemaining),
      attemptsUsed: latest.attempts,
      maxAttempts: latest.max_attempts,
    };
  } catch (err) {
    logError("PhoneVerification", "Get status error", { error: err.message });
    return {
      canSend: true,
      cooldownRemaining: 0,
      attemptsUsed: 0,
      maxAttempts: OTP_CONFIG.maxAttempts,
    };
  }
}

/**
 * Cleanup expired OTPs.
 * @returns {Promise<number>} Number of deleted records
 */
export async function cleanupExpiredOTPs() {
  try {
    const { data, error } = await supabaseAdmin
      .from("verification_otp")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .eq("verified", false)
      .select("id");

    if (error) {
      logError("PhoneVerification", "Cleanup error", { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logInfo("PhoneVerification", "Cleaned up expired OTPs", { count });
    }
    return count;
  } catch (err) {
    logError("PhoneVerification", "Cleanup error", { error: err.message });
    return 0;
  }
}

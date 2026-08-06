/**
 * PAN Verification — Submit and verify PAN numbers.
 *
 * Uses the registered PAN verification provider (currently mock).
 * PAN is stored encrypted at rest and masked in responses.
 *
 * Status flow: pending → verified/failed
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { getProvider } from "./provider";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";

// ─── Core Functions ───

/**
 * Submit a PAN number for verification.
 *
 * @param {string} userId
 * @param {string} panNumber — 10-character PAN number
 * @param {string} [holderName] — Optional PAN holder name
 * @returns {Promise<{success: boolean, referenceId?: string, error?: string}>}
 */
export async function verifyPANNumber(userId, panNumber, holderName) {
  try {
    if (!userId || !panNumber) {
      return { success: false, error: "User ID and PAN number are required" };
    }

    // Basic format validation
    const cleaned = panNumber.trim().toUpperCase();
    if (cleaned.length !== 10) {
      return { success: false, error: "PAN number must be 10 characters" };
    }

    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
    if (!panRegex.test(cleaned)) {
      return { success: false, error: "Invalid PAN number format" };
    }

    // Check if already verified on this business verification
    const { data: existing } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id, pan_number, pan_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.pan_status === "verified") {
      return { success: false, error: "PAN number already verified" };
    }

    // Get provider
    const provider = getProvider("fundora_internal_pan");

    // Submit for verification
    const result = await provider.submitVerification({
      userId,
      panNumber: cleaned,
      holderName,
    });

    // Update business verification record
    if (existing) {
      await supabaseAdmin
        .from("business_verifications")
        .update({
          pan_number: cleaned,
          pan_status: "pending",
          verification_provider: "fundora_internal_pan",
          provider_reference: result.referenceId,
        })
        .eq("id", existing.id);
    } else {
      // Create minimal record for PAN verification
      await supabaseAdmin
        .from("business_verifications")
        .insert({
          user_id: userId,
          pan_number: cleaned,
          pan_status: "pending",
          verification_provider: "fundora_internal_pan",
          provider_reference: result.referenceId,
          business_name: holderName || "Pending",
          business_type: "individual",
        });
    }

    // Audit log
    await logAuditEvent({
      eventType: "pan_verification.submitted",
      entityType: "business_verification",
      entityId: existing?.id || userId,
      userId,
      action: "pan_verification_submitted",
      details: { referenceId: result.referenceId },
    });

    logInfo("PANVerification", "PAN submitted for verification", { referenceId: result.referenceId });

    return { success: true, referenceId: result.referenceId };
  } catch (err) {
    logError("PANVerification", "Verify error", { error: err.message });
    return { success: false, error: "Failed to submit PAN for verification" };
  }
}

/**
 * Check PAN verification status.
 *
 * @param {string} referenceId — Provider reference ID
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export async function checkPANStatus(referenceId) {
  try {
    if (!referenceId) {
      return { success: false, error: "Reference ID is required" };
    }

    // Find the verification record
    const { data: record } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id, provider_reference")
      .eq("provider_reference", referenceId)
      .maybeSingle();

    if (!record) {
      return { success: false, error: "Verification record not found" };
    }

    // Check with provider
    const provider = getProvider("fundora_internal_pan");
    const result = await provider.checkStatus(referenceId);

    // Update status
    const newStatus = provider.mapStatus(result.status);
    const isVerified = newStatus === "verified" || newStatus === "approved";

    await supabaseAdmin
      .from("business_verifications")
      .update({
        pan_status: isVerified ? "verified" : "failed",
        verified_at: isVerified ? new Date().toISOString() : null,
      })
      .eq("id", record.id);

    // Audit log
    await logAuditEvent({
      eventType: "pan_verification.status_checked",
      entityType: "business_verification",
      entityId: record.id,
      userId: record.user_id,
      action: "pan_verification_status_checked",
      details: { status: newStatus },
    });

    return { success: true, status: newStatus };
  } catch (err) {
    logError("PANVerification", "Status check error", { error: err.message });
    return { success: false, error: "Failed to check PAN verification status" };
  }
}

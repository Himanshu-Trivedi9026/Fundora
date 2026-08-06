/**
 * GST Verification — Submit and verify GST numbers.
 *
 * Uses the registered GST verification provider (currently mock).
 * GST is stored encrypted at rest and masked in responses.
 *
 * Status flow: pending → verified/failed
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { getProvider } from "./provider";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";

// ─── Core Functions ───

/**
 * Submit a GST number for verification.
 *
 * @param {string} userId
 * @param {string} gstNumber — 15-character GST number
 * @param {string} [businessName] — Optional business name
 * @returns {Promise<{success: boolean, referenceId?: string, error?: string}>}
 */
export async function verifyGSTNumber(userId, gstNumber, businessName) {
  try {
    if (!userId || !gstNumber) {
      return { success: false, error: "User ID and GST number are required" };
    }

    // Basic format validation
    const cleaned = gstNumber.trim().toUpperCase();
    if (cleaned.length !== 15) {
      return { success: false, error: "GST number must be 15 characters" };
    }

    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
    if (!gstRegex.test(cleaned)) {
      return { success: false, error: "Invalid GST number format" };
    }

    // Check if already verified on this business verification
    const { data: existing } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id, gst_number, gst_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.gst_status === "verified") {
      return { success: false, error: "GST number already verified" };
    }

    // Get provider
    const provider = getProvider("fundora_internal_gst");

    // Submit for verification
    const result = await provider.submitVerification({
      userId,
      gstNumber: cleaned,
      businessName,
    });

    // Update business verification record
    if (existing) {
      await supabaseAdmin
        .from("business_verifications")
        .update({
          gst_number: cleaned,
          gst_status: "pending",
          verification_provider: "fundora_internal_gst",
          provider_reference: result.referenceId,
        })
        .eq("id", existing.id);
    } else {
      // Create minimal record for GST verification
      await supabaseAdmin.from("business_verifications").insert({
        user_id: userId,
        gst_number: cleaned,
        gst_status: "pending",
        verification_provider: "fundora_internal_gst",
        provider_reference: result.referenceId,
        business_name: businessName || "Pending",
        business_type: "individual",
      });
    }

    // Audit log
    await logAuditEvent({
      eventType: "gst_verification.submitted",
      entityType: "business_verification",
      entityId: existing?.id || userId,
      userId,
      action: "gst_verification_submitted",
      details: { referenceId: result.referenceId },
    });

    logInfo("GSTVerification", "GST submitted for verification", {
      referenceId: result.referenceId,
    });

    return { success: true, referenceId: result.referenceId };
  } catch (err) {
    logError("GSTVerification", "Verify error", { error: err.message });
    return { success: false, error: "Failed to submit GST for verification" };
  }
}

/**
 * Check GST verification status.
 *
 * @param {string} referenceId — Provider reference ID
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export async function checkGSTStatus(referenceId) {
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
    const provider = getProvider("fundora_internal_gst");
    const result = await provider.checkStatus(referenceId);

    // Update status
    const newStatus = provider.mapStatus(result.status);
    const isVerified = newStatus === "verified" || newStatus === "approved";

    await supabaseAdmin
      .from("business_verifications")
      .update({
        gst_status: isVerified ? "verified" : "failed",
        verified_at: isVerified ? new Date().toISOString() : null,
      })
      .eq("id", record.id);

    // Audit log
    await logAuditEvent({
      eventType: "gst_verification.status_checked",
      entityType: "business_verification",
      entityId: record.id,
      userId: record.user_id,
      action: "gst_verification_status_checked",
      details: { status: newStatus },
    });

    return { success: true, status: newStatus };
  } catch (err) {
    logError("GSTVerification", "Status check error", { error: err.message });
    return { success: false, error: "Failed to check GST verification status" };
  }
}

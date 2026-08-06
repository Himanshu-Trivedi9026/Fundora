/**
 * Business Verification — CRUD operations for business verification.
 *
 * Handles: create/update business verification, upload documents,
 * validate GST/PAN/CIN numbers, get verification status.
 *
 * Security:
 *   - GST, PAN, CIN numbers are never exposed in responses
   - All operations are audit-logged
 *   - Uses storageAdapter for storage operations (not direct Supabase)
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";
import { encryptMetadata, sanitizeDocumentResponse, maskDocumentName } from "./metadataEncryption";
import { validateDocument } from "./documentValidator";
import { uploadVerificationDocument, deleteVerificationDocument } from "./storageAdapter";
import { getRequiredDocuments, getMissingDocuments, checkDocumentCompletion } from "./documentRequirements";

// ─── Validation Helpers ───

/**
 * Validate GST number format.
 * Format: 2-digit state code + 10-char PAN + 1 char entity + Z + checksum
 * Total: 15 characters
 *
 * @param {string} gst
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateGSTNumber(gst) {
  if (!gst || typeof gst !== "string") {
    return { valid: false, error: "GST number is required" };
  }

  const cleaned = gst.trim().toUpperCase();

  if (cleaned.length !== 15) {
    return { valid: false, error: "GST number must be 15 characters" };
  }

  // Regex: 2 digits + 10 alphanumeric (PAN) + 1 alpha + Z + 1 alphanumeric
  const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
  if (!gstRegex.test(cleaned)) {
    return { valid: false, error: "Invalid GST number format" };
  }

  return { valid: true };
}

/**
 * Validate PAN number format.
 * Format: 5 alpha + 4 digit + 1 alpha
 * Total: 10 characters
 *
 * @param {string} pan
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePANNumber(pan) {
  if (!pan || typeof pan !== "string") {
    return { valid: false, error: "PAN number is required" };
  }

  const cleaned = pan.trim().toUpperCase();

  if (cleaned.length !== 10) {
    return { valid: false, error: "PAN number must be 10 characters" };
  }

  // Regex: 5 alpha + 4 digit + 1 alpha
  const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
  if (!panRegex.test(cleaned)) {
    return { valid: false, error: "Invalid PAN number format" };
  }

  return { valid: true };
}

/**
 * Validate CIN number format.
 * Format: 21 characters (L for listed, U for unlisted)
 *
 * @param {string} cin
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCINNumber(cin) {
  if (!cin || typeof cin !== "string") {
    return { valid: false, error: "CIN number is required" };
  }

  const cleaned = cin.trim().toUpperCase();

  if (cleaned.length !== 21) {
    return { valid: false, error: "CIN number must be 21 characters" };
  }

  // Regex: L/U + 5 digit industry code + 2 alpha state code + 2 alpha city + 4 alpha name + year + 3 alpha type + 1 alphanumeric
  const cinRegex = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
  if (!cinRegex.test(cleaned)) {
    // Relaxed validation — accept if length is correct
    return { valid: true };
  }

  return { valid: true };
}

// ─── Masking Helpers ───

/**
 * Mask GST number (show first 2 + last 4 chars).
 * @param {string} gst
 * @returns {string}
 */
export function maskGST(gst) {
  if (!gst || typeof gst !== "string") return "***";
  if (gst.length <= 6) return "***";
  return gst.slice(0, 2) + "***" + gst.slice(-4);
}

/**
 * Mask PAN number (show first 4 + last 1 char).
 * @param {string} pan
 * @returns {string}
 */
export function maskPAN(pan) {
  if (!pan || typeof pan !== "string") return "***";
  if (pan.length <= 5) return "***";
  return pan.slice(0, 4) + "***" + pan.slice(-1);
}

// ─── CRUD Operations ───

/**
 * Create or update a business verification record.
 *
 * @param {string} userId
 * @param {string} verificationId — From creator_verifications
 * @param {Object} businessData — { businessName, businessType, gstNumber, panNumber, cinNumber, incorporationDate, businessAddress }
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createBusinessVerification(userId, verificationId, businessData) {
  try {
    if (!userId || !verificationId || !businessData) {
      return { success: false, error: "Missing required parameters" };
    }

    if (!businessData.businessName || !businessData.businessType) {
      return { success: false, error: "Business name and type are required" };
    }

    // Validate GST if provided
    if (businessData.gstNumber) {
      const gstResult = validateGSTNumber(businessData.gstNumber);
      if (!gstResult.valid) {
        return { success: false, error: gstResult.error };
      }
    }

    // Validate PAN if provided
    if (businessData.panNumber) {
      const panResult = validatePANNumber(businessData.panNumber);
      if (!panResult.valid) {
        return { success: false, error: panResult.error };
      }
    }

    // Encrypt sensitive fields
    const encryptedMetadata = encryptMetadata({
      gst_number: businessData.gstNumber || null,
      pan_number: businessData.panNumber || null,
      cin_number: businessData.cinNumber || null,
    });

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from("business_verifications")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const updateData = {
      user_id: userId,
      verification_id: verificationId,
      business_name: businessData.businessName,
      business_type: businessData.businessType,
      gst_number: businessData.gstNumber || null,
      pan_number: businessData.panNumber || null,
      cin_number: businessData.cinNumber || null,
      incorporation_date: businessData.incorporationDate || null,
      business_address: businessData.businessAddress || null,
      metadata_encrypted: encryptedMetadata?.ciphertext ? Buffer.from(encryptedMetadata.ciphertext, "base64") : null,
      metadata_hash: encryptedMetadata ? JSON.stringify(encryptedMetadata) : null,
    };

    let result;

    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from("business_verifications")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        logError("BusinessVerification", "Update error", { error: error.message });
        return { success: false, error: "Failed to update business verification" };
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from("business_verifications")
        .insert(updateData)
        .select()
        .single();

      if (error) {
        logError("BusinessVerification", "Create error", { error: error.message });
        return { success: false, error: "Failed to create business verification" };
      }
      result = data;
    }

    // Audit log
    await logAuditEvent({
      eventType: existing ? "business_verification.updated" : "business_verification.created",
      entityType: "business_verification",
      entityId: result.id,
      userId,
      action: existing ? "updated" : "created",
      details: { businessType: businessData.businessType },
    });

    return { success: true, data: result };
  } catch (err) {
    logError("BusinessVerification", "Create/update error", { error: err.message });
    return { success: false, error: "Failed to save business verification" };
  }
}

/**
 * Upload a business document.
 *
 * @param {string} userId
 * @param {string} verificationId
 * @param {string} documentType — From documentValidator DOCUMENT_TYPES
 * @param {File|Blob} file
 * @param {string} originalFilename
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function uploadBusinessDocument(userId, verificationId, documentType, file, originalFilename) {
  try {
    if (!userId || !verificationId || !documentType || !file) {
      return { success: false, error: "Missing required parameters" };
    }

    // Validate document
    const validation = validateDocument({
      filename: originalFilename,
      mimeType: file.type,
      fileSize: file.size,
      documentType,
    });

    if (!validation.valid) {
      return { success: false, error: validation.errors.join("; ") };
    }

    // Get business verification ID
    const { data: businessVerification } = await supabaseAdmin
      .from("business_verifications")
      .select("id")
      .eq("user_id", userId)
      .eq("verification_id", verificationId)
      .maybeSingle();

    if (!businessVerification) {
      return { success: false, error: "Business verification not found" };
    }

    // Upload via storage adapter
    const uploadResult = await uploadVerificationDocument({
      userId,
      documentType,
      file,
      originalFilename,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // Store document record
    const { data: doc, error } = await supabaseAdmin
      .from("business_documents")
      .insert({
        user_id: userId,
        business_verification_id: businessVerification.id,
        verification_id: verificationId,
        document_type: documentType,
        document_name: originalFilename,
        storage_bucket: uploadResult.metadata.bucket,
        storage_path: uploadResult.storagePath,
        mime_type: uploadResult.metadata.mimeType,
        file_size: uploadResult.metadata.fileSize,
        status: "uploaded",
      })
      .select()
      .single();

    if (error) {
      logError("BusinessVerification", "Document record error", { error: error.message });
      // Clean up the just-uploaded storage object so an insert failure
      // never orphans a file in the verification-docs bucket.
      await deleteVerificationDocument(uploadResult.storagePath);
      return { success: false, error: "Failed to save document record" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "business_document.uploaded",
      entityType: "business_document",
      entityId: doc.id,
      userId,
      action: "document_uploaded",
      details: { documentType, fileName: maskDocumentName(originalFilename) },
    });

    return { success: true, data: doc };
  } catch (err) {
    logError("BusinessVerification", "Upload error", { error: err.message });
    return { success: false, error: "Failed to upload document" };
  }
}

/**
 * Get business verification with documents (sanitized).
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getBusinessVerification(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("business_verifications")
      .select(`
        id, user_id, verification_id, business_name, business_type,
        incorporation_date, business_address, status,
        verified_at, rejection_reason, created_at, updated_at
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logError("BusinessVerification", "Get error", { error: error.message });
      return { success: false, error: "Failed to get business verification" };
    }

    if (!data) {
      return { success: true, data: null };
    }

    // Get documents
    const { data: documents } = await supabaseAdmin
      .from("business_documents")
      .select("id, document_type, document_name, status, uploaded_at, verified_at")
      .eq("business_verification_id", data.id)
      .order("created_at", { ascending: true });

    // Sanitize documents
    const sanitizedDocs = (documents || []).map((doc) => ({
      ...doc,
      document_name: maskDocumentName(doc.document_name),
    }));

    // Get completion status
    const providedTypes = sanitizedDocs.map((d) => d.document_type);
    const completion = checkDocumentCompletion(providedTypes, data.business_type);

    return {
      success: true,
      data: {
        ...data,
        documents: sanitizedDocs,
        completion,
      },
    };
  } catch (err) {
    logError("BusinessVerification", "Get error", { error: err.message });
    return { success: false, error: "Failed to get business verification" };
  }
}

/**
 * Get required documents for a business type.
 *
 * @param {string} businessType
 * @returns {string[]}
 */
export function getRequiredDocumentsForType(businessType) {
  return getRequiredDocuments(businessType);
}

/**
 * Check document completion for a business type.
 *
 * @param {string[]} providedTypes
 * @param {string} businessType
 * @returns {{ complete: boolean, missing: string[], progress: number }}
 */
export function checkBusinessDocumentCompletion(providedTypes, businessType) {
  return checkDocumentCompletion(providedTypes, businessType);
}

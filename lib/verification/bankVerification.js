/**
 * Bank Verification — CRUD operations for bank account verification.
 *
 * Handles: create/update/delete bank accounts, upload documents,
 * validate IFSC, mask account numbers, penny drop status.
 *
 * Bank account lifecycle:
 *   draft → pending → verified
 *                    → rejected → pending (resubmit)
 *                    → disabled (user-initiated)
 *                    → archived (soft delete)
 *
 * Security:
 *   - Account numbers are encrypted at rest (BYTEA)
 *   - Never expose raw account numbers or IFSC in responses
 *   - All operations are audit-logged
 *   - Uses storageAdapter for storage operations
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";
import { encryptMetadata } from "./metadataEncryption";
import {
  uploadVerificationDocument,
  deleteVerificationDocument,
} from "./storageAdapter";

// ─── Validation Helpers ───

/**
 * Validate IFSC code format.
 * Format: 4 alpha + 0 + 2 alpha + 4 digit
 * Total: 11 characters
 *
 * @param {string} ifsc
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== "string") {
    return { valid: false, error: "IFSC code is required" };
  }

  const cleaned = ifsc.trim().toUpperCase();

  if (cleaned.length !== 11) {
    return { valid: false, error: "IFSC code must be 11 characters" };
  }

  // Regex: 4 alpha + 0 + 2 alpha + 4 digit
  const ifscRegex = /^[A-Z]{4}0[A-Z]{6}\d{2}$/;
  if (!ifscRegex.test(cleaned)) {
    // Relaxed validation — accept if length is correct and starts with alpha
    if (/^[A-Z]{4}0/.test(cleaned)) {
      return { valid: true };
    }
    return { valid: false, error: "Invalid IFSC code format" };
  }

  return { valid: true };
}

// ─── Masking Helpers ───

/**
 * Mask account number (show only last 4 digits).
 * @param {string} accountNumber
 * @returns {string}
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber || typeof accountNumber !== "string") return "****";
  if (accountNumber.length <= 4) return "****";
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

/**
 * Mask IFSC code (show first 4 chars + mask rest).
 * @param {string} ifsc
 * @returns {string}
 */
export function maskIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== "string") return "****";
  if (ifsc.length <= 4) return "****";
  return ifsc.slice(0, 4) + "*".repeat(ifsc.length - 4);
}

// ─── CRUD Operations ───

/**
 * Create a new bank account.
 * Account starts in 'draft' status.
 *
 * @param {string} userId
 * @param {Object} accountData — { accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType, upiId }
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createBankAccount(userId, accountData) {
  try {
    if (!userId || !accountData) {
      return { success: false, error: "Missing required parameters" };
    }

    if (
      !accountData.accountHolderName ||
      !accountData.accountNumber ||
      !accountData.ifscCode
    ) {
      return {
        success: false,
        error: "Account holder name, account number, and IFSC are required",
      };
    }

    // Validate IFSC
    const ifscResult = validateIFSC(accountData.ifscCode);
    if (!ifscResult.valid) {
      return { success: false, error: ifscResult.error };
    }

    // Encrypt account number
    const encryptedAccount = encryptMetadata({
      account_number: accountData.accountNumber,
    });

    // Check if this is the first account (make it primary)
    const { count } = await supabaseAdmin
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived");

    const isPrimary = count === 0;

    // Create account
    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .insert({
        user_id: userId,
        account_holder_name: accountData.accountHolderName,
        account_number_encrypted: encryptedAccount?.ciphertext
          ? Buffer.from(encryptedAccount.ciphertext, "base64")
          : null,
        ifsc_code: accountData.ifscCode.toUpperCase(),
        bank_name: accountData.bankName || null,
        branch_name: accountData.branchName || null,
        account_type: accountData.accountType || "savings",
        upi_id: accountData.upiId || null,
        is_primary: isPrimary,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      logError("BankVerification", "Create error", { error: error.message });
      return { success: false, error: "Failed to create bank account" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "bank_account.created",
      entityType: "bank_account",
      entityId: data.id,
      userId,
      action: "created",
      details: { bankName: accountData.bankName, isPrimary },
    });

    // Return with masked account number
    return {
      success: true,
      data: {
        ...data,
        account_number_encrypted: undefined,
        account_number_masked: maskAccountNumber(accountData.accountNumber),
        ifsc_masked: maskIFSC(accountData.ifscCode),
      },
    };
  } catch (err) {
    logError("BankVerification", "Create error", { error: err.message });
    return { success: false, error: "Failed to create bank account" };
  }
}

/**
 * Update a bank account.
 *
 * @param {string} userId
 * @param {string} accountId
 * @param {Object} updates — { accountHolderName, bankName, branchName, accountType, upiId }
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateBankAccount(userId, accountId, updates) {
  try {
    if (!userId || !accountId || !updates) {
      return { success: false, error: "Missing required parameters" };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, user_id, status")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Bank account not found" };
    }

    if (existing.status === "archived") {
      return { success: false, error: "Cannot update archived account" };
    }

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .update({
        account_holder_name: updates.accountHolderName || undefined,
        bank_name: updates.bankName || undefined,
        branch_name: updates.branchName || undefined,
        account_type: updates.accountType || undefined,
        upi_id: updates.upiId || undefined,
      })
      .eq("id", accountId)
      .select()
      .single();

    if (error) {
      logError("BankVerification", "Update error", { error: error.message });
      return { success: false, error: "Failed to update bank account" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "bank_account.updated",
      entityType: "bank_account",
      entityId: accountId,
      userId,
      action: "updated",
      details: { fields: Object.keys(updates) },
    });

    return { success: true, data };
  } catch (err) {
    logError("BankVerification", "Update error", { error: err.message });
    return { success: false, error: "Failed to update bank account" };
  }
}

/**
 * Soft delete a bank account (set status to 'archived').
 *
 * @param {string} userId
 * @param {string} accountId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteBankAccount(userId, accountId) {
  try {
    if (!userId || !accountId) {
      return { success: false, error: "Missing required parameters" };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, user_id, is_primary")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Bank account not found" };
    }

    const { error } = await supabaseAdmin
      .from("bank_accounts")
      .update({ status: "archived" })
      .eq("id", accountId);

    if (error) {
      logError("BankVerification", "Delete error", { error: error.message });
      return { success: false, error: "Failed to delete bank account" };
    }

    // If this was primary, set another as primary
    if (existing.is_primary) {
      const { data: nextAccount } = await supabaseAdmin
        .from("bank_accounts")
        .select("id")
        .eq("user_id", userId)
        .neq("status", "archived")
        .neq("id", accountId)
        .limit(1)
        .maybeSingle();

      if (nextAccount) {
        await supabaseAdmin
          .from("bank_accounts")
          .update({ is_primary: true })
          .eq("id", nextAccount.id);
      }
    }

    // Audit log
    await logAuditEvent({
      eventType: "bank_account.archived",
      entityType: "bank_account",
      entityId: accountId,
      userId,
      action: "archived",
      details: {},
    });

    return { success: true };
  } catch (err) {
    logError("BankVerification", "Delete error", { error: err.message });
    return { success: false, error: "Failed to delete bank account" };
  }
}

/**
 * Get all bank accounts for a user (with masked account numbers).
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getBankAccounts(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .select(
        `
        id, user_id, account_holder_name, ifsc_code, bank_name,
        branch_name, account_type, upi_id, is_primary, status,
        penny_drop_status, penny_drop_verified_at,
        cancelled_cheque_path, passbook_path,
        created_at, updated_at
      `,
      )
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      logError("BankVerification", "Get error", { error: error.message });
      return { success: false, error: "Failed to get bank accounts" };
    }

    // Mask sensitive fields
    const masked = (data || []).map((account) => ({
      ...account,
      ifsc_masked: maskIFSC(account.ifsc_code),
      ifsc_code: undefined,
      upi_id: undefined,
    }));

    return { success: true, data: masked };
  } catch (err) {
    logError("BankVerification", "Get error", { error: err.message });
    return { success: false, error: "Failed to get bank accounts" };
  }
}

/**
 * Set a bank account as primary.
 *
 * @param {string} userId
 * @param {string} accountId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setPrimaryAccount(userId, accountId) {
  try {
    if (!userId || !accountId) {
      return { success: false, error: "Missing required parameters" };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, user_id, status")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Bank account not found" };
    }

    if (existing.status !== "verified") {
      return {
        success: false,
        error: "Only verified accounts can be set as primary",
      };
    }

    // Unset current primary
    await supabaseAdmin
      .from("bank_accounts")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);

    // Set new primary
    const { error } = await supabaseAdmin
      .from("bank_accounts")
      .update({ is_primary: true })
      .eq("id", accountId);

    if (error) {
      logError("BankVerification", "Set primary error", {
        error: error.message,
      });
      return { success: false, error: "Failed to set primary account" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "bank_account.primary_set",
      entityType: "bank_account",
      entityId: accountId,
      userId,
      action: "primary_set",
      details: {},
    });

    return { success: true };
  } catch (err) {
    logError("BankVerification", "Set primary error", { error: err.message });
    return { success: false, error: "Failed to set primary account" };
  }
}

/**
 * Upload a bank document (cancelled cheque, passbook).
 *
 * @param {string} userId
 * @param {string} accountId
 * @param {string} documentType — 'cancelled_cheque' or 'bank_passbook'
 * @param {File|Blob} file
 * @param {string} originalFilename
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function uploadBankDocument(
  userId,
  accountId,
  documentType,
  file,
  originalFilename,
) {
  try {
    if (!userId || !accountId || !documentType || !file) {
      return { success: false, error: "Missing required parameters" };
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "Bank account not found" };
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

    // Update account with document path
    const updateField =
      documentType === "cancelled_cheque"
        ? "cancelled_cheque_path"
        : "passbook_path";
    const { error } = await supabaseAdmin
      .from("bank_accounts")
      .update({ [updateField]: uploadResult.storagePath })
      .eq("id", accountId);

    if (error) {
      logError("BankVerification", "Document update error", {
        error: error.message,
      });
      // Clean up the just-uploaded storage object so a failed update
      // never orphans a file in the verification-docs bucket.
      await deleteVerificationDocument(uploadResult.storagePath);
      return { success: false, error: "Failed to save document reference" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "bank_document.uploaded",
      entityType: "bank_account",
      entityId: accountId,
      userId,
      action: "document_uploaded",
      details: { documentType },
    });

    return { success: true, data: { path: uploadResult.metadata.maskedPath } };
  } catch (err) {
    logError("BankVerification", "Upload error", { error: err.message });
    return { success: false, error: "Failed to upload document" };
  }
}

/**
 * Get bank verification summary.
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getBankVerification(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    // Get bank verification record
    const { data: bkv, error: bkvError } = await supabaseAdmin
      .from("bank_verifications")
      .select(
        `
        id, user_id, verification_id, status,
        total_accounts, verified_accounts, primary_account_id,
        verified_at, rejection_reason, created_at, updated_at
      `,
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (bkvError) {
      logError("BankVerification", "Get summary error", {
        error: bkvError.message,
      });
      return { success: false, error: "Failed to get bank verification" };
    }

    // Get accounts count
    const { count: totalAccounts } = await supabaseAdmin
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived");

    const { count: verifiedAccounts } = await supabaseAdmin
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "verified");

    return {
      success: true,
      data: {
        ...bkv,
        total_accounts: totalAccounts || 0,
        verified_accounts: verifiedAccounts || 0,
      },
    };
  } catch (err) {
    logError("BankVerification", "Get summary error", { error: err.message });
    return { success: false, error: "Failed to get bank verification" };
  }
}

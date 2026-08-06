/**
 * Penny Drop Verification — Bank account verification via penny drop.
 *
 * Sends ₹1 to the bank account to verify ownership.
 * Uses the registered penny drop provider (currently mock).
 *
 * Status flow: initiated → success/failed
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { getProvider } from "./provider";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";

// ─── Core Functions ───

/**
 * Initiate penny drop verification for a bank account.
 *
 * @param {string} userId
 * @param {string} accountId
 * @returns {Promise<{success: boolean, referenceId?: string, error?: string}>}
 */
export async function initiatePennyDrop(userId, accountId) {
  try {
    if (!userId || !accountId) {
      return { success: false, error: "Missing required parameters" };
    }

    // Verify account ownership
    const { data: account } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, user_id, status, account_holder_name, ifsc_code")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!account) {
      return { success: false, error: "Bank account not found" };
    }

    if (account.status === "archived") {
      return { success: false, error: "Cannot verify archived account" };
    }

    // Get provider
    const provider = getProvider("penny_drop_internal");

    // Submit for verification
    const result = await provider.submitVerification({
      userId,
      accountId,
      accountHolderName: account.account_holder_name,
      ifscCode: account.ifsc_code,
    });

    // Update account status
    await supabaseAdmin
      .from("bank_accounts")
      .update({
        penny_drop_status: "initiated",
        verification_provider: "penny_drop_internal",
        provider_reference: result.referenceId,
      })
      .eq("id", accountId);

    // Audit log
    await logAuditEvent({
      eventType: "penny_drop.initiated",
      entityType: "bank_account",
      entityId: accountId,
      userId,
      action: "penny_drop_initiated",
      details: { referenceId: result.referenceId },
    });

    logInfo("PennyDrop", "Penny drop initiated", { accountId, referenceId: result.referenceId });

    return { success: true, referenceId: result.referenceId };
  } catch (err) {
    logError("PennyDrop", "Initiate error", { error: err.message });
    return { success: false, error: "Failed to initiate penny drop" };
  }
}

/**
 * Check penny drop verification status.
 *
 * @param {string} accountId
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export async function checkPennyDropStatus(accountId) {
  try {
    if (!accountId) {
      return { success: false, error: "Account ID is required" };
    }

    const { data: account } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, provider_reference, verification_provider")
      .eq("id", accountId)
      .maybeSingle();

    if (!account) {
      return { success: false, error: "Bank account not found" };
    }

    if (!account.provider_reference) {
      return { success: false, error: "No verification reference found" };
    }

    // Check with provider
    const provider = getProvider(account.verification_provider || "penny_drop_internal");
    const result = await provider.checkStatus(account.provider_reference);

    // Update status
    const newStatus = provider.mapStatus(result.status);
    await supabaseAdmin
      .from("bank_accounts")
      .update({
        penny_drop_status: newStatus === "approved" ? "success" : "failed",
        penny_drop_verified_at: newStatus === "approved" ? new Date().toISOString() : null,
        status: newStatus === "approved" ? "verified" : "rejected",
      })
      .eq("id", accountId);

    // Audit log
    await logAuditEvent({
      eventType: "penny_drop.status_checked",
      entityType: "bank_account",
      entityId: accountId,
      userId: account.user_id,
      action: "penny_drop_status_checked",
      details: { status: newStatus },
    });

    return { success: true, status: newStatus };
  } catch (err) {
    logError("PennyDrop", "Status check error", { error: err.message });
    return { success: false, error: "Failed to check status" };
  }
}

/**
 * Handle penny drop webhook (mock).
 *
 * @param {Object} payload — Webhook payload
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function handlePennyDropWebhook(payload) {
  try {
    if (!payload || !payload.referenceId) {
      return { success: false, error: "Invalid payload" };
    }

    const provider = getProvider("penny_drop_internal");
    const result = await provider.handleWebhook(payload);

    if (result.status === "success") {
      // Find account by reference
      const { data: account } = await supabaseAdmin
        .from("bank_accounts")
        .select("id, user_id")
        .eq("provider_reference", payload.referenceId)
        .maybeSingle();

      if (account) {
        await supabaseAdmin
          .from("bank_accounts")
          .update({
            penny_drop_status: "success",
            penny_drop_verified_at: new Date().toISOString(),
            status: "verified",
          })
          .eq("id", account.id);

        await logAuditEvent({
          eventType: "penny_drop.completed",
          entityType: "bank_account",
          entityId: account.id,
          userId: account.user_id,
          action: "penny_drop_completed",
          details: { status: "success" },
        });
      }
    }

    return { success: true };
  } catch (err) {
    logError("PennyDrop", "Webhook error", { error: err.message });
    return { success: false, error: "Webhook processing failed" };
  }
}

/**
 * Get penny drop history for a user.
 *
 * @param {string} userId
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getPennyDropHistory(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .select(`
        id, account_holder_name, bank_name, status,
        penny_drop_status, penny_drop_verified_at,
        created_at, updated_at
      `)
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      logError("PennyDrop", "History error", { error: error.message });
      return { success: false, error: "Failed to get history" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("PennyDrop", "History error", { error: err.message });
    return { success: false, error: "Failed to get history" };
  }
}

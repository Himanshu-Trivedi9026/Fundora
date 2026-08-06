/**
 * Refund Engine — Refund logic for escrow accounts.
 *
 * Handles:
 *   - Full refunds (entire locked balance)
 *   - Partial refunds (specified amount)
 *   - Per-donation refunds
 *
 * All refunds:
 *   1. Validate against escrow rules (canRefund)
 *   2. Use optimistic locking for concurrent safety
 *   3. Create a ledger entry
 *   4. Record an escrow event
 *   5. Update account balances
 *
 * Security:
 *   - All operations are audit-logged
 *   - Optimistic locking prevents race conditions
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";
import { canRefund, validateAmount } from "./escrowRules";
import { createLedgerEntry } from "./escrowLedger";
import { recordEscrowEvent } from "./escrowEvents";

// ─── Core Functions ───

/**
 * Process a refund from escrow back to the donor(s).
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {number} params.amount — Amount to refund (in cents)
 * @param {string} params.reason — Reason for the refund
 * @param {string} params.refundedBy — User ID performing the refund
 * @param {string} [params.donationId] — Associated donation ID for targeted refund
 * @returns {Promise<{success: boolean, refund?: Object, error?: string}>}
 */
export async function processRefund({
  escrowAccountId,
  amount,
  reason,
  refundedBy,
  donationId = null,
}) {
  try {
    // Input validation
    if (!escrowAccountId || !amount || !reason || !refundedBy) {
      return {
        success: false,
        error: "escrowAccountId, amount, reason, and refundedBy are required",
      };
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }

    // Fetch current escrow account
    const { data: account, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !account) {
      return { success: false, error: "Escrow account not found" };
    }

    // Validate against business rules
    const ruleCheck = canRefund(account, amount);
    if (!ruleCheck.allowed) {
      logWarn("RefundEngine", "Refund denied by rules", {
        escrowAccountId,
        reason: ruleCheck.reason,
        refundedBy,
      });
      return { success: false, error: ruleCheck.reason };
    }

    // Calculate new balances
    const newLockedBalance =
      Math.round((account.locked_balance - amount) * 100) / 100;
    const newRefundedBalance =
      Math.round((account.refunded_balance + amount) * 100) / 100;
    const newStatus =
      newLockedBalance === 0 ? "refunded" : "partially_released";

    // Update account with optimistic lock
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        locked_balance: newLockedBalance,
        refunded_balance: newRefundedBalance,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", account.status) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      logError("RefundEngine", "Update error", {
        error: updateError.message,
        escrowAccountId,
      });
      return { success: false, error: "Failed to update escrow account" };
    }

    // Create ledger entry
    const ledgerResult = await createLedgerEntry({
      escrowAccountId,
      campaignId: account.campaign_id,
      entryType: "refund",
      amount: -amount, // Negative for debits from escrow
      balanceAfter: newLockedBalance,
      referenceType: donationId ? "donation" : "manual_refund",
      referenceId: donationId,
      description: reason,
      idempotencyKey: `refund_${escrowAccountId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: { refundedBy, donationId, previousStatus: account.status },
    });

    if (!ledgerResult.success) {
      logError("RefundEngine", "Ledger entry failed", {
        error: ledgerResult.error,
        escrowAccountId,
      });
      // Rollback account update
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          locked_balance: account.locked_balance,
          refunded_balance: account.refunded_balance,
          status: account.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrowAccountId)
        .eq("status", newStatus);

      return { success: false, error: "Failed to create ledger entry" };
    }

    // Record event
    await recordEscrowEvent({
      escrowAccountId,
      campaignId: account.campaign_id,
      userId: refundedBy,
      eventType: "fund.refunded",
      entityType: donationId ? "donation" : "manual_refund",
      entityId: donationId,
      oldStatus: account.status,
      newStatus,
      details: { amount, reason, refundedBalance: newRefundedBalance },
      performedBy: refundedBy,
      performedByType: "user",
    });

    // Audit log
    await logAuditEvent({
      eventType: "escrow.fund.refunded",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      userId: refundedBy,
      action: "process_refund",
      details: { amount, reason, donationId, newStatus },
    });

    logInfo("RefundEngine", "Refund processed", {
      escrowAccountId,
      amount,
      newStatus,
      refundedBy,
    });

    return { success: true, refund: updatedAccount };
  } catch (err) {
    logError("RefundEngine", "Refund error", {
      error: err.message,
      escrowAccountId,
    });
    return { success: false, error: "Failed to process refund" };
  }
}

/**
 * Process a partial refund from escrow.
 * Alias for processRefund with emphasis on partial nature.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {number} params.amount — Amount to refund (in cents)
 * @param {string} params.reason — Reason for the partial refund
 * @param {string} params.refundedBy — User ID performing the refund
 * @param {string} [params.donationId] — Associated donation ID
 * @returns {Promise<{success: boolean, refund?: Object, error?: string}>}
 */
export async function partialRefund({
  escrowAccountId,
  amount,
  reason,
  refundedBy,
  donationId = null,
}) {
  try {
    if (!escrowAccountId || !amount || !reason || !refundedBy) {
      return {
        success: false,
        error: "escrowAccountId, amount, reason, and refundedBy are required",
      };
    }

    // Fetch account to verify it's a partial refund (not full)
    const { data: account, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("locked_balance")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !account) {
      return { success: false, error: "Escrow account not found" };
    }

    const lockedBalance = account.locked_balance || 0;

    if (amount >= lockedBalance && lockedBalance > 0) {
      return {
        success: false,
        error:
          "Amount equals or exceeds locked balance. Use fullRefund() for full refund.",
      };
    }

    // Delegate to processRefund
    return processRefund({
      escrowAccountId,
      amount,
      reason,
      refundedBy,
      donationId,
    });
  } catch (err) {
    logError("RefundEngine", "Partial refund error", { error: err.message });
    return { success: false, error: "Failed to process partial refund" };
  }
}

/**
 * Process a full refund of the remaining locked balance.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.reason — Reason for the full refund
 * @param {string} params.refundedBy — User ID performing the refund
 * @returns {Promise<{success: boolean, refund?: Object, error?: string}>}
 */
export async function fullRefund({ escrowAccountId, reason, refundedBy }) {
  try {
    if (!escrowAccountId || !reason || !refundedBy) {
      return {
        success: false,
        error: "escrowAccountId, reason, and refundedBy are required",
      };
    }

    // Fetch current account
    const { data: account, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !account) {
      return { success: false, error: "Escrow account not found" };
    }

    const lockedBalance = account.locked_balance || 0;

    if (lockedBalance <= 0) {
      return { success: false, error: "No locked balance to refund" };
    }

    logInfo("RefundEngine", "Processing full refund", {
      escrowAccountId,
      amount: lockedBalance,
      refundedBy,
    });

    // Delegate to processRefund with full locked balance
    return processRefund({
      escrowAccountId,
      amount: lockedBalance,
      reason,
      refundedBy,
    });
  } catch (err) {
    logError("RefundEngine", "Full refund error", { error: err.message });
    return { success: false, error: "Failed to process full refund" };
  }
}

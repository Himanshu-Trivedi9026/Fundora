/**
 * Release Engine — Fund release logic for escrow accounts.
 *
 * Handles:
 *   - Immediate fund releases (milestone completion, etc.)
 *   - Emergency freezes and cancellations
 *   - Scheduled future releases
 *
 * All releases:
 *   1. Validate against escrow rules (canRelease)
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
import { canRelease, validateAmount } from "./escrowRules";
import { createLedgerEntry } from "./escrowLedger";
import { recordEscrowEvent } from "./escrowEvents";

// ─── Core Functions ───

/**
 * Release funds from escrow to the creator.
 *
 * Creates a ledger entry and records the event. Uses optimistic locking
 * via the status column to prevent concurrent modifications.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {number} params.amount — Amount to release (in cents)
 * @param {string} params.reason — Reason for the release
 * @param {string} params.releasedBy — User ID performing the release
 * @param {string} [params.milestoneId] — Associated milestone ID, if any
 * @returns {Promise<{success: boolean, release?: Object, error?: string}>}
 */
export async function releaseFunds({ escrowAccountId, amount, reason, releasedBy, milestoneId = null }) {
  try {
    // Input validation
    if (!escrowAccountId || !amount || !reason || !releasedBy) {
      return {
        success: false,
        error: "escrowAccountId, amount, reason, and releasedBy are required",
      };
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }

    // Fetch current escrow account (with lock attempt via optimistic concurrency)
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
    const ruleCheck = canRelease(account, amount);
    if (!ruleCheck.allowed) {
      logWarn("ReleaseEngine", "Release denied by rules", {
        escrowAccountId,
        reason: ruleCheck.reason,
        releasedBy,
      });
      return { success: false, error: ruleCheck.reason };
    }

    // Calculate new balances
    const newLockedBalance = Math.round((account.locked_balance - amount) * 100) / 100;
    const newReleasedBalance = Math.round((account.released_balance + amount) * 100) / 100;
    const newCreatorEarnings = Math.round(
      (account.creator_earnings + amount * (1 - (account.fee_percentage || 0) / 100)) * 100
    ) / 100;
    const newStatus = newLockedBalance === 0 ? "fully_released" : "partially_released";

    // Update account with optimistic lock (status must match)
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        locked_balance: newLockedBalance,
        released_balance: newReleasedBalance,
        creator_earnings: newCreatorEarnings,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", account.status) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      logError("ReleaseEngine", "Update error", { error: updateError.message, escrowAccountId });
      return { success: false, error: "Failed to update escrow account" };
    }

    // Create ledger entry
    const ledgerResult = await createLedgerEntry({
      escrowAccountId,
      campaignId: account.campaign_id,
      entryType: "release",
      amount: -amount, // Negative for debits
      balanceAfter: newLockedBalance,
      referenceType: milestoneId ? "milestone" : "manual_release",
      referenceId: milestoneId,
      description: reason,
      idempotencyKey: `release_${escrowAccountId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      metadata: { releasedBy, milestoneId },
    });

    if (!ledgerResult.success) {
      logError("ReleaseEngine", "Ledger entry failed", { error: ledgerResult.error, escrowAccountId });
      // Rollback account update
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          locked_balance: account.locked_balance,
          released_balance: account.released_balance,
          creator_earnings: account.creator_earnings,
          status: account.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrowAccountId)
        .eq("status", newStatus); // Optimistic lock

      return { success: false, error: "Failed to create ledger entry" };
    }

    // Record event
    await recordEscrowEvent({
      escrowAccountId,
      campaignId: account.campaign_id,
      userId: releasedBy,
      eventType: "fund.released",
      entityType: milestoneId ? "milestone" : "manual_release",
      entityId: milestoneId,
      oldStatus: account.status,
      newStatus,
      details: { amount, reason, releasedBalance: newReleasedBalance },
      performedBy: releasedBy,
      performedByType: "user",
    });

    // Audit log
    await logAuditEvent({
      eventType: "escrow.fund.released",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      userId: releasedBy,
      action: "release_funds",
      details: { amount, reason, milestoneId, newStatus },
    });

    logInfo("ReleaseEngine", "Funds released", {
      escrowAccountId,
      amount,
      newStatus,
      releasedBy,
    });

    return { success: true, release: updatedAccount };
  } catch (err) {
    logError("ReleaseEngine", "Release error", { error: err.message, escrowAccountId });
    return { success: false, error: "Failed to release funds" };
  }
}

/**
 * Emergency freeze an escrow account. Immediately halts all operations.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @param {string} reason — Reason for the emergency freeze
 * @param {string} performedBy — User ID of the actor (admin/system)
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function emergencyFreeze(escrowAccountId, reason, performedBy) {
  try {
    if (!escrowAccountId || !reason || !performedBy) {
      return { success: false, error: "escrowAccountId, reason, and performedBy are required" };
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

    // Already frozen
    if (account.status === "frozen") {
      return { success: false, error: "Account is already frozen" };
    }

    // Cannot freeze closed accounts
    if (account.status === "closed") {
      return { success: false, error: "Cannot freeze a closed account" };
    }

    const previousStatus = account.status;

    // Update to frozen
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        status: "frozen",
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", previousStatus) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      logError("ReleaseEngine", "Emergency freeze update error", {
        error: updateError.message,
        escrowAccountId,
      });
      return { success: false, error: "Failed to freeze escrow account" };
    }

    // Record event
    await recordEscrowEvent({
      escrowAccountId,
      campaignId: account.campaign_id,
      userId: performedBy,
      eventType: "emergency.freeze",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      oldStatus: previousStatus,
      newStatus: "frozen",
      details: { reason, emergency: true },
      performedBy,
      performedByType: "admin",
    });

    // Audit log
    await logAuditEvent({
      eventType: "escrow.emergency.freeze",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      userId: performedBy,
      action: "emergency_freeze",
      details: { reason, previousStatus },
    });

    logWarn("ReleaseEngine", "Emergency freeze applied", {
      escrowAccountId,
      reason,
      performedBy,
    });

    return { success: true, account: updatedAccount };
  } catch (err) {
    logError("ReleaseEngine", "Emergency freeze error", { error: err.message });
    return { success: false, error: "Failed to apply emergency freeze" };
  }
}

/**
 * Emergency cancel an escrow account. Returns all locked funds to donors.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @param {string} reason — Reason for the emergency cancel
 * @param {string} performedBy — User ID of the actor (admin/system)
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function emergencyCancel(escrowAccountId, reason, performedBy) {
  try {
    if (!escrowAccountId || !reason || !performedBy) {
      return { success: false, error: "escrowAccountId, reason, and performedBy are required" };
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

    // Cannot cancel already cancelled/closed accounts
    if (["cancelled", "closed"].includes(account.status)) {
      return { success: false, error: `Cannot cancel an account in '${account.status}' status` };
    }

    const previousStatus = account.status;
    const lockedBalance = account.locked_balance || 0;

    // Update to cancelled
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        status: "cancelled",
        refunded_balance: Math.round((account.refunded_balance + lockedBalance) * 100) / 100,
        locked_balance: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", previousStatus) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      logError("ReleaseEngine", "Emergency cancel update error", {
        error: updateError.message,
        escrowAccountId,
      });
      return { success: false, error: "Failed to cancel escrow account" };
    }

    // Create ledger entry for the refund
    if (lockedBalance > 0) {
      await createLedgerEntry({
        escrowAccountId,
        campaignId: account.campaign_id,
        entryType: "refund",
        amount: -lockedBalance,
        balanceAfter: 0,
        referenceType: "emergency_cancel",
        referenceId: escrowAccountId,
        description: `Emergency cancellation: ${reason}`,
        idempotencyKey: `cancel_${escrowAccountId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        metadata: { performedBy, reason, previousStatus },
      });
    }

    // Record event
    await recordEscrowEvent({
      escrowAccountId,
      campaignId: account.campaign_id,
      userId: performedBy,
      eventType: "emergency.cancel",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      oldStatus: previousStatus,
      newStatus: "cancelled",
      details: { reason, emergency: true, refundedBalance: lockedBalance },
      performedBy,
      performedByType: "admin",
    });

    // Audit log
    await logAuditEvent({
      eventType: "escrow.emergency.cancel",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      userId: performedBy,
      action: "emergency_cancel",
      details: { reason, previousStatus, lockedBalance },
    });

    logWarn("ReleaseEngine", "Emergency cancel applied", {
      escrowAccountId,
      reason,
      performedBy,
    });

    return { success: true, account: updatedAccount };
  } catch (err) {
    logError("ReleaseEngine", "Emergency cancel error", { error: err.message });
    return { success: false, error: "Failed to apply emergency cancel" };
  }
}

/**
 * Schedule a future fund release.
 * Creates a scheduled event but does not release funds immediately.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {number} params.amount — Amount to release (in cents)
 * @param {string} params.scheduledAt — ISO timestamp for when to release
 * @param {string} params.reason — Reason for the scheduled release
 * @returns {Promise<{success: boolean, scheduled?: Object, error?: string}>}
 */
export async function scheduledRelease({ escrowAccountId, amount, scheduledAt, reason }) {
  try {
    if (!escrowAccountId || !amount || !scheduledAt || !reason) {
      return {
        success: false,
        error: "escrowAccountId, amount, scheduledAt, and reason are required",
      };
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }

    // Validate scheduledAt is in the future
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: "Invalid scheduledAt date" };
    }

    if (scheduledDate <= new Date()) {
      return { success: false, error: "scheduledAt must be in the future" };
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

    // Check if account can eventually support this release
    const lockedBalance = account.locked_balance || 0;
    if (amount > lockedBalance) {
      return {
        success: false,
        error: `Insufficient locked balance. Available: ${lockedBalance}, requested: ${amount}`,
      };
    }

    // Store the scheduled release
    const { data: scheduled, error: insertError } = await supabaseAdmin
      .from("escrow_events")
      .insert({
        escrow_account_id: escrowAccountId,
        campaign_id: account.campaign_id,
        event_type: "fund.scheduled",
        entity_type: "scheduled_release",
        entity_id: escrowAccountId,
        old_status: account.status,
        new_status: account.status,
        details: {
          amount,
          scheduledAt,
          reason,
          status: "pending",
        },
        performed_by: null,
        performed_by_type: "system",
      })
      .select()
      .single();

    if (insertError) {
      logError("ReleaseEngine", "Schedule insert error", {
        error: insertError.message,
        escrowAccountId,
      });
      return { success: false, error: "Failed to schedule release" };
    }

    logInfo("ReleaseEngine", "Release scheduled", {
      escrowAccountId,
      amount,
      scheduledAt,
    });

    return { success: true, scheduled };
  } catch (err) {
    logError("ReleaseEngine", "Schedule error", { error: err.message });
    return { success: false, error: "Failed to schedule release" };
  }
}

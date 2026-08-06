/**
 * Payout Engine — Payout request management and processing.
 *
 * Handles the full payout lifecycle for creators:
 *   request → pending → approved → processing → completed/failed
 *
 * Features:
 *   - Fee calculation (5% default)
 *   - Fraud engine integration (every payout is evaluated)
 *   - Admin approval workflow
 *   - Provider-based processing
 *   - Balance tracking (available, locked, released, pending)
 *   - Retry logic for failed payouts
 *
 * Security:
 *   - Every payout consults the fraud engine before processing
 *   - Admin-only approval/rejection
 *   - All actions audit-logged
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";
import { evaluateUser } from "../fraud";

// ─── Configuration ───

const PAYOUT_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

const PAYOUT_CONFIG = {
  /** Default fee percentage */
  defaultFeePercentage: 5,
  /** Minimum payout amount in cents */
  minimumPayoutAmount: 1000,
  /** Maximum payout amount in cents */
  maximumPayoutAmount: 100000000,
  /** Maximum retry attempts */
  maxRetryAttempts: 3,
  /** Default page size for listing */
  defaultLimit: 50,
  defaultOffset: 0,
};

// ─── Core Functions ───

/**
 * Create a payout request. Calculates fees and runs fraud evaluation.
 *
 * @param {Object} params
 * @param {string} params.creatorId — Creator ID
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.bankAccountId — Bank account ID for payout
 * @param {number} params.amount — Payout amount in cents
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createPayoutRequest({
  creatorId,
  escrowAccountId,
  bankAccountId,
  amount,
}) {
  try {
    if (!creatorId || !escrowAccountId || !bankAccountId || !amount) {
      return {
        success: false,
        error: "creatorId, escrowAccountId, bankAccountId, and amount are required",
      };
    }

    if (amount < PAYOUT_CONFIG.minimumPayoutAmount) {
      return {
        success: false,
        error: `Minimum payout amount is ${PAYOUT_CONFIG.minimumPayoutAmount} cents`,
      };
    }

    if (amount > PAYOUT_CONFIG.maximumPayoutAmount) {
      return {
        success: false,
        error: `Maximum payout amount is ${PAYOUT_CONFIG.maximumPayoutAmount} cents`,
      };
    }

    logInfo("PayoutEngine", "Creating payout request", {
      creatorId: creatorId.substring(0, 8) + "...",
      amount,
    });

    // Calculate fee and net amount
    const feePercentage = PAYOUT_CONFIG.defaultFeePercentage;
    const feeAmount = Math.round(amount * (feePercentage / 100));
    const netAmount = amount - feeAmount;

    // Verify escrow account belongs to creator and has sufficient balance
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("id, creator_id, available_balance, status")
      .eq("id", escrowAccountId)
      .single();

    if (escrowError || !escrow) {
      return { success: false, error: "Escrow account not found" };
    }

    if (escrow.creator_id !== creatorId) {
      return { success: false, error: "Escrow account does not belong to this creator" };
    }

    if (escrow.status !== "active") {
      return { success: false, error: "Escrow account is not active" };
    }

    if (escrow.available_balance < amount) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${escrow.available_balance}, Requested: ${amount}`,
      };
    }

    // Run fraud evaluation before creating payout request
    const fraudResult = await evaluateUser({
      userId: creatorId,
      trigger: "payout_request",
      context: { amount, escrowAccountId, bankAccountId },
    });

    if (!fraudResult.success) {
      logError("PayoutEngine", "Fraud evaluation failed", {
        creatorId: creatorId.substring(0, 8) + "...",
        error: fraudResult.error,
      });
      return { success: false, error: "Payout request could not be evaluated at this time" };
    }

    const fraudDecision = fraudResult.result?.decision?.action || "allow";

    // Block payouts for high-risk users
    if (fraudDecision === "block") {
      logInfo("PayoutEngine", "Payout blocked by fraud engine", {
        creatorId: creatorId.substring(0, 8) + "...",
      });

      await logAuditEvent({
        eventType: "payout.fraud_blocked",
        entityType: "payout_requests",
        entityId: creatorId,
        userId: creatorId,
        action: "fraud_block",
        details: { amount, fraudDecision, riskScore: fraudResult.result?.riskScore },
      });

      return { success: false, error: "Payout request denied. Please contact support." };
    }

    // Lock funds in escrow
    const { error: lockError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        available_balance: escrow.available_balance - amount,
        locked_balance: (escrow.locked_balance || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("available_balance", escrow.available_balance); // Optimistic lock

    if (lockError) {
      logError("PayoutEngine", "Lock funds error", { error: lockError.message });
      return { success: false, error: "Failed to reserve funds. Please try again." };
    }

    // Create payout request
    const { data: payoutRequest, error: insertError } = await supabaseAdmin
      .from("payout_requests")
      .insert({
        creator_id: creatorId,
        escrow_account_id: escrowAccountId,
        bank_account_id: bankAccountId,
        amount,
        fee_percentage: feePercentage,
        fee_amount: feeAmount,
        net_amount: netAmount,
        status: PAYOUT_STATUSES.PENDING,
        fraud_evaluation: {
          decision: fraudDecision,
          riskScore: fraudResult.result?.riskScore || null,
          evaluatedAt: new Date().toISOString(),
        },
        retry_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      // Unlock funds on failure
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          available_balance: escrow.available_balance,
          locked_balance: Math.max(0, (escrow.locked_balance || 0) - amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", escrowAccountId);

      logError("PayoutEngine", "Create payout request error", { error: insertError.message });
      return { success: false, error: "Failed to create payout request" };
    }

    // Create ledger entry
    await supabaseAdmin.from("escrow_ledger").insert({
      escrow_account_id: escrowAccountId,
      transaction_type: "payout_locked",
      amount: -amount,
      balance_after: escrow.available_balance - amount,
      reference_id: payoutRequest.id,
      reference_type: "payout_request",
      description: `Payout request locked: ${amount} cents`,
    });

    await logAuditEvent({
      eventType: "payout.request_created",
      entityType: "payout_requests",
      entityId: payoutRequest.id,
      userId: creatorId,
      action: "create_payout_request",
      details: { amount, feeAmount, netAmount, fraudDecision },
    });

    logInfo("PayoutEngine", "Payout request created", {
      payoutRequestId: payoutRequest.id,
      amount,
      netAmount,
    });

    return { success: true, data: payoutRequest };
  } catch (err) {
    logError("PayoutEngine", "Create payout request error", { error: err.message });
    return { success: false, error: "Failed to create payout request" };
  }
}

/**
 * Get a payout request by ID.
 *
 * @param {string} payoutRequestId — Payout request ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPayoutRequest(payoutRequestId) {
  try {
    if (!payoutRequestId) {
      return { success: false, error: "payoutRequestId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .select(`
        *,
        escrow_account: escrow_accounts(id, campaign_id),
        transactions: payout_transactions(*)
      `)
      .eq("id", payoutRequestId)
      .single();

    if (error || !data) {
      return { success: false, error: "Payout request not found" };
    }

    return { success: true, data };
  } catch (err) {
    logError("PayoutEngine", "Get payout request error", { error: err.message });
    return { success: false, error: "Failed to fetch payout request" };
  }
}

/**
 * Get all payout requests for a creator.
 *
 * @param {string} creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getCreatorPayoutRequests(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .select(`
        *,
        escrow_account: escrow_accounts(id, campaign_id)
      `)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      logError("PayoutEngine", "Get creator payout requests error", { error: error.message });
      return { success: false, error: "Failed to fetch payout requests" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("PayoutEngine", "Get creator payout requests error", { error: err.message });
    return { success: false, error: "Failed to fetch payout requests" };
  }
}

/**
 * Get pending payout requests (admin view).
 *
 * @param {Object} params
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset for pagination
 * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
 */
export async function getPendingPayouts({
  limit = PAYOUT_CONFIG.defaultLimit,
  offset = PAYOUT_CONFIG.defaultOffset,
} = {}) {
  try {
    logInfo("PayoutEngine", "Fetching pending payouts", { limit, offset });

    const { data, error, count } = await supabaseAdmin
      .from("payout_requests")
      .select(`
        *,
        creator: profiles(id, full_name, email),
        escrow_account: escrow_accounts(id, campaign_id)
      `, { count: "exact" })
      .eq("status", PAYOUT_STATUSES.PENDING)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("PayoutEngine", "Get pending payouts error", { error: error.message });
      return { success: false, error: "Failed to fetch pending payouts" };
    }

    return { success: true, data: data || [], count: count || 0 };
  } catch (err) {
    logError("PayoutEngine", "Get pending payouts error", { error: err.message });
    return { success: false, error: "Failed to fetch pending payouts" };
  }
}

/**
 * Admin approve a payout request (pending → approved).
 *
 * @param {string} payoutRequestId — Payout request ID
 * @param {string} adminId — Admin user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function approvePayout(payoutRequestId, adminId) {
  try {
    if (!payoutRequestId || !adminId) {
      return { success: false, error: "payoutRequestId and adminId are required" };
    }

    logInfo("PayoutEngine", "Approving payout", {
      payoutRequestId,
      adminId: adminId.substring(0, 8) + "...",
    });

    // Fetch existing payout
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payout_requests")
      .select("*")
      .eq("id", payoutRequestId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Payout request not found" };
    }

    if (existing.status !== PAYOUT_STATUSES.PENDING) {
      return { success: false, error: `Cannot approve payout in '${existing.status}' status` };
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: PAYOUT_STATUSES.APPROVED,
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId)
      .select()
      .single();

    if (error) {
      logError("PayoutEngine", "Approve payout error", { error: error.message });
      return { success: false, error: "Failed to approve payout" };
    }

    await logAuditEvent({
      eventType: "payout.approved",
      entityType: "payout_requests",
      entityId: payoutRequestId,
      userId: adminId,
      action: "approve_payout",
      details: { amount: existing.amount, creatorId: existing.creator_id },
    });

    logInfo("PayoutEngine", "Payout approved", { payoutRequestId });

    return { success: true, data };
  } catch (err) {
    logError("PayoutEngine", "Approve payout error", { error: err.message });
    return { success: false, error: "Failed to approve payout" };
  }
}

/**
 * Admin reject a payout request.
 *
 * @param {string} payoutRequestId — Payout request ID
 * @param {string} adminId — Admin user ID
 * @param {string} reason — Rejection reason
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function rejectPayout(payoutRequestId, adminId, reason) {
  try {
    if (!payoutRequestId || !adminId) {
      return { success: false, error: "payoutRequestId and adminId are required" };
    }

    if (!reason) {
      return { success: false, error: "Rejection reason is required" };
    }

    logInfo("PayoutEngine", "Rejecting payout", {
      payoutRequestId,
      adminId: adminId.substring(0, 8) + "...",
    });

    // Fetch existing payout
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payout_requests")
      .select("*")
      .eq("id", payoutRequestId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Payout request not found" };
    }

    if (existing.status !== PAYOUT_STATUSES.PENDING && existing.status !== PAYOUT_STATUSES.APPROVED) {
      return { success: false, error: `Cannot reject payout in '${existing.status}' status` };
    }

    // Unlock funds in escrow
    const { error: unlockError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        available_balance: (await getEscrowBalance(existing.escrow_account_id)).available + existing.amount,
        locked_balance: Math.max(0, (await getEscrowBalance(existing.escrow_account_id)).locked - existing.amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.escrow_account_id);

    if (unlockError) {
      logError("PayoutEngine", "Unlock funds on rejection error", { error: unlockError.message });
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: PAYOUT_STATUSES.REJECTED,
        rejected_by: adminId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId)
      .select()
      .single();

    if (error) {
      logError("PayoutEngine", "Reject payout error", { error: error.message });
      return { success: false, error: "Failed to reject payout" };
    }

    // Create ledger entry for unlock
    await supabaseAdmin.from("escrow_ledger").insert({
      escrow_account_id: existing.escrow_account_id,
      transaction_type: "payout_unlocked",
      amount: existing.amount,
      balance_after: (await getEscrowBalance(existing.escrow_account_id)).available,
      reference_id: payoutRequestId,
      reference_type: "payout_request",
      description: `Payout rejected, funds unlocked: ${existing.amount} cents`,
    });

    await logAuditEvent({
      eventType: "payout.rejected",
      entityType: "payout_requests",
      entityId: payoutRequestId,
      userId: adminId,
      action: "reject_payout",
      details: { amount: existing.amount, reason, creatorId: existing.creator_id },
    });

    logInfo("PayoutEngine", "Payout rejected", { payoutRequestId });

    return { success: true, data };
  } catch (err) {
    logError("PayoutEngine", "Reject payout error", { error: err.message });
    return { success: false, error: "Failed to reject payout" };
  }
}

/**
 * Cancel a payout request (draft/pending only).
 *
 * @param {string} payoutRequestId — Payout request ID
 * @param {string} userId — User ID (creator or admin)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function cancelPayout(payoutRequestId, userId) {
  try {
    if (!payoutRequestId || !userId) {
      return { success: false, error: "payoutRequestId and userId are required" };
    }

    logInfo("PayoutEngine", "Cancelling payout", {
      payoutRequestId,
      userId: userId.substring(0, 8) + "...",
    });

    // Fetch existing payout
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payout_requests")
      .select("*")
      .eq("id", payoutRequestId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Payout request not found" };
    }

    if (existing.creator_id !== userId) {
      return { success: false, error: "You can only cancel your own payout requests" };
    }

    if (existing.status !== PAYOUT_STATUSES.PENDING) {
      return { success: false, error: `Cannot cancel payout in '${existing.status}' status. Only pending payouts can be cancelled.` };
    }

    // Unlock funds in escrow
    const balance = await getEscrowBalance(existing.escrow_account_id);

    const { error: unlockError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        available_balance: balance.available + existing.amount,
        locked_balance: Math.max(0, balance.locked - existing.amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.escrow_account_id);

    if (unlockError) {
      logError("PayoutEngine", "Unlock funds on cancel error", { error: unlockError.message });
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: PAYOUT_STATUSES.CANCELLED,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId)
      .select()
      .single();

    if (error) {
      logError("PayoutEngine", "Cancel payout error", { error: error.message });
      return { success: false, error: "Failed to cancel payout" };
    }

    // Create ledger entry for unlock
    await supabaseAdmin.from("escrow_ledger").insert({
      escrow_account_id: existing.escrow_account_id,
      transaction_type: "payout_unlocked",
      amount: existing.amount,
      balance_after: (await getEscrowBalance(existing.escrow_account_id)).available,
      reference_id: payoutRequestId,
      reference_type: "payout_request",
      description: `Payout cancelled, funds unlocked: ${existing.amount} cents`,
    });

    await logAuditEvent({
      eventType: "payout.cancelled",
      entityType: "payout_requests",
      entityId: payoutRequestId,
      userId,
      action: "cancel_payout",
      details: { amount: existing.amount },
    });

    logInfo("PayoutEngine", "Payout cancelled", { payoutRequestId });

    return { success: true, data };
  } catch (err) {
    logError("PayoutEngine", "Cancel payout error", { error: err.message });
    return { success: false, error: "Failed to cancel payout" };
  }
}

/**
 * Process a payout via the payment provider.
 * Creates a payout_transaction record.
 *
 * @param {string} payoutRequestId — Payout request ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function processPayout(payoutRequestId) {
  try {
    if (!payoutRequestId) {
      return { success: false, error: "payoutRequestId is required" };
    }

    logInfo("PayoutEngine", "Processing payout", { payoutRequestId });

    // Fetch existing payout
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payout_requests")
      .select("*, escrow_account: escrow_accounts(creator_id)")
      .eq("id", payoutRequestId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Payout request not found" };
    }

    if (existing.status !== PAYOUT_STATUSES.APPROVED) {
      return { success: false, error: `Cannot process payout in '${existing.status}' status. Must be approved first.` };
    }

    // Re-run fraud evaluation before processing
    const creatorId = existing.creator_id;
    const fraudResult = await evaluateUser({
      userId: creatorId,
      trigger: "payout_processing",
      context: { payoutRequestId, amount: existing.amount },
    });

    if (!fraudResult.success) {
      logError("PayoutEngine", "Fraud re-evaluation failed during processing", {
        payoutRequestId,
        error: fraudResult.error,
      });
      return { success: false, error: "Payout processing evaluation failed" };
    }

    const fraudDecision = fraudResult.result?.decision?.action || "allow";

    if (fraudDecision === "block") {
      // Mark as failed and unlock funds
      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: PAYOUT_STATUSES.FAILED,
          failure_reason: "Blocked by fraud engine",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRequestId);

      // Unlock funds
      const balance = await getEscrowBalance(existing.escrow_account_id);
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          available_balance: balance.available + existing.amount,
          locked_balance: Math.max(0, balance.locked - existing.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.escrow_account_id);

      await logAuditEvent({
        eventType: "payout.fraud_blocked_processing",
        entityType: "payout_requests",
        entityId: payoutRequestId,
        userId: creatorId,
        action: "fraud_block_processing",
        details: { amount: existing.amount, fraudDecision, riskScore: fraudResult.result?.riskScore },
      });

      return { success: false, error: "Payout blocked by security check" };
    }

    // Transition to processing
    await supabaseAdmin
      .from("payout_requests")
      .update({
        status: PAYOUT_STATUSES.PROCESSING,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId);

    // Create payout transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("payout_transactions")
      .insert({
        payout_request_id: payoutRequestId,
        creator_id: creatorId,
        amount: existing.net_amount,
        fee_amount: existing.fee_amount,
        gross_amount: existing.amount,
        provider: "internal",
        status: "processing",
        metadata: {
          bank_account_id: existing.bank_account_id,
          fraudDecision,
        },
      })
      .select()
      .single();

    if (txError) {
      logError("PayoutEngine", "Create transaction error", { error: txError.message });

      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: PAYOUT_STATUSES.FAILED,
          failure_reason: "Failed to create transaction record",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRequestId);

      return { success: false, error: "Failed to create payout transaction" };
    }

    // Simulate provider processing (replace with actual provider integration)
    // In production, this would call the payment provider API
    const providerResult = await simulateProviderProcessing(existing, transaction);

    if (providerResult.success) {
      // Mark as completed
      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: PAYOUT_STATUSES.COMPLETED,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRequestId);

      await supabaseAdmin
        .from("payout_transactions")
        .update({
          status: "completed",
          provider_transaction_id: providerResult.transactionId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Update escrow balance — move locked to released
      const balance = await getEscrowBalance(existing.escrow_account_id);
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          locked_balance: Math.max(0, balance.locked - existing.amount),
          released_balance: (balance.released || 0) + existing.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.escrow_account_id);

      // Ledger entry
      await supabaseAdmin.from("escrow_ledger").insert({
        escrow_account_id: existing.escrow_account_id,
        transaction_type: "payout_released",
        amount: -existing.amount,
        balance_after: balance.available,
        reference_id: payoutRequestId,
        reference_type: "payout_request",
        description: `Payout completed: ${existing.net_amount} cents (fee: ${existing.fee_amount})`,
      });
    } else {
      // Mark as failed
      const retryCount = (existing.retry_count || 0) + 1;

      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: PAYOUT_STATUSES.FAILED,
          failure_reason: providerResult.error || "Provider processing failed",
          retry_count: retryCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRequestId);

      await supabaseAdmin
        .from("payout_transactions")
        .update({
          status: "failed",
          failure_reason: providerResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Unlock funds
      const balance = await getEscrowBalance(existing.escrow_account_id);
      await supabaseAdmin
        .from("escrow_accounts")
        .update({
          available_balance: balance.available + existing.amount,
          locked_balance: Math.max(0, balance.locked - existing.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.escrow_account_id);

      logError("PayoutEngine", "Provider processing failed", {
        payoutRequestId,
        error: providerResult.error,
        retryCount,
      });

      return { success: false, error: `Payout failed: ${providerResult.error}` };
    }

    await logAuditEvent({
      eventType: "payout.processed",
      entityType: "payout_requests",
      entityId: payoutRequestId,
      userId: creatorId,
      action: "process_payout",
      details: { amount: existing.amount, netAmount: existing.net_amount, transactionId: transaction.id },
    });

    logInfo("PayoutEngine", "Payout processed", {
      payoutRequestId,
      transactionId: transaction.id,
    });

    return { success: true, data: { payoutRequest: { id: payoutRequestId, status: PAYOUT_STATUSES.COMPLETED }, transaction } };
  } catch (err) {
    logError("PayoutEngine", "Process payout error", { error: err.message });
    return { success: false, error: "Failed to process payout" };
  }
}

/**
 * Retry a failed payout.
 *
 * @param {string} payoutRequestId — Payout request ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function retryPayout(payoutRequestId) {
  try {
    if (!payoutRequestId) {
      return { success: false, error: "payoutRequestId is required" };
    }

    logInfo("PayoutEngine", "Retrying payout", { payoutRequestId });

    // Fetch existing payout
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payout_requests")
      .select("*")
      .eq("id", payoutRequestId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Payout request not found" };
    }

    if (existing.status !== PAYOUT_STATUSES.FAILED) {
      return { success: false, error: `Can only retry failed payouts. Current status: '${existing.status}'` };
    }

    if ((existing.retry_count || 0) >= PAYOUT_CONFIG.maxRetryAttempts) {
      return {
        success: false,
        error: `Maximum retry attempts (${PAYOUT_CONFIG.maxRetryAttempts}) reached. Please contact support.`,
      };
    }

    // Re-run fraud evaluation
    const fraudResult = await evaluateUser({
      userId: existing.creator_id,
      trigger: "payout_retry",
      context: { payoutRequestId, amount: existing.amount, attempt: (existing.retry_count || 0) + 1 },
    });

    if (!fraudResult.success) {
      return { success: false, error: "Retry evaluation failed. Please try again later." };
    }

    const fraudDecision = fraudResult.result?.decision?.action || "allow";

    if (fraudDecision === "block") {
      return { success: false, error: "Payout retry blocked by security check" };
    }

    // Reset status to approved for reprocessing
    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .update({
        status: PAYOUT_STATUSES.APPROVED,
        retry_count: (existing.retry_count || 0) + 1,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutRequestId)
      .select()
      .single();

    if (error) {
      logError("PayoutEngine", "Retry payout error", { error: error.message });
      return { success: false, error: "Failed to retry payout" };
    }

    await logAuditEvent({
      eventType: "payout.retry_initiated",
      entityType: "payout_requests",
      entityId: payoutRequestId,
      userId: existing.creator_id,
      action: "retry_payout",
      details: { attempt: data.retry_count, amount: existing.amount },
    });

    logInfo("PayoutEngine", "Payout retry initiated", {
      payoutRequestId,
      attempt: data.retry_count,
    });

    return { success: true, data };
  } catch (err) {
    logError("PayoutEngine", "Retry payout error", { error: err.message });
    return { success: false, error: "Failed to retry payout" };
  }
}

/**
 * Get payout history for a creator.
 *
 * @param {string} creatorId — Creator ID
 * @param {number} [limit=50] — Max results
 * @param {number} [offset=0] — Offset for pagination
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getPayoutHistory(creatorId, limit = PAYOUT_CONFIG.defaultLimit, offset = PAYOUT_CONFIG.defaultOffset) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("payout_requests")
      .select(`
        *,
        transactions: payout_transactions(id, status, provider_transaction_id, completed_at)
      `)
      .eq("creator_id", creatorId)
      .in("status", [PAYOUT_STATUSES.COMPLETED, PAYOUT_STATUSES.FAILED, PAYOUT_STATUSES.CANCELLED])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logError("PayoutEngine", "Get payout history error", { error: error.message });
      return { success: false, error: "Failed to fetch payout history" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("PayoutEngine", "Get payout history error", { error: err.message });
    return { success: false, error: "Failed to fetch payout history" };
  }
}

/**
 * Get creator's escrow balance breakdown.
 *
 * @param {string} creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCreatorBalance(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .select("id, campaign_id, available_balance, locked_balance, released_balance, status")
      .eq("creator_id", creatorId);

    if (error) {
      logError("PayoutEngine", "Get creator balance error", { error: error.message });
      return { success: false, error: "Failed to fetch creator balance" };
    }

    const accounts = data || [];

    const balance = {
      totalAvailable: 0,
      totalLocked: 0,
      totalReleased: 0,
      totalPending: 0,
      accounts: accounts.map((a) => ({
        escrowAccountId: a.id,
        campaignId: a.campaign_id,
        available: a.available_balance || 0,
        locked: a.locked_balance || 0,
        released: a.released_balance || 0,
        status: a.status,
      })),
    };

    for (const a of accounts) {
      balance.totalAvailable += a.available_balance || 0;
      balance.totalLocked += a.locked_balance || 0;
      balance.totalReleased += a.released_balance || 0;
    }

    // Get pending payout amount
    const { data: pendingPayouts } = await supabaseAdmin
      .from("payout_requests")
      .select("amount")
      .eq("creator_id", creatorId)
      .in("status", [PAYOUT_STATUSES.PENDING, PAYOUT_STATUSES.APPROVED, PAYOUT_STATUSES.PROCESSING]);

    for (const p of pendingPayouts || []) {
      balance.totalPending += p.amount || 0;
    }

    return { success: true, data: balance };
  } catch (err) {
    logError("PayoutEngine", "Get creator balance error", { error: err.message });
    return { success: false, error: "Failed to fetch creator balance" };
  }
}

// ─── Internal Helpers ───

/**
 * Get escrow balance for an account.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{available: number, locked: number, released: number}>}
 */
async function getEscrowBalance(escrowAccountId) {
  const { data } = await supabaseAdmin
    .from("escrow_accounts")
    .select("available_balance, locked_balance, released_balance")
    .eq("id", escrowAccountId)
    .single();

  return {
    available: data?.available_balance || 0,
    locked: data?.locked_balance || 0,
    released: data?.released_balance || 0,
  };
}

/**
 * Simulate provider processing (placeholder for real integration).
 *
 * @param {Object} payoutRequest — Payout request record
 * @param {Object} transaction — Transaction record
 * @returns {Promise<{success: boolean, transactionId?: string, error?: string}>}
 */
async function simulateProviderProcessing(payoutRequest, transaction) {
  // In production, replace with actual payment provider API call
  // e.g., Razorpay Payouts, Stripe Transfers, etc.
  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  };
}

// ─── Configuration Export ───

export { PAYOUT_STATUSES, PAYOUT_CONFIG };

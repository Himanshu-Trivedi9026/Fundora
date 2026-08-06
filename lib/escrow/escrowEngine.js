/**
 * Escrow Engine — Main orchestrator for the escrow system.
 *
 * Ties together milestone, payout, and donation flows:
 *   - Initializes escrow accounts for campaigns
 *   - Records incoming donations with ledger entries
 *   - Releases funds for approved milestones
 *   - Delegates payout requests to the payout engine
 *   - Provides full escrow summaries and creator earnings
 *
 * Features:
 *   - Idempotent donation recording (idempotency key support)
 *   - Ledger-based accounting (append-only)
 *   - Real-time balance tracking
 *   - Cross-campaign earnings aggregation
 *
 * Security:
 *   - All mutations are audit-logged
 *   - Idempotency keys prevent duplicate recordings
 *   - Balance updates use optimistic locking
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";
import { requestPayout as delegatePayout } from "../payout/payoutEngine";

// ─── Configuration ───

const ESCROW_STATUSES = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  LOCKED: "locked",
  CLOSED: "closed",
};

const LEDGER_TRANSACTION_TYPES = {
  DONATION_RECEIVED: "donation_received",
  MILESTONE_RELEASED: "milestone_released",
  PAYOUT_LOCKED: "payout_locked",
  PAYOUT_UNLOCKED: "payout_unlocked",
  PAYOUT_RELEASED: "payout_released",
  FEE_DEDUCTED: "fee_deducted",
  REFUND: "refund",
};

// ─── Core Functions ───

/**
 * Initialize an escrow account for a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID
 * @param {string} params.creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function initializeEscrow({ campaignId, creatorId }) {
  try {
    if (!campaignId || !creatorId) {
      return { success: false, error: "campaignId and creatorId are required" };
    }

    logInfo("EscrowEngine", "Initializing escrow", {
      campaignId,
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Check if escrow already exists for this campaign
    const { data: existing } = await supabaseAdmin
      .from("escrow_accounts")
      .select("id, status")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Escrow account already exists for this campaign",
      };
    }

    // Create escrow account
    const { data: escrow, error: insertError } = await supabaseAdmin
      .from("escrow_accounts")
      .insert({
        campaign_id: campaignId,
        creator_id: creatorId,
        status: ESCROW_STATUSES.ACTIVE,
        available_balance: 0,
        locked_balance: 0,
        released_balance: 0,
        total_deposited: 0,
        total_released: 0,
        total_payouts: 0,
      })
      .select()
      .single();

    if (insertError) {
      logError("EscrowEngine", "Create escrow error", {
        error: insertError.message,
      });
      return { success: false, error: "Failed to initialize escrow account" };
    }

    // Create initial ledger entry
    await supabaseAdmin.from("escrow_ledger").insert({
      escrow_account_id: escrow.id,
      transaction_type: "escrow_initialized",
      amount: 0,
      balance_after: 0,
      reference_id: campaignId,
      reference_type: "campaign",
      description: "Escrow account initialized",
    });

    await logAuditEvent({
      eventType: "escrow.initialized",
      entityType: "escrow_accounts",
      entityId: escrow.id,
      userId: creatorId,
      action: "initialize_escrow",
      details: { campaignId },
    });

    logInfo("EscrowEngine", "Escrow initialized", {
      escrowAccountId: escrow.id,
      campaignId,
    });

    return { success: true, data: escrow };
  } catch (err) {
    logError("EscrowEngine", "Initialize escrow error", { error: err.message });
    return { success: false, error: "Failed to initialize escrow account" };
  }
}

/**
 * Record an incoming donation in the escrow.
 * Creates a ledger entry and updates the escrow balance.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.campaignId — Campaign ID
 * @param {number} params.amount — Donation amount in cents
 * @param {string} params.donationId — Donation ID (for reference)
 * @param {string} [params.idempotencyKey] — Idempotency key to prevent duplicates
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function recordDonation({
  escrowAccountId,
  campaignId,
  amount,
  donationId,
  idempotencyKey,
}) {
  try {
    if (!escrowAccountId || !campaignId || !amount || !donationId) {
      return {
        success: false,
        error:
          "escrowAccountId, campaignId, amount, and donationId are required",
      };
    }

    if (amount <= 0) {
      return { success: false, error: "amount must be greater than 0" };
    }

    logInfo("EscrowEngine", "Recording donation", {
      escrowAccountId,
      campaignId,
      amount,
    });

    // Check idempotency — prevent duplicate recordings
    if (idempotencyKey) {
      const { data: existingEntry } = await supabaseAdmin
        .from("escrow_ledger")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingEntry) {
        logInfo(
          "EscrowEngine",
          "Duplicate donation detected (idempotent skip)",
          {
            idempotencyKey,
          },
        );
        return {
          success: true,
          data: { alreadyRecorded: true, ledgerEntryId: existingEntry.id },
        };
      }
    }

    // Fetch current escrow state with optimistic lock check
    const { data: escrow, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("id, status, available_balance, total_deposited")
      .eq("id", escrowAccountId)
      .single();

    if (fetchError || !escrow) {
      return { success: false, error: "Escrow account not found" };
    }

    if (escrow.status !== ESCROW_STATUSES.ACTIVE) {
      return {
        success: false,
        error: `Escrow account is not active (status: ${escrow.status})`,
      };
    }

    const newBalance = escrow.available_balance + amount;
    const newTotalDeposited = escrow.total_deposited + amount;

    // Update escrow balance
    const { error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        available_balance: newBalance,
        total_deposited: newTotalDeposited,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("available_balance", escrow.available_balance); // Optimistic lock

    if (updateError) {
      logError("EscrowEngine", "Update escrow balance error", {
        error: updateError.message,
      });
      return {
        success: false,
        error: "Failed to update escrow balance. Please retry.",
      };
    }

    // Create ledger entry
    const { data: ledgerEntry, error: ledgerError } = await supabaseAdmin
      .from("escrow_ledger")
      .insert({
        escrow_account_id: escrowAccountId,
        transaction_type: LEDGER_TRANSACTION_TYPES.DONATION_RECEIVED,
        amount,
        balance_after: newBalance,
        reference_id: donationId,
        reference_type: "donation",
        description: `Donation received: ${amount} cents`,
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .single();

    if (ledgerError) {
      logError("EscrowEngine", "Create ledger entry error", {
        error: ledgerError.message,
      });
      // Balance was updated but ledger entry failed — critical, but don't double-charge
      return { success: false, error: "Failed to record donation in ledger" };
    }

    await logAuditEvent({
      eventType: "escrow.donation_recorded",
      entityType: "escrow_accounts",
      entityId: escrowAccountId,
      action: "record_donation",
      details: { campaignId, amount, donationId, newBalance },
    });

    logInfo("EscrowEngine", "Donation recorded", {
      escrowAccountId,
      amount,
      newBalance,
      ledgerEntryId: ledgerEntry.id,
    });

    return { success: true, data: { ledgerEntry, newBalance } };
  } catch (err) {
    logError("EscrowEngine", "Record donation error", { error: err.message });
    return { success: false, error: "Failed to record donation" };
  }
}

/**
 * Release funds from escrow for an approved milestone.
 * Calls the release engine to transfer funds.
 *
 * @param {Object} params
 * @param {string} params.milestoneId — Milestone ID
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {number} params.amount — Amount to release in cents
 * @param {string} params.releasedBy — User ID who approved the release
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function releaseMilestoneFunds({
  milestoneId,
  escrowAccountId,
  amount,
  releasedBy,
}) {
  try {
    if (!milestoneId || !escrowAccountId || !amount || !releasedBy) {
      return {
        success: false,
        error:
          "milestoneId, escrowAccountId, amount, and releasedBy are required",
      };
    }

    if (amount <= 0) {
      return { success: false, error: "amount must be greater than 0" };
    }

    logInfo("EscrowEngine", "Releasing milestone funds", {
      milestoneId,
      escrowAccountId,
      amount,
      releasedBy: releasedBy.substring(0, 8) + "...",
    });

    // Fetch current escrow state
    const { data: escrow, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select(
        "id, status, available_balance, locked_balance, released_balance, total_released, creator_id",
      )
      .eq("id", escrowAccountId)
      .single();

    if (fetchError || !escrow) {
      return { success: false, error: "Escrow account not found" };
    }

    if (escrow.status !== ESCROW_STATUSES.ACTIVE) {
      return {
        success: false,
        error: `Escrow account is not active (status: ${escrow.status})`,
      };
    }

    if (escrow.available_balance < amount) {
      return {
        success: false,
        error: `Insufficient available balance. Available: ${escrow.available_balance}, Requested: ${amount}`,
      };
    }

    // Verify milestone exists and is in approved/completed status
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from("campaign_milestones")
      .select("id, status, title, approval_percentage")
      .eq("id", milestoneId)
      .single();

    if (milestoneError || !milestone) {
      return { success: false, error: "Milestone not found" };
    }

    if (milestone.status !== "approved" && milestone.status !== "completed") {
      return {
        success: false,
        error: `Cannot release funds for milestone in '${milestone.status}' status. Must be approved or completed.`,
      };
    }

    const newAvailableBalance = escrow.available_balance - amount;
    const newReleasedBalance = (escrow.released_balance || 0) + amount;
    const newTotalReleased = (escrow.total_released || 0) + amount;

    // Update escrow balance
    const { error: updateError } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        available_balance: newAvailableBalance,
        released_balance: newReleasedBalance,
        total_released: newTotalReleased,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("available_balance", escrow.available_balance); // Optimistic lock

    if (updateError) {
      logError("EscrowEngine", "Update escrow balance for release error", {
        error: updateError.message,
      });
      return {
        success: false,
        error: "Failed to update escrow balance. Please retry.",
      };
    }

    // Create ledger entry
    const { data: ledgerEntry, error: ledgerError } = await supabaseAdmin
      .from("escrow_ledger")
      .insert({
        escrow_account_id: escrowAccountId,
        transaction_type: LEDGER_TRANSACTION_TYPES.MILESTONE_RELEASED,
        amount: -amount,
        balance_after: newAvailableBalance,
        reference_id: milestoneId,
        reference_type: "milestone",
        description: `Milestone funds released: ${amount} cents for "${milestone.title}"`,
      })
      .select()
      .single();

    if (ledgerError) {
      logError("EscrowEngine", "Create release ledger entry error", {
        error: ledgerError.message,
      });
    }

    // Mark milestone as completed if it was only approved
    if (milestone.status === "approved") {
      await supabaseAdmin
        .from("campaign_milestones")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId);
    }

    await logAuditEvent({
      eventType: "escrow.funds_released",
      entityType: "escrow_accounts",
      entityId: escrowAccountId,
      userId: releasedBy,
      action: "release_milestone_funds",
      details: {
        milestoneId,
        amount,
        milestoneTitle: milestone.title,
        approvalPercentage: milestone.approval_percentage,
        newAvailableBalance,
      },
    });

    logInfo("EscrowEngine", "Milestone funds released", {
      escrowAccountId,
      milestoneId,
      amount,
      newAvailableBalance,
    });

    return { success: true, data: { ledgerEntry, newAvailableBalance } };
  } catch (err) {
    logError("EscrowEngine", "Release milestone funds error", {
      error: err.message,
    });
    return { success: false, error: "Failed to release milestone funds" };
  }
}

/**
 * Request a payout from escrow.
 * Delegates to the payout engine.
 *
 * @param {Object} params
 * @param {string} params.creatorId — Creator ID
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.bankAccountId — Bank account ID
 * @param {number} params.amount — Payout amount in cents
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function requestPayout({
  creatorId,
  escrowAccountId,
  bankAccountId,
  amount,
}) {
  try {
    if (!creatorId || !escrowAccountId || !bankAccountId || !amount) {
      return {
        success: false,
        error:
          "creatorId, escrowAccountId, bankAccountId, and amount are required",
      };
    }

    logInfo("EscrowEngine", "Requesting payout via escrow", {
      creatorId: creatorId.substring(0, 8) + "...",
      escrowAccountId,
      amount,
    });

    // Delegate to payout engine (which handles fraud checks, fee calculation, etc.)
    const result = await delegatePayout({
      creatorId,
      escrowAccountId,
      bankAccountId,
      amount,
    });

    if (!result.success) {
      logError("EscrowEngine", "Payout delegation failed", {
        error: result.error,
      });
      return result;
    }

    logInfo("EscrowEngine", "Payout requested via escrow", {
      payoutRequestId: result.data?.id,
      amount,
    });

    return result;
  } catch (err) {
    logError("EscrowEngine", "Request payout error", { error: err.message });
    return { success: false, error: "Failed to request payout" };
  }
}

/**
 * Get a full escrow summary for a campaign.
 * Includes balances, milestones, and recent ledger events.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getEscrowSummary(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    // Fetch escrow account
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    if (escrowError || !escrow) {
      return {
        success: false,
        error: "Escrow account not found for this campaign",
      };
    }

    // Fetch milestones
    const { data: milestones } = await supabaseAdmin
      .from("campaign_milestones")
      .select(
        "id, title, status, target_amount, release_amount, approval_percentage",
      )
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });

    // Fetch recent ledger entries (last 20)
    const { data: recentEvents } = await supabaseAdmin
      .from("escrow_ledger")
      .select(
        "id, transaction_type, amount, balance_after, description, created_at",
      )
      .eq("escrow_account_id", escrow.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch pending payout requests
    const { data: pendingPayouts } = await supabaseAdmin
      .from("payout_requests")
      .select("id, amount, net_amount, status, created_at")
      .eq("escrow_account_id", escrow.id)
      .in("status", ["pending", "approved", "processing"]);

    // Fetch campaign info
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, goal")
      .eq("id", campaignId)
      .single();

    const summary = {
      campaign: campaign || null,
      escrow: {
        id: escrow.id,
        status: escrow.status,
        availableBalance: escrow.available_balance || 0,
        lockedBalance: escrow.locked_balance || 0,
        releasedBalance: escrow.released_balance || 0,
        totalDeposited: escrow.total_deposited || 0,
        totalReleased: escrow.total_released || 0,
        totalPayouts: escrow.total_payouts || 0,
      },
      milestones: milestones || [],
      milestoneStats: {
        total: (milestones || []).length,
        completed: (milestones || []).filter((m) => m.status === "completed")
          .length,
        active: (milestones || []).filter((m) => m.status === "active").length,
        submitted: (milestones || []).filter((m) => m.status === "submitted")
          .length,
      },
      pendingPayouts: pendingPayouts || [],
      recentEvents: recentEvents || [],
    };

    return { success: true, data: summary };
  } catch (err) {
    logError("EscrowEngine", "Get escrow summary error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch escrow summary" };
  }
}

/**
 * Get all earnings for a creator across campaigns.
 *
 * @param {string} creatorId — Creator ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getCreatorEarnings(creatorId) {
  try {
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    logInfo("EscrowEngine", "Fetching creator earnings", {
      creatorId: creatorId.substring(0, 8) + "...",
    });

    // Fetch all escrow accounts for the creator
    const { data: escrows, error: escrowError } = await supabaseAdmin
      .from("escrow_accounts")
      .select(
        `
        id,
        campaign_id,
        available_balance,
        locked_balance,
        released_balance,
        total_deposited,
        total_released,
        status,
        campaign: campaigns(id, title)
      `,
      )
      .eq("creator_id", creatorId);

    if (escrowError) {
      logError("EscrowEngine", "Fetch creator escrows error", {
        error: escrowError.message,
      });
      return { success: false, error: "Failed to fetch creator earnings" };
    }

    // Fetch completed payout history
    const { data: completedPayouts } = await supabaseAdmin
      .from("payout_requests")
      .select("id, amount, net_amount, fee_amount, status, completed_at")
      .eq("creator_id", creatorId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    const earnings = {
      campaigns: (escrows || []).map((e) => ({
        escrowAccountId: e.id,
        campaignId: e.campaign_id,
        campaignTitle: e.campaign?.title || "Unknown",
        available: e.available_balance || 0,
        locked: e.locked_balance || 0,
        released: e.released_balance || 0,
        totalDeposited: e.total_deposited || 0,
        totalReleased: e.total_released || 0,
        status: e.status,
      })),
      totals: {
        totalDeposited: 0,
        totalAvailable: 0,
        totalLocked: 0,
        totalReleased: 0,
        totalPayoutsReceived: 0,
        totalFeesPaid: 0,
        campaignCount: (escrows || []).length,
      },
      recentPayouts: (completedPayouts || []).slice(0, 10),
    };

    // Aggregate totals
    for (const e of escrows || []) {
      earnings.totals.totalDeposited += e.total_deposited || 0;
      earnings.totals.totalAvailable += e.available_balance || 0;
      earnings.totals.totalLocked += e.locked_balance || 0;
      earnings.totals.totalReleased += e.released_balance || 0;
    }

    for (const p of completedPayouts || []) {
      earnings.totals.totalPayoutsReceived += p.net_amount || 0;
      earnings.totals.totalFeesPaid += p.fee_amount || 0;
    }

    logInfo("EscrowEngine", "Creator earnings fetched", {
      creatorId: creatorId.substring(0, 8) + "...",
      campaignCount: earnings.totals.campaignCount,
      totalDeposited: earnings.totals.totalDeposited,
    });

    return { success: true, data: earnings };
  } catch (err) {
    logError("EscrowEngine", "Get creator earnings error", {
      error: err.message,
    });
    return { success: false, error: "Failed to fetch creator earnings" };
  }
}

// ─── Configuration Export ───

export { ESCROW_STATUSES, LEDGER_TRANSACTION_TYPES };

/**
 * Escrow Account — CRUD operations for escrow accounts.
 *
 * Manages the lifecycle of escrow accounts tied to campaigns.
 *
 * Status flow:
 *   created → active → partially_released → fully_released
 *                        ↓                       ↓
 *                    refunded / cancelled    refunded / cancelled
 *                        ↓                       ↓
 *                      closed                  closed
 *
 * Any terminal state (fully_released, refunded, cancelled) → closed.
 *
 * Security:
 *   - All mutations are audit-logged
 *   - Status transitions are validated
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent, hashIP } from "../verification/auditLog";

// ─── Constants ───

/**
 * Valid escrow statuses.
 * @type {string[]}
 */
export const ESCROW_STATUSES = [
  "created",
  "active",
  "partially_released",
  "fully_released",
  "refunded",
  "cancelled",
  "closed",
  "frozen",
];

/**
 * Allowed status transitions.
 * Key: current status, Value: array of allowed next statuses.
 * 'any' key applies to all statuses.
 * @type {Object<string, string[]>}
 */
export const STATUS_TRANSITIONS = {
  created: ["active", "cancelled", "closed"],
  active: ["partially_released", "refunded", "cancelled", "frozen", "closed"],
  partially_released: ["fully_released", "refunded", "cancelled", "frozen", "closed"],
  fully_released: ["closed"],
  refunded: ["closed"],
  cancelled: ["closed"],
  frozen: ["active", "cancelled", "closed"],
};

// ─── Core Functions ───

/**
 * Create a new escrow account for a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID
 * @param {string} params.creatorId — Creator's user ID
 * @param {number} params.feePercentage — Platform fee percentage (0-100)
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function createEscrowAccount({ campaignId, creatorId, feePercentage }) {
  try {
    if (!campaignId || !creatorId) {
      return { success: false, error: "Campaign ID and creator ID are required" };
    }

    if (feePercentage === undefined || feePercentage === null) {
      return { success: false, error: "Fee percentage is required" };
    }

    if (typeof feePercentage !== "number" || feePercentage < 0 || feePercentage > 100) {
      return { success: false, error: "Fee percentage must be a number between 0 and 100" };
    }

    // Check for existing escrow account for this campaign
    const { data: existing } = await supabaseAdmin
      .from("escrow_accounts")
      .select("id")
      .eq("campaign_id", campaignId)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return { success: false, error: "Escrow account already exists for this campaign" };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .insert({
        campaign_id: campaignId,
        creator_id: creatorId,
        fee_percentage: feePercentage,
        status: "created",
        locked_balance: 0,
        released_balance: 0,
        refunded_balance: 0,
        creator_earnings: 0,
      })
      .select()
      .single();

    if (error) {
      logError("EscrowAccount", "Create error", { error: error.message, campaignId });
      return { success: false, error: "Failed to create escrow account" };
    }

    logInfo("EscrowAccount", "Escrow account created", {
      accountId: data.id,
      campaignId,
      creatorId,
    });

    await logAuditEvent({
      eventType: "escrow.account.created",
      entityType: "escrow_account",
      entityId: data.id,
      userId: creatorId,
      action: "create_escrow_account",
      details: { campaignId, feePercentage },
    });

    return { success: true, account: data };
  } catch (err) {
    logError("EscrowAccount", "Create error", { error: err.message });
    return { success: false, error: "Failed to create escrow account" };
  }
}

/**
 * Get an escrow account by ID.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function getEscrowAccount(escrowAccountId) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Escrow account not found" };
      }
      logError("EscrowAccount", "Fetch error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to fetch escrow account" };
    }

    return { success: true, account: data };
  } catch (err) {
    logError("EscrowAccount", "Fetch error", { error: err.message });
    return { success: false, error: "Failed to fetch escrow account" };
  }
}

/**
 * Get escrow account by campaign ID.
 *
 * @param {string} campaignId — Campaign ID
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function getEscrowAccountByCampaign(campaignId) {
  try {
    if (!campaignId) {
      return { success: false, error: "Campaign ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("campaign_id", campaignId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Escrow account not found for this campaign" };
      }
      logError("EscrowAccount", "Fetch by campaign error", { error: error.message, campaignId });
      return { success: false, error: "Failed to fetch escrow account" };
    }

    return { success: true, account: data };
  } catch (err) {
    logError("EscrowAccount", "Fetch by campaign error", { error: err.message });
    return { success: false, error: "Failed to fetch escrow account" };
  }
}

/**
 * List all escrow accounts for a creator.
 *
 * @param {string} creatorId — Creator's user ID
 * @param {Object} [params]
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @param {string} [params.status] — Filter by status
 * @returns {Promise<{success: boolean, accounts?: Object[], total?: number, error?: string}>}
 */
export async function getEscrowAccountsByCreator(creatorId, { limit = 50, offset = 0, status } = {}) {
  try {
    if (!creatorId) {
      return { success: false, error: "Creator ID is required" };
    }

    let query = supabaseAdmin
      .from("escrow_accounts")
      .select("*", { count: "exact" })
      .eq("creator_id", creatorId)
      .is("deleted_at", null);

    if (status) {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("EscrowAccount", "List by creator error", { error: error.message, creatorId });
      return { success: false, error: "Failed to fetch escrow accounts" };
    }

    return {
      success: true,
      accounts: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("EscrowAccount", "List by creator error", { error: err.message });
    return { success: false, error: "Failed to fetch escrow accounts" };
  }
}

/**
 * Validate whether a status transition is allowed.
 *
 * @param {string} currentStatus — Current escrow status
 * @param {string} newStatus — Desired new status
 * @returns {{valid: boolean, error?: string}}
 */
function validateStatusTransition(currentStatus, newStatus) {
  if (!ESCROW_STATUSES.includes(currentStatus)) {
    return { valid: false, error: `Invalid current status: ${currentStatus}` };
  }

  if (!ESCROW_STATUSES.includes(newStatus)) {
    return { valid: false, error: `Invalid target status: ${newStatus}` };
  }

  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'`,
    };
  }

  return { valid: true };
}

/**
 * Update escrow account status with validation.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @param {string} status — New status
 * @param {string} [reason] — Reason for status change
 * @param {string} [performedBy] — User ID of the actor
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function updateEscrowStatus(escrowAccountId, status, reason = null, performedBy = null) {
  try {
    if (!escrowAccountId || !status) {
      return { success: false, error: "Escrow account ID and status are required" };
    }

    // Fetch current account
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Escrow account not found" };
    }

    // Validate transition
    const validation = validateStatusTransition(current.status, status);
    if (!validation.valid) {
      logWarn("EscrowAccount", "Invalid status transition", {
        accountId: escrowAccountId,
        from: current.status,
        to: status,
      });
      return { success: false, error: validation.error };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", current.status) // Optimistic lock
      .select()
      .single();

    if (error) {
      logError("EscrowAccount", "Update status error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to update escrow status" };
    }

    logInfo("EscrowAccount", "Status updated", {
      accountId: escrowAccountId,
      from: current.status,
      to: status,
      reason,
      performedBy,
    });

    await logAuditEvent({
      eventType: "escrow.status.changed",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      userId: performedBy,
      action: "update_escrow_status",
      details: { fromStatus: current.status, toStatus: status, reason },
    });

    return { success: true, account: data };
  } catch (err) {
    logError("EscrowAccount", "Update status error", { error: err.message });
    return { success: false, error: "Failed to update escrow status" };
  }
}

/**
 * Freeze an escrow account. Prevents all operations until unfrozen.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @param {string} reason — Reason for freezing
 * @param {string} performedBy — User ID of the actor
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function freezeEscrowAccount(escrowAccountId, reason, performedBy) {
  try {
    if (!escrowAccountId || !reason || !performedBy) {
      return { success: false, error: "Escrow account ID, reason, and performedBy are required" };
    }

    const result = await updateEscrowStatus(escrowAccountId, "frozen", reason, performedBy);

    if (result.success) {
      logInfo("EscrowAccount", "Account frozen", {
        accountId: escrowAccountId,
        reason,
        performedBy,
      });
    }

    return result;
  } catch (err) {
    logError("EscrowAccount", "Freeze error", { error: err.message });
    return { success: false, error: "Failed to freeze escrow account" };
  }
}

/**
 * Unfreeze an escrow account. Returns it to active status.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @param {string} performedBy — User ID of the actor
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function unfreezeEscrowAccount(escrowAccountId, performedBy) {
  try {
    if (!escrowAccountId || !performedBy) {
      return { success: false, error: "Escrow account ID and performedBy are required" };
    }

    const result = await updateEscrowStatus(escrowAccountId, "active", "Account unfrozen", performedBy);

    if (result.success) {
      logInfo("EscrowAccount", "Account unfrozen", {
        accountId: escrowAccountId,
        performedBy,
      });
    }

    return result;
  } catch (err) {
    logError("EscrowAccount", "Unfreeze error", { error: err.message });
    return { success: false, error: "Failed to unfreeze escrow account" };
  }
}

/**
 * Close an escrow account. Only allowed if in a terminal state
 * (fully_released, refunded, cancelled).
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export async function closeEscrowAccount(escrowAccountId) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    // Fetch current account
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("*")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Escrow account not found" };
    }

    // Only allow closing from terminal states
    const terminalStates = ["fully_released", "refunded", "cancelled"];
    if (!terminalStates.includes(current.status)) {
      logWarn("EscrowAccount", "Cannot close non-terminal account", {
        accountId: escrowAccountId,
        currentStatus: current.status,
      });
      return {
        success: false,
        error: `Cannot close account in '${current.status}' status. Must be in a terminal state: ${terminalStates.join(", ")}`,
      };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_accounts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowAccountId)
      .eq("status", current.status) // Optimistic lock
      .select()
      .single();

    if (error) {
      logError("EscrowAccount", "Close error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to close escrow account" };
    }

    logInfo("EscrowAccount", "Account closed", {
      accountId: escrowAccountId,
      previousStatus: current.status,
    });

    await logAuditEvent({
      eventType: "escrow.account.closed",
      entityType: "escrow_account",
      entityId: escrowAccountId,
      action: "close_escrow_account",
      details: { previousStatus: current.status },
    });

    return { success: true, account: data };
  } catch (err) {
    logError("EscrowAccount", "Close error", { error: err.message });
    return { success: false, error: "Failed to close escrow account" };
  }
}

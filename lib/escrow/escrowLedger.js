/**
 * Escrow Ledger — Immutable append-only ledger for escrow transactions.
 *
 * CRITICAL: Ledger entries must NEVER be updated or deleted by the application.
 * All entries are permanent and auditable.
 *
 * Entry types:
 *   - deposit: Funds added to escrow (donations)
 *   - release: Funds released to creator
 *   - refund: Funds refunded to donors
 *   - fee: Platform fees deducted
 *   - adjustment: Manual balance adjustments (admin only)
 *
 * Security:
 *   - Idempotency keys prevent duplicate entries
 *   - All entries are audit-logged
 *   - Balance integrity is verified on demand
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Core Functions ───

/**
 * Append a ledger entry. Validates idempotency_key uniqueness before insert.
 * This function MUST only INSERT — never UPDATE or DELETE.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} params.campaignId — Campaign ID
 * @param {string} params.entryType — Entry type: 'deposit' | 'release' | 'refund' | 'fee' | 'adjustment'
 * @param {number} params.amount — Transaction amount (positive for credits, negative for debits)
 * @param {number} params.balanceAfter — Account balance after this entry
 * @param {string} [params.referenceType] — Reference entity type (e.g., 'donation', 'milestone', 'payout_request')
 * @param {string} [params.referenceId] — Reference entity ID
 * @param {string} [params.description] — Human-readable description
 * @param {string} [params.idempotencyKey] — Unique idempotency key to prevent duplicates
 * @param {Object} [params.metadata] — Additional metadata
 * @returns {Promise<{success: boolean, entry?: Object, error?: string}>}
 */
export async function createLedgerEntry({
  escrowAccountId,
  campaignId,
  entryType,
  amount,
  balanceAfter,
  referenceType = null,
  referenceId = null,
  description = null,
  idempotencyKey = null,
  metadata = {},
}) {
  try {
    if (!escrowAccountId || !campaignId || !entryType || amount === undefined || balanceAfter === undefined) {
      return {
        success: false,
        error: "escrowAccountId, campaignId, entryType, amount, and balanceAfter are required",
      };
    }

    const validEntryTypes = ["deposit", "release", "refund", "fee", "adjustment"];
    if (!validEntryTypes.includes(entryType)) {
      return {
        success: false,
        error: `Invalid entry type. Must be: ${validEntryTypes.join(", ")}`,
      };
    }

    if (typeof amount !== "number" || isNaN(amount)) {
      return { success: false, error: "Amount must be a valid number" };
    }

    if (typeof balanceAfter !== "number" || isNaN(balanceAfter)) {
      return { success: false, error: "balanceAfter must be a valid number" };
    }

    // Validate idempotency key uniqueness
    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("escrow_ledger")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existing) {
        logWarn("EscrowLedger", "Duplicate idempotency key detected", {
          idempotencyKey,
          existingEntryId: existing.id,
        });
        return { success: false, error: "Duplicate entry: idempotency key already exists" };
      }
    }

    // Sanitize metadata — remove sensitive fields
    const sanitizedMetadata = sanitizeMetadata(metadata);

    const { data, error } = await supabaseAdmin
      .from("escrow_ledger")
      .insert({
        escrow_account_id: escrowAccountId,
        campaign_id: campaignId,
        entry_type: entryType,
        amount,
        balance_after: balanceAfter,
        reference_type: referenceType,
        reference_id: referenceId,
        description,
        idempotency_key: idempotencyKey,
        metadata: sanitizedMetadata,
      })
      .select()
      .single();

    if (error) {
      logError("EscrowLedger", "Insert error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to create ledger entry" };
    }

    logInfo("EscrowLedger", "Ledger entry created", {
      entryId: data.id,
      escrowAccountId,
      entryType,
      amount,
      balanceAfter,
    });

    return { success: true, entry: data };
  } catch (err) {
    logError("EscrowLedger", "Insert error", { error: err.message });
    return { success: false, error: "Failed to create ledger entry" };
  }
}

/**
 * Query ledger entries with filters.
 *
 * @param {Object} params
 * @param {string} params.escrowAccountId — Escrow account ID
 * @param {string} [params.entryType] — Filter by entry type
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @param {string} [params.startDate] — Filter entries created after this date (ISO string)
 * @param {string} [params.endDate] — Filter entries created before this date (ISO string)
 * @returns {Promise<{success: boolean, entries?: Object[], total?: number, error?: string}>}
 */
export async function getLedgerEntries({
  escrowAccountId,
  entryType,
  limit = 50,
  offset = 0,
  startDate,
  endDate,
} = {}) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    let query = supabaseAdmin
      .from("escrow_ledger")
      .select("*", { count: "exact" })
      .eq("escrow_account_id", escrowAccountId);

    if (entryType) {
      query = query.eq("entry_type", entryType);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    query = query
      .order("created_at", { ascending: true }) // Chronological order for ledger
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("EscrowLedger", "Query error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to query ledger entries" };
    }

    return {
      success: true,
      entries: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("EscrowLedger", "Query error", { error: err.message });
    return { success: false, error: "Failed to query ledger entries" };
  }
}

/**
 * Calculate current balance from ledger entries.
 * Sums all amounts to derive the current escrow balance.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{success: boolean, balance?: number, error?: string}>}
 */
export async function getLedgerBalance(escrowAccountId) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    // Fetch all ledger entries — amounts are signed (positive = credit, negative = debit)
    const { data, error } = await supabaseAdmin
      .from("escrow_ledger")
      .select("amount")
      .eq("escrow_account_id", escrowAccountId)
      .order("created_at", { ascending: true });

    if (error) {
      logError("EscrowLedger", "Balance calculation error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to calculate ledger balance" };
    }

    const balance = (data || []).reduce((sum, entry) => sum + (entry.amount || 0), 0);

    return { success: true, balance: Math.round(balance * 100) / 100 };
  } catch (err) {
    logError("EscrowLedger", "Balance calculation error", { error: err.message });
    return { success: false, error: "Failed to calculate ledger balance" };
  }
}

/**
 * Get aggregated totals by entry type for an escrow account.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{success: boolean, summary?: Object, error?: string}>}
 */
export async function getLedgerSummary(escrowAccountId) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("escrow_ledger")
      .select("entry_type, amount")
      .eq("escrow_account_id", escrowAccountId)
      .order("created_at", { ascending: true });

    if (error) {
      logError("EscrowLedger", "Summary query error", { error: error.message, escrowAccountId });
      return { success: false, error: "Failed to generate ledger summary" };
    }

    const entries = data || [];
    const summary = {
      totalEntries: entries.length,
      byType: {},
      totalDeposits: 0,
      totalReleases: 0,
      totalRefunds: 0,
      totalFees: 0,
      totalAdjustments: 0,
      netBalance: 0,
    };

    entries.forEach((entry) => {
      if (!summary.byType[entry.entry_type]) {
        summary.byType[entry.entry_type] = { count: 0, total: 0 };
      }
      summary.byType[entry.entry_type].count += 1;
      summary.byType[entry.entry_type].total += entry.amount || 0;

      switch (entry.entry_type) {
        case "deposit":
          summary.totalDeposits += entry.amount || 0;
          break;
        case "release":
          summary.totalReleases += Math.abs(entry.amount || 0);
          break;
        case "refund":
          summary.totalRefunds += Math.abs(entry.amount || 0);
          break;
        case "fee":
          summary.totalFees += Math.abs(entry.amount || 0);
          break;
        case "adjustment":
          summary.totalAdjustments += entry.amount || 0;
          break;
      }

      summary.netBalance += entry.amount || 0;
    });

    // Round all totals to 2 decimal places
    summary.totalDeposits = Math.round(summary.totalDeposits * 100) / 100;
    summary.totalReleases = Math.round(summary.totalReleases * 100) / 100;
    summary.totalRefunds = Math.round(summary.totalRefunds * 100) / 100;
    summary.totalFees = Math.round(summary.totalFees * 100) / 100;
    summary.totalAdjustments = Math.round(summary.totalAdjustments * 100) / 100;
    summary.netBalance = Math.round(summary.netBalance * 100) / 100;

    return { success: true, summary };
  } catch (err) {
    logError("EscrowLedger", "Summary error", { error: err.message });
    return { success: false, error: "Failed to generate ledger summary" };
  }
}

/**
 * Validate ledger integrity by comparing calculated balance
 * with the escrow account's stored locked_balance.
 *
 * @param {string} escrowAccountId — Escrow account ID
 * @returns {Promise<{success: boolean, valid?: boolean, details?: Object, error?: string}>}
 */
export async function validateLedgerIntegrity(escrowAccountId) {
  try {
    if (!escrowAccountId) {
      return { success: false, error: "Escrow account ID is required" };
    }

    // Fetch escrow account
    const { data: account, error: accountError } = await supabaseAdmin
      .from("escrow_accounts")
      .select("locked_balance, released_balance, refunded_balance")
      .eq("id", escrowAccountId)
      .is("deleted_at", null)
      .single();

    if (accountError || !account) {
      return { success: false, error: "Escrow account not found" };
    }

    // Calculate balance from ledger
    const balanceResult = await getLedgerBalance(escrowAccountId);
    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error };
    }

    // Calculate expected balance from account fields
    const expectedBalance =
      (account.locked_balance || 0) - (account.released_balance || 0) - (account.refunded_balance || 0);

    const calculatedBalance = balanceResult.balance;
    const valid = Math.abs(calculatedBalance - expectedBalance) < 0.01; // Tolerance for floating point

    const details = {
      calculatedBalance,
      expectedBalance,
      lockedBalance: account.locked_balance,
      releasedBalance: account.released_balance,
      refundedBalance: account.refunded_balance,
      difference: Math.round((calculatedBalance - expectedBalance) * 100) / 100,
    };

    if (!valid) {
      logWarn("EscrowLedger", "Ledger integrity check failed", {
        escrowAccountId,
        ...details,
      });
    }

    return { success: true, valid, details };
  } catch (err) {
    logError("EscrowLedger", "Integrity check error", { error: err.message });
    return { success: false, error: "Failed to validate ledger integrity" };
  }
}

// ─── Helpers ───

/**
 * Sanitize metadata before storage — remove sensitive fields.
 * @param {Object} metadata
 * @returns {Object}
 */
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};

  const safe = { ...metadata };
  delete safe.ip_address;
  delete safe.session_token;
  delete safe.encryption_key;
  delete safe.api_key;
  delete safe.secret;
  delete safe.password;

  return safe;
}

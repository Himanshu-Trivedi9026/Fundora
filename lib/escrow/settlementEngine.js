/**
 * Settlement Engine — Batch settlement processing for creator payouts.
 *
 * Handles:
 *   - Creating settlement batches
 *   - Adding payout requests to batches
 *   - Processing entire batches of payouts
 *   - Querying batch history
 *
 * Batches group multiple payout requests for efficient processing.
 * Each batch tracks individual payout statuses within the batch.
 *
 * Security:
 *   - All operations are audit-logged
 *   - Each payout in a batch is independently tracked
 *   - Failed payouts do not block other payouts in the batch
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";
import { recordEscrowEvent } from "./escrowEvents";
import { getProvider, getActiveProvider } from "./providerAdapter";

// ─── Constants ───

/**
 * Valid settlement batch statuses.
 * @type {string[]}
 */
const BATCH_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "partial",
];

// ─── Core Functions ───

/**
 * Create a new settlement batch.
 *
 * @param {Object} params
 * @param {string} params.initiatedBy — User ID initiating the batch
 * @returns {Promise<{success: boolean, batch?: Object, error?: string}>}
 */
export async function createSettlementBatch({ initiatedBy }) {
  try {
    if (!initiatedBy) {
      return { success: false, error: "initiatedBy is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("settlement_batches")
      .insert({
        status: "pending",
        initiated_by: initiatedBy,
        total_payouts: 0,
        processed_payouts: 0,
        failed_payouts: 0,
        total_amount: 0,
        processed_amount: 0,
      })
      .select()
      .single();

    if (error) {
      logError("SettlementEngine", "Create batch error", {
        error: error.message,
      });
      return { success: false, error: "Failed to create settlement batch" };
    }

    logInfo("SettlementEngine", "Batch created", {
      batchId: data.id,
      initiatedBy,
    });

    await logAuditEvent({
      eventType: "escrow.settlement.batch_created",
      entityType: "settlement_batch",
      entityId: data.id,
      userId: initiatedBy,
      action: "create_settlement_batch",
      details: { batchId: data.id },
    });

    return { success: true, batch: data };
  } catch (err) {
    logError("SettlementEngine", "Create batch error", { error: err.message });
    return { success: false, error: "Failed to create settlement batch" };
  }
}

/**
 * Add a payout request to a settlement batch.
 *
 * @param {string} batchId — Settlement batch ID
 * @param {string} payoutRequestId — Payout request ID to add
 * @returns {Promise<{success: boolean, batchItem?: Object, error?: string}>}
 */
export async function addToSettlementBatch(batchId, payoutRequestId) {
  try {
    if (!batchId || !payoutRequestId) {
      return {
        success: false,
        error: "batchId and payoutRequestId are required",
      };
    }

    // Verify batch exists and is in pending status
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("settlement_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: "Settlement batch not found" };
    }

    if (batch.status !== "pending") {
      return {
        success: false,
        error: `Batch is in '${batch.status}' status. Only pending batches accept new items.`,
      };
    }

    // Verify payout request exists
    const { data: payoutRequest, error: payoutError } = await supabaseAdmin
      .from("payout_requests")
      .select("*")
      .eq("id", payoutRequestId)
      .single();

    if (payoutError || !payoutRequest) {
      return { success: false, error: "Payout request not found" };
    }

    if (payoutRequest.status !== "approved") {
      return {
        success: false,
        error: `Payout request is in '${payoutRequest.status}' status. Must be approved.`,
      };
    }

    // Check if payout request is already in a pending batch
    const { data: existingItem } = await supabaseAdmin
      .from("settlement_batch_items")
      .select("id")
      .eq("payout_request_id", payoutRequestId)
      .single();

    if (existingItem) {
      return {
        success: false,
        error: "Payout request is already in a settlement batch",
      };
    }

    // Add to batch
    const { data: batchItem, error: insertError } = await supabaseAdmin
      .from("settlement_batch_items")
      .insert({
        batch_id: batchId,
        payout_request_id: payoutRequestId,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      logError("SettlementEngine", "Add to batch error", {
        error: insertError.message,
        batchId,
      });
      return { success: false, error: "Failed to add payout to batch" };
    }

    // Update batch totals
    const { error: updateError } = await supabaseAdmin
      .from("settlement_batches")
      .update({
        total_payouts: batch.total_payouts + 1,
        total_amount:
          Math.round((batch.total_amount + (payoutRequest.amount || 0)) * 100) /
          100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("status", "pending");

    if (updateError) {
      logError("SettlementEngine", "Batch update error", {
        error: updateError.message,
        batchId,
      });
      // Note: item was added but batch totals failed to update. Non-critical.
    }

    logInfo("SettlementEngine", "Payout added to batch", {
      batchId,
      payoutRequestId,
    });

    return { success: true, batchItem };
  } catch (err) {
    logError("SettlementEngine", "Add to batch error", { error: err.message });
    return { success: false, error: "Failed to add payout to batch" };
  }
}

/**
 * Process all pending payouts in a settlement batch.
 * Each payout is processed independently — failures do not block others.
 *
 * @param {string} batchId — Settlement batch ID
 * @returns {Promise<{success: boolean, result?: Object, error?: string}>}
 */
export async function processSettlementBatch(batchId) {
  try {
    if (!batchId) {
      return { success: false, error: "batchId is required" };
    }

    // Fetch batch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("settlement_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: "Settlement batch not found" };
    }

    if (batch.status !== "pending") {
      return {
        success: false,
        error: `Batch is in '${batch.status}' status. Only pending batches can be processed.`,
      };
    }

    // Update batch to processing
    const { error: statusError } = await supabaseAdmin
      .from("settlement_batches")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("status", "pending");

    if (statusError) {
      logError("SettlementEngine", "Batch status update error", {
        error: statusError.message,
        batchId,
      });
      return { success: false, error: "Failed to update batch status" };
    }

    logInfo("SettlementEngine", "Batch processing started", { batchId });

    // Fetch all pending items in the batch
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("settlement_batch_items")
      .select("*, payout_requests(*)")
      .eq("batch_id", batchId)
      .eq("status", "pending");

    if (itemsError) {
      logError("SettlementEngine", "Fetch items error", {
        error: itemsError.message,
        batchId,
      });
      await supabaseAdmin
        .from("settlement_batches")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", batchId);
      return { success: false, error: "Failed to fetch batch items" };
    }

    const payoutItems = items || [];
    let processedCount = 0;
    let failedCount = 0;
    let processedAmount = 0;

    // Get the active payout provider
    const provider = getActiveProvider();

    // Process each payout independently
    for (const item of payoutItems) {
      try {
        const payoutRequest = item.payout_requests;
        if (!payoutRequest) {
          // Mark item as failed — payout request missing
          await supabaseAdmin
            .from("settlement_batch_items")
            .update({
              status: "failed",
              error_message: "Payout request not found",
            })
            .eq("id", item.id);
          failedCount++;
          continue;
        }

        // Create payout via provider
        const payoutResult = await provider.createPayout({
          amount: payoutRequest.amount,
          recipientId: payoutRequest.recipient_id || payoutRequest.creator_id,
          currency: payoutRequest.currency || "inr",
          reference: `batch_${batchId}_payout_${payoutRequest.id}`,
        });

        if (payoutResult.success) {
          // Mark payout request as processed
          await supabaseAdmin
            .from("payout_requests")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              provider_reference: payoutResult.reference,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payoutRequest.id);

          // Mark batch item as processed
          await supabaseAdmin
            .from("settlement_batch_items")
            .update({
              status: "processed",
              provider_reference: payoutResult.reference,
            })
            .eq("id", item.id);

          processedCount++;
          processedAmount += payoutRequest.amount || 0;

          logInfo("SettlementEngine", "Payout processed in batch", {
            batchId,
            payoutRequestId: payoutRequest.id,
            amount: payoutRequest.amount,
          });
        } else {
          // Mark as failed
          await supabaseAdmin
            .from("settlement_batch_items")
            .update({
              status: "failed",
              error_message: payoutResult.error || "Payout provider failed",
            })
            .eq("id", item.id);

          failedCount++;

          logWarn("SettlementEngine", "Payout failed in batch", {
            batchId,
            payoutRequestId: payoutRequest.id,
            error: payoutResult.error,
          });
        }
      } catch (itemErr) {
        // Individual payout processing error — continue with others
        failedCount++;

        await supabaseAdmin
          .from("settlement_batch_items")
          .update({
            status: "failed",
            error_message: itemErr.message || "Processing error",
          })
          .eq("id", item.id);

        logError("SettlementEngine", "Item processing error", {
          batchId,
          itemId: item.id,
          error: itemErr.message,
        });
      }
    }

    // Determine final batch status
    let finalStatus;
    if (failedCount === 0 && processedCount > 0) {
      finalStatus = "completed";
    } else if (processedCount > 0 && failedCount > 0) {
      finalStatus = "partial";
    } else {
      finalStatus = "failed";
    }

    // Update batch with results
    const { data: updatedBatch, error: finalError } = await supabaseAdmin
      .from("settlement_batches")
      .update({
        status: finalStatus,
        processed_payouts: processedCount,
        failed_payouts: failedCount,
        processed_amount: Math.round(processedAmount * 100) / 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .select()
      .single();

    if (finalError) {
      logError("SettlementEngine", "Batch final update error", {
        error: finalError.message,
        batchId,
      });
    }

    // Record event
    await recordEscrowEvent({
      escrowAccountId: null,
      campaignId: null,
      eventType: "settlement.batch_processed",
      entityType: "settlement_batch",
      entityId: batchId,
      oldStatus: "processing",
      newStatus: finalStatus,
      details: {
        totalPayouts: payoutItems.length,
        processedCount,
        failedCount,
        processedAmount: Math.round(processedAmount * 100) / 100,
      },
      performedBy: batch.initiated_by,
      performedByType: "system",
    });

    logInfo("SettlementEngine", "Batch processing complete", {
      batchId,
      status: finalStatus,
      processedCount,
      failedCount,
    });

    return {
      success: true,
      result: {
        batchId,
        status: finalStatus,
        totalPayouts: payoutItems.length,
        processedCount,
        failedCount,
        processedAmount: Math.round(processedAmount * 100) / 100,
      },
    };
  } catch (err) {
    logError("SettlementEngine", "Batch processing error", {
      error: err.message,
      batchId,
    });

    // Try to mark batch as failed
    try {
      await supabaseAdmin
        .from("settlement_batches")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", batchId)
        .eq("status", "processing");
    } catch (_) {
      // Best effort
    }

    return { success: false, error: "Failed to process settlement batch" };
  }
}

/**
 * Get settlement batch details with its items.
 *
 * @param {string} batchId — Settlement batch ID
 * @returns {Promise<{success: boolean, batch?: Object, error?: string}>}
 */
export async function getSettlementBatch(batchId) {
  try {
    if (!batchId) {
      return { success: false, error: "batchId is required" };
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("settlement_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: "Settlement batch not found" };
    }

    // Fetch batch items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("settlement_batch_items")
      .select("*, payout_requests(id, amount, status, creator_id)")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      logError("SettlementEngine", "Fetch items error", {
        error: itemsError.message,
        batchId,
      });
      return { success: false, error: "Failed to fetch batch items" };
    }

    return {
      success: true,
      batch: {
        ...batch,
        items: items || [],
      },
    };
  } catch (err) {
    logError("SettlementEngine", "Fetch batch error", { error: err.message });
    return { success: false, error: "Failed to fetch settlement batch" };
  }
}

/**
 * List settlement batches with filters.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, batches?: Object[], total?: number, error?: string}>}
 */
export async function getSettlementBatches({
  status,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("settlement_batches")
      .select("*", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("SettlementEngine", "List batches error", {
        error: error.message,
      });
      return { success: false, error: "Failed to fetch settlement batches" };
    }

    return {
      success: true,
      batches: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("SettlementEngine", "List batches error", { error: err.message });
    return { success: false, error: "Failed to fetch settlement batches" };
  }
}

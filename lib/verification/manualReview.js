/**
 * Manual Review Architecture — Admin review workflow for verification requests.
 *
 * Handles: assign reviewer, approve, reject, queue management, priority.
 * All operations log to verification_audit_log.
 *
 * Review priority: urgent → high → normal → low
 *
 * Security:
 *   - Every function accepts an optional callerId for admin role check
 *   - getRequestDetails sanitizes metadata (strips device_info, ip_address)
 *   - getReviewQueue strips metadata from responses
 *   - approveRequest/rejectRequest sanitize notes/reason in audit log
 *   - All console.log replaced with structured secureLogger
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logAuditEvent } from "./auditLog";
import { logInfo, logError } from "./secureLogger";
import { sanitizeVerificationRequest } from "./metadataEncryption";
import { sendNotification, NOTIFICATION_TYPES } from "../notification";

// ─── Authorization Helper ───

/**
 * Verify that a user has an admin or reviewer role.
 * Uses RLS-compatible query: checks creator_verifications for admin role,
 * OR checks a dedicated admin_roles table if it exists.
 *
 * For now, uses a simple pattern: callerId must be provided and non-empty.
 * In production, this should check against an admin/roles table.
 *
 * @param {string} callerId — ID of the user performing the action
 * @returns {boolean}
 */
function requireAdminRole(callerId) {
  if (
    !callerId ||
    typeof callerId !== "string" ||
    callerId.trim().length === 0
  ) {
    return false;
  }
  // In production, query an admin/roles table here:
  // const { data } = await supabaseAdmin.from('admin_roles').select('id').eq('user_id', callerId).single();
  // return !!data;
  return true;
}

// ─── Response Sanitization ───

/**
 * Sanitize metadata in a review queue item.
 * Removes device_info, ip_address, provider_reference from metadata JSON.
 *
 * @param {Object} item — Raw DB row
 * @returns {Object} Sanitized item
 */
function sanitizeQueueItem(item) {
  if (!item) return item;
  const safe = { ...item };

  // Strip device metadata and IP from metadata JSON
  if (safe.metadata && typeof safe.metadata === "object") {
    const {
      device_info,
      device_metadata,
      ip_address,
      provider_reference,
      ...safeMeta
    } = safe.metadata;
    safe.metadata = safeMeta;
  }

  return safe;
}

/**
 * Sanitize a request detail response for admin review.
 * Strips: provider_reference, device_metadata, ip_address from metadata.
 *
 * @param {Object} request — Raw DB row
 * @returns {Object} Sanitized request
 */
function sanitizeRequestDetail(request) {
  if (!request) return request;
  return sanitizeVerificationRequest(request);
}

// ─── Core Functions ───

/**
 * Assign a reviewer to a verification request.
 *
 * @param {string} requestId
 * @param {string} reviewerId — Admin user ID
 * @param {string} [priority] — Review priority
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function assignReviewer(
  requestId,
  reviewerId,
  priority = null,
  callerId = null,
) {
  try {
    if (!requestId || !reviewerId) {
      return {
        success: false,
        error: "Request ID and reviewer ID are required",
      };
    }

    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized assign attempt", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const updateData = {
      reviewer_id: reviewerId,
      status: "under_review",
    };

    if (priority) {
      updateData.review_priority = priority;
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, review_priority")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: "Request not found" };
    }

    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update(updateData)
      .eq("id", requestId);

    if (error) {
      logError("ManualReview", "Assign error", { error: error.message });
      return { success: false, error: "Failed to assign reviewer" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "verification.manual_review_assigned",
      entityType: "verification_request",
      entityId: requestId,
      userId: request.user_id,
      action: "manual_review_assigned",
      details: { reviewerId, priority: priority || request.review_priority },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Assign error", { error: err.message });
    return { success: false, error: "Failed to assign reviewer" };
  }
}

/**
 * Approve a verification request.
 *
 * @param {string} requestId
 * @param {string} reviewerId
 * @param {string} [notes] — Review notes (sanitized in audit log)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function approveRequest(
  requestId,
  reviewerId,
  notes = null,
  callerId = null,
) {
  try {
    if (!requestId || !reviewerId) {
      return {
        success: false,
        error: "Request ID and reviewer ID are required",
      };
    }

    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized approve attempt", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, verification_type")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: "Request not found" };
    }

    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({
        status: "approved",
        reviewer_id: reviewerId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      logError("ManualReview", "Approve error", { error: error.message });
      return { success: false, error: "Failed to approve request" };
    }

    // Audit log — sanitize notes (truncate to 500 chars, no PII)
    const sanitizedNotes = notes ? notes.substring(0, 500) : null;
    await logAuditEvent({
      eventType: "verification.manual_review_completed",
      entityType: "verification_request",
      entityId: requestId,
      userId: request.user_id,
      action: "manual_review_completed",
      details: { decision: "approved", reviewerId, notes: sanitizedNotes },
    });

    // Update creator_verifications based on type
    await updateCreatorVerification(
      request.user_id,
      request.verification_type,
      "approved",
    );

    // Notify the creator via the in-app notification system
    await sendNotification({
      userId: request.user_id,
      notificationType: NOTIFICATION_TYPES.VERIFICATION_APPROVED,
      actorId: reviewerId,
      entityId: requestId,
      data: {
        verificationType: request.verification_type,
        decision: "approved",
      },
    }).catch((err) =>
      logError("ManualReview", "Approve notification failed", {
        error: err.message,
      }),
    );

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Approve error", { error: err.message });
    return { success: false, error: "Failed to approve request" };
  }
}

/**
 * Reject a verification request.
 *
 * @param {string} requestId
 * @param {string} reviewerId
 * @param {string} reason — Rejection reason (sanitized in audit log)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function rejectRequest(
  requestId,
  reviewerId,
  reason,
  callerId = null,
) {
  try {
    if (!requestId || !reviewerId || !reason) {
      return {
        success: false,
        error: "Request ID, reviewer ID, and reason are required",
      };
    }

    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized reject attempt", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, verification_type")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: "Request not found" };
    }

    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({
        status: "rejected",
        reviewer_id: reviewerId,
        rejection_reason: reason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      logError("ManualReview", "Reject error", { error: error.message });
      return { success: false, error: "Failed to reject request" };
    }

    // Audit log — sanitize reason (truncate to 500 chars)
    const sanitizedReason = reason.substring(0, 500);
    await logAuditEvent({
      eventType: "verification.manual_review_completed",
      entityType: "verification_request",
      entityId: requestId,
      userId: request.user_id,
      action: "manual_review_completed",
      details: { decision: "rejected", reviewerId, reason: sanitizedReason },
    });

    // Sync the creator's overall verification status
    await updateCreatorVerification(
      request.user_id,
      request.verification_type,
      "rejected",
    );

    // Notify the creator
    await sendNotification({
      userId: request.user_id,
      notificationType: NOTIFICATION_TYPES.VERIFICATION_REJECTED,
      actorId: reviewerId,
      entityId: requestId,
      data: {
        verificationType: request.verification_type,
        decision: "rejected",
        reason: sanitizedReason,
      },
    }).catch((err) =>
      logError("ManualReview", "Reject notification failed", {
        error: err.message,
      }),
    );

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Reject error", { error: err.message });
    return { success: false, error: "Failed to reject request" };
  }
}

/**
 * Get the review queue (admin pending requests).
 * Ordered by priority (urgent → high → normal → low), then submitted_at ASC.
 * Response metadata is sanitized — no device_info, ip_address, or provider_reference.
 *
 * @param {Object} params
 * @param {string} [params.priority] — Filter by priority
 * @param {string} [params.status] — Filter by status (default: under_review)
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @param {string} [params.callerId] — Admin user ID (for authorization)
 * @returns {Promise<{success: boolean, requests?: Object[], total?: number, error?: string}>}
 */
export async function getReviewQueue({
  priority,
  status = "under_review",
  limit = 20,
  offset = 0,
  callerId = null,
} = {}) {
  try {
    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized queue access", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    // Priority sort order
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };

    let query = supabaseAdmin.from("verification_requests").select(
      `
        id, user_id, verification_type, status, review_priority,
        submitted_at, created_at, metadata
        `,
      { count: "exact" },
    );

    if (status) {
      // "pending" on the dashboard surfaces every request awaiting review:
      // wizard submissions arrive as "submitted", older rows as "pending".
      const statuses =
        status === "pending" ? ["submitted", "pending"] : [status];
      query = query.in("status", statuses);
    }
    if (priority) query = query.eq("review_priority", priority);

    query = query
      .order("submitted_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ManualReview", "Queue error", { error: error.message });
      return { success: false, error: "Failed to get review queue" };
    }

    // Sort by priority in JS (Supabase can't sort by custom enum order)
    const sorted = (data || []).map(sanitizeQueueItem).sort((a, b) => {
      const pa = priorityOrder[a.review_priority] ?? 2;
      const pb = priorityOrder[b.review_priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.submitted_at) - new Date(b.submitted_at);
    });

    // Enrich each request with creator identity, documents, history, and the
    // creator's current overall verification status.
    const enriched = await enrichQueueItems(sorted);

    return {
      success: true,
      requests: enriched,
      total: count || 0,
    };
  } catch (err) {
    logError("ManualReview", "Queue error", { error: err.message });
    return { success: false, error: "Failed to get review queue" };
  }
}

/**
 * Enrich review-queue items with creator-facing fields the admin dashboard
 * needs: full name + email (identity), submitted documents, verification
 * history, and the creator's current overall verification status.
 *
 * Batches lookups by user id so a page of queue items costs a fixed number of
 * queries rather than one per row.
 *
 * @param {Object[]} items — Queue items (must each have user_id)
 * @returns {Promise<Object[]>} — Enriched items (identity is best-effort; a
 *   missing profile/creator row is tolerated, the request still appears)
 */
async function enrichQueueItems(items) {
  if (!items || items.length === 0) return items || [];

  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
  if (userIds.length === 0) return items;

  // 1. Creator identity: full_name from profiles, name + email from creators.
  let profilesById = {};
  let creatorsByUserId = {};
  try {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    profilesById = new Map((profiles || []).map((p) => [p.id, p]));
  } catch {
    // Profiles may be absent for legacy users — tolerate and continue.
  }

  try {
    const { data: creators } = await supabaseAdmin
      .from("creators")
      .select("user_id, name, email")
      .in("user_id", userIds);
    creatorsByUserId = new Map((creators || []).map((c) => [c.user_id, c]));
  } catch {
    // Creators rows are optional — tolerate and continue.
  }

  // 2. Submitted documents (masked, no raw storage path).
  let docsByUser = {};
  try {
    const { data: documents } = await supabaseAdmin
      .from("verification_documents")
      .select(
        "id, user_id, document_type, document_name, mime_type, status, uploaded_at, verified_at",
      )
      .in("user_id", userIds)
      .order("uploaded_at", { ascending: false })
      .limit(500);
    docsByUser = groupBy(documents || [], (d) => d.user_id);
  } catch {
    // Documents are best-effort.
  }

  // 3. Verification history (immutable status-change trail).
  let historyByUser = {};
  try {
    const { data: history } = await supabaseAdmin
      .from("verification_history")
      .select(
        "id, action, new_status, new_level, created_at, reason, performed_by",
      )
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(500);
    historyByUser = groupBy(history || [], (h) => h.user_id);
  } catch {
    // History is best-effort.
  }

  // 4. Current overall verification status.
  let statusByUser = {};
  try {
    const { data: verifications } = await supabaseAdmin
      .from("creator_verifications")
      .select(
        "user_id, verification_status, verification_level, identity_verified, verified_at",
      )
      .in("user_id", userIds);
    statusByUser = new Map((verifications || []).map((v) => [v.user_id, v]));
  } catch {
    // Current status is best-effort.
  }

  // 5. Admin audit trail per user (who acted, when, and why).
  let auditByUser = {};
  try {
    const { data: auditEntries } = await supabaseAdmin
      .from("verification_audit_log")
      .select("id, event_type, entity_type, action, details, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(500);
    auditByUser = groupBy(auditEntries || [], (a) => a.user_id);
  } catch {
    // Audit trail is best-effort.
  }

  return items.map((item) => {
    const profile = profilesById.get(item.user_id);
    const creator = creatorsByUserId.get(item.user_id);
    const current = statusByUser.get(item.user_id);

    return {
      ...item,
      full_name: profile?.full_name || creator?.name || null,
      email: creator?.email || null,
      documents: (docsByUser[item.user_id] || []).map(sanitizeDocumentSummary),
      history: (historyByUser[item.user_id] || []).map(sanitizeHistorySummary),
      audit: auditByUser[item.user_id] || [],
      current_status: current?.verification_status || item.status || null,
      current_level: current?.verification_level ?? null,
      identity_verified: current?.identity_verified ?? null,
      verified_at: current?.verified_at || null,
    };
  });
}

/**
 * Group an array of rows by a key getter into a plain object of arrays.
 */
function groupBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    (out[key] = out[key] || []).push(row);
  }
  return out;
}

/**
 * Strip storage metadata from a document summary. Never exposes the raw
 * storage path — only what the admin review panel needs.
 */
function sanitizeDocumentSummary(doc) {
  if (!doc) return null;
  const { storage_bucket, storage_path, provider_reference, ...safe } = doc;
  return safe;
}

/**
 * Normalize a verification_history row for the timeline UI.
 */
function sanitizeHistorySummary(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    action: entry.action,
    new_status: entry.new_status,
    new_level: entry.new_level,
    created_at: entry.created_at,
    reason: entry.reason,
    reviewer: entry.performed_by || null,
  };
}

/**
 * Get full details for a verification request.
 * Response is sanitized — no provider_reference, device_metadata, or raw IP.
 *
 * @param {string} requestId
 * @param {string} [callerId] — Admin user ID (for authorization)
 * @returns {Promise<{success: boolean, request?: Object, error?: string}>}
 */
export async function getRequestDetails(requestId, callerId = null) {
  try {
    if (!requestId) {
      return { success: false, error: "Request ID is required" };
    }

    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized details access", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    // Select specific fields instead of SELECT *
    const { data, error } = await supabaseAdmin
      .from("verification_requests")
      .select(
        "id, user_id, verification_type, current_step, status, provider, " +
          "reviewer_id, review_priority, submitted_at, completed_at, " +
          "rejection_reason, metadata, created_at, updated_at",
      )
      .eq("id", requestId)
      .single();

    if (error || !data) {
      return { success: false, error: "Request not found" };
    }

    // Sanitize the request response
    const sanitizedRequest = sanitizeRequestDetail(data);

    // Get associated documents — specific fields only
    const { data: documents } = await supabaseAdmin
      .from("verification_documents")
      .select(
        "id, user_id, document_type, document_name, mime_type, status, uploaded_at, verified_at",
      )
      .eq("verification_id", data.id || "");

    // Get history — specific fields only
    const { data: history } = await supabaseAdmin
      .from("verification_history")
      .select("action, new_status, new_level, created_at, reason")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      success: true,
      request: {
        ...sanitizedRequest,
        documents: documents || [],
        history: history || [],
      },
    };
  } catch (err) {
    logError("ManualReview", "Details error", { error: err.message });
    return { success: false, error: "Failed to get request details" };
  }
}

/**
 * Update review priority for a request.
 *
 * @param {string} requestId
 * @param {string} priority — New priority (low|normal|high|urgent)
 * @param {string} [callerId] — Admin user ID (for authorization)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateReviewPriority(
  requestId,
  priority,
  callerId = null,
) {
  try {
    if (!requestId || !priority) {
      return { success: false, error: "Request ID and priority are required" };
    }

    // Authorization check
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized priority update", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const validPriorities = ["low", "normal", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return {
        success: false,
        error: `Invalid priority. Must be: ${validPriorities.join(", ")}`,
      };
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, review_priority")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: "Request not found" };
    }

    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({ review_priority: priority })
      .eq("id", requestId);

    if (error) {
      logError("ManualReview", "Priority update error", {
        error: error.message,
      });
      return { success: false, error: "Failed to update priority" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "verification.review_priority_changed",
      entityType: "verification_request",
      entityId: requestId,
      userId: request.user_id,
      action: "review_priority_changed",
      details: { oldPriority: request.review_priority, newPriority: priority },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Priority update error", { error: err.message });
    return { success: false, error: "Failed to update priority" };
  }
}

// ─── Helpers ───

/**
 * Update creator_verifications after an admin decision.
 * Maps verification_type to the appropriate flag (approve), and mirrors the
 * decision onto verification_status for every action so the creator's overall
 * verification state stays in sync with the request they submitted.
 *
 * Decision → status mapping:
 *   approved  → flag set true,  verification_status "approved"
 *   rejected  → verification_status "rejected"
 *   resubmitted → verification_status "pending" (creator may resubmit)
 *   suspended → verification_status "suspended"
 *   cancelled → verification_status "cancelled"
 */
async function updateCreatorVerification(userId, verificationType, decision) {
  if (!userId) return;

  const statusMap = {
    approved: "approved",
    rejected: "rejected",
    resubmitted: "pending",
    suspended: "suspended",
    cancelled: "cancelled",
  };

  const updateData = {};

  // Approve sets the type-specific flag and timestamps.
  if (decision === "approved") {
    const flagMap = {
      phone: { flag: "phone_verified", level: 1 },
      identity: { flag: "identity_verified", level: 2 },
      bank: { flag: "bank_verified", level: 3 },
      business: { flag: "business_verified", level: 4 },
      selfie: { flag: "selfie_verified", level: 5 },
    };

    const type = flagMap[verificationType];
    if (type) {
      updateData[type.flag] = true;
      updateData.verification_level = type.level;
    }
    updateData.verified_at = new Date().toISOString();
  }

  // Always sync the overall status so reject/suspend/resubmit are reflected.
  updateData.verification_status =
    statusMap[decision] || updateData.verification_status;

  await supabaseAdmin
    .from("creator_verifications")
    .update(updateData)
    .eq("user_id", userId);
}

// ─── Business Verification Review ───

/**
 * Approve a business verification.
 *
 * @param {string} verificationId — creator_verifications ID
 * @param {string} reviewerId — Admin user ID
 * @param {string} [notes] — Review notes (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function approveBusinessVerification(
  verificationId,
  reviewerId,
  notes = null,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId) {
      return {
        success: false,
        error: "Verification ID and reviewer ID are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized business approve", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id, status")
      .eq("id", verificationId)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: "Business verification not found" };
    }

    // Update business verification status
    const { error } = await supabaseAdmin
      .from("business_verifications")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        reviewer_id: reviewerId,
      })
      .eq("id", verificationId);

    if (error) {
      logError("ManualReview", "Business approve error", {
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to approve business verification",
      };
    }

    // Update creator_verifications flag
    await supabaseAdmin
      .from("creator_verifications")
      .update({
        business_verified: true,
        verification_level: 5,
        verified_at: new Date().toISOString(),
      })
      .eq("user_id", record.user_id);

    // Audit log
    const sanitizedNotes = notes ? notes.substring(0, 500) : null;
    await logAuditEvent({
      eventType: "business_verification.approved",
      entityType: "business_verification",
      entityId: verificationId,
      userId: record.user_id,
      action: "business_verification_approved",
      details: { reviewerId, notes: sanitizedNotes },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Business approve error", { error: err.message });
    return { success: false, error: "Failed to approve business verification" };
  }
}

/**
 * Reject a business verification.
 *
 * @param {string} verificationId — creator_verifications ID
 * @param {string} reviewerId — Admin user ID
 * @param {string} reason — Rejection reason (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function rejectBusinessVerification(
  verificationId,
  reviewerId,
  reason,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId || !reason) {
      return {
        success: false,
        error: "Verification ID, reviewer ID, and reason are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized business reject", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id")
      .eq("id", verificationId)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: "Business verification not found" };
    }

    const sanitizedReason = reason.substring(0, 500);

    const { error } = await supabaseAdmin
      .from("business_verifications")
      .update({
        status: "rejected",
        rejection_reason: sanitizedReason,
        reviewer_id: reviewerId,
      })
      .eq("id", verificationId);

    if (error) {
      logError("ManualReview", "Business reject error", {
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to reject business verification",
      };
    }

    // Audit log
    await logAuditEvent({
      eventType: "business_verification.rejected",
      entityType: "business_verification",
      entityId: verificationId,
      userId: record.user_id,
      action: "business_verification_rejected",
      details: { reviewerId, reason: sanitizedReason },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Business reject error", { error: err.message });
    return { success: false, error: "Failed to reject business verification" };
  }
}

// ─── Bank Verification Review ───

/**
 * Approve a bank verification.
 *
 * @param {string} verificationId — bank_verifications ID
 * @param {string} reviewerId — Admin user ID
 * @param {string} [notes] — Review notes (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function approveBankVerification(
  verificationId,
  reviewerId,
  notes = null,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId) {
      return {
        success: false,
        error: "Verification ID and reviewer ID are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized bank approve", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from("bank_verifications")
      .select("id, user_id, status")
      .eq("id", verificationId)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: "Bank verification not found" };
    }

    // Update bank verification status
    const { error } = await supabaseAdmin
      .from("bank_verifications")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        reviewer_id: reviewerId,
      })
      .eq("id", verificationId);

    if (error) {
      logError("ManualReview", "Bank approve error", { error: error.message });
      return { success: false, error: "Failed to approve bank verification" };
    }

    // Update all linked bank accounts to verified
    await supabaseAdmin
      .from("bank_accounts")
      .update({ status: "verified" })
      .eq("user_id", record.user_id)
      .eq("status", "pending");

    // Update creator_verifications flag
    await supabaseAdmin
      .from("creator_verifications")
      .update({
        bank_verified: true,
        verification_level: 4,
        verified_at: new Date().toISOString(),
      })
      .eq("user_id", record.user_id);

    // Audit log
    const sanitizedNotes = notes ? notes.substring(0, 500) : null;
    await logAuditEvent({
      eventType: "bank_verification.approved",
      entityType: "bank_verification",
      entityId: verificationId,
      userId: record.user_id,
      action: "bank_verification_approved",
      details: { reviewerId, notes: sanitizedNotes },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Bank approve error", { error: err.message });
    return { success: false, error: "Failed to approve bank verification" };
  }
}

/**
 * Reject a bank verification.
 *
 * @param {string} verificationId — bank_verifications ID
 * @param {string} reviewerId — Admin user ID
 * @param {string} reason — Rejection reason (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function rejectBankVerification(
  verificationId,
  reviewerId,
  reason,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId || !reason) {
      return {
        success: false,
        error: "Verification ID, reviewer ID, and reason are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized bank reject", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from("bank_verifications")
      .select("id, user_id")
      .eq("id", verificationId)
      .maybeSingle();

    if (fetchError || !record) {
      return { success: false, error: "Bank verification not found" };
    }

    const sanitizedReason = reason.substring(0, 500);

    const { error } = await supabaseAdmin
      .from("bank_verifications")
      .update({
        status: "rejected",
        rejection_reason: sanitizedReason,
        reviewer_id: reviewerId,
      })
      .eq("id", verificationId);

    if (error) {
      logError("ManualReview", "Bank reject error", { error: error.message });
      return { success: false, error: "Failed to reject bank verification" };
    }

    // Reject pending bank accounts
    await supabaseAdmin
      .from("bank_accounts")
      .update({ status: "rejected" })
      .eq("user_id", record.user_id)
      .eq("status", "pending");

    // Audit log
    await logAuditEvent({
      eventType: "bank_verification.rejected",
      entityType: "bank_verification",
      entityId: verificationId,
      userId: record.user_id,
      action: "bank_verification_rejected",
      details: { reviewerId, reason: sanitizedReason },
    });

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Bank reject error", { error: err.message });
    return { success: false, error: "Failed to reject bank verification" };
  }
}

/**
 * Request resubmission for a verification.
 *
 * @param {string} verificationId — Any verification ID
 * @param {string} reviewerId — Admin user ID
 * @param {string} reason — Resubmission reason (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function requestResubmission(
  verificationId,
  reviewerId,
  reason,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId || !reason) {
      return {
        success: false,
        error: "Verification ID, reviewer ID, and reason are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized resubmission request", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const sanitizedReason = reason.substring(0, 500);

    // Try business_verifications first
    const { data: bizRecord } = await supabaseAdmin
      .from("business_verifications")
      .select("id, user_id")
      .eq("id", verificationId)
      .maybeSingle();

    if (bizRecord) {
      await supabaseAdmin
        .from("business_verifications")
        .update({
          status: "resubmission_requested",
          rejection_reason: sanitizedReason,
          reviewer_id: reviewerId,
        })
        .eq("id", verificationId);

      await logAuditEvent({
        eventType: "business_verification.resubmission_requested",
        entityType: "business_verification",
        entityId: verificationId,
        userId: bizRecord.user_id,
        action: "resubmission_requested",
        details: { reviewerId, reason: sanitizedReason },
      });

      return { success: true };
    }

    // Try bank_verifications
    const { data: bankRecord } = await supabaseAdmin
      .from("bank_verifications")
      .select("id, user_id")
      .eq("id", verificationId)
      .maybeSingle();

    if (bankRecord) {
      await supabaseAdmin
        .from("bank_verifications")
        .update({
          status: "resubmission_requested",
          rejection_reason: sanitizedReason,
          reviewer_id: reviewerId,
        })
        .eq("id", verificationId);

      await logAuditEvent({
        eventType: "bank_verification.resubmission_requested",
        entityType: "bank_verification",
        entityId: verificationId,
        userId: bankRecord.user_id,
        action: "resubmission_requested",
        details: { reviewerId, reason: sanitizedReason },
      });

      return { success: true };
    }

    // Try verification_requests (identity)
    const { data: identityRecord } = await supabaseAdmin
      .from("verification_requests")
      .select("id, user_id, verification_type, status")
      .eq("id", verificationId)
      .maybeSingle();

    if (identityRecord) {
      await supabaseAdmin
        .from("verification_requests")
        .update({
          status: "documents_uploaded",
          rejection_reason: sanitizedReason,
          reviewer_id: reviewerId,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", verificationId);

      await logAuditEvent({
        eventType: "verification.resubmission_requested",
        entityType: "verification_request",
        entityId: verificationId,
        userId: identityRecord.user_id,
        action: "resubmission_requested",
        details: {
          reviewerId,
          reason: sanitizedReason,
          verificationType: identityRecord.verification_type,
        },
      });

      // Sync the creator's overall status back to pending for resubmission
      await updateCreatorVerification(
        identityRecord.user_id,
        identityRecord.verification_type,
        "resubmitted",
      );

      // Notify the creator
      await sendNotification({
        userId: identityRecord.user_id,
        notificationType:
          NOTIFICATION_TYPES.VERIFICATION_RESUBMISSION_REQUESTED,
        actorId: reviewerId,
        entityId: verificationId,
        data: {
          verificationType: identityRecord.verification_type,
          reason: sanitizedReason,
        },
      }).catch((err) =>
        logError("ManualReview", "Resubmission notification failed", {
          error: err.message,
        }),
      );

      return { success: true };
    }

    return { success: false, error: "Verification record not found" };
  } catch (err) {
    logError("ManualReview", "Resubmission error", { error: err.message });
    return { success: false, error: "Failed to request resubmission" };
  }
}

/**
 * Suspend a verification. Halts the review and blocks the creator's overall
 * verification state (verification_status "suspended" → isCreatorVerified
 * returns false → publish/funds gated).
 *
 * @param {string} verificationId — verification_requests ID (identity)
 * @param {string} reviewerId — Admin user ID
 * @param {string} reason — Suspension reason (truncated to 500 chars)
 * @param {string} [callerId] — ID of the user performing this action (admin check)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function suspendVerification(
  verificationId,
  reviewerId,
  reason = null,
  callerId = null,
) {
  try {
    if (!verificationId || !reviewerId) {
      return {
        success: false,
        error: "Verification ID and reviewer ID are required",
      };
    }

    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized suspend attempt", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("verification_requests")
      .select("user_id, verification_type")
      .eq("id", verificationId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: "Request not found" };
    }

    const sanitizedReason = reason ? reason.substring(0, 500) : null;

    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({
        status: "cancelled",
        reviewer_id: reviewerId,
        rejection_reason: sanitizedReason,
        completed_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    if (error) {
      logError("ManualReview", "Suspend error", { error: error.message });
      return { success: false, error: "Failed to suspend verification" };
    }

    // Sync the creator's overall verification status to suspended
    await updateCreatorVerification(
      request.user_id,
      request.verification_type,
      "suspended",
    );

    // Audit log
    await logAuditEvent({
      eventType: "verification.suspended",
      entityType: "verification_request",
      entityId: verificationId,
      userId: request.user_id,
      action: "verification_suspended",
      details: {
        reviewerId,
        reason: sanitizedReason,
        verificationType: request.verification_type,
      },
    });

    // Notify the creator
    await sendNotification({
      userId: request.user_id,
      notificationType: NOTIFICATION_TYPES.VERIFICATION_SUSPENDED,
      actorId: reviewerId,
      entityId: verificationId,
      data: {
        verificationType: request.verification_type,
        reason: sanitizedReason,
      },
    }).catch((err) =>
      logError("ManualReview", "Suspend notification failed", {
        error: err.message,
      }),
    );

    return { success: true };
  } catch (err) {
    logError("ManualReview", "Suspend error", { error: err.message });
    return { success: false, error: "Failed to suspend verification" };
  }
}

// ─── Business/Bank Review Queues ───

/**
 * Get business verification review queue.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status (default: pending)
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @param {string} [params.callerId] — Admin user ID
 * @returns {Promise<{success: boolean, records?: Object[], total?: number, error?: string}>}
 */
export async function getBusinessReviewQueue({
  status = "pending",
  limit = 20,
  offset = 0,
  callerId = null,
} = {}) {
  try {
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized business queue access", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    let query = supabaseAdmin
      .from("business_verifications")
      .select(
        "id, user_id, business_name, business_type, status, verified_at, rejection_reason, created_at",
        { count: "exact" },
      );

    if (status) query = query.eq("status", status);

    query = query
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ManualReview", "Business queue error", {
        error: error.message,
      });
      return { success: false, error: "Failed to get business review queue" };
    }

    // Enrich with creator identity, documents, history, and current status.
    const enriched = await enrichQueueItems(data || []);

    return {
      success: true,
      records: enriched,
      total: count || 0,
    };
  } catch (err) {
    logError("ManualReview", "Business queue error", { error: err.message });
    return { success: false, error: "Failed to get business review queue" };
  }
}

/**
 * Get bank verification review queue.
 *
 * @param {Object} params
 * @param {string} [params.status] — Filter by status (default: pending)
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @param {string} [params.callerId] — Admin user ID
 * @returns {Promise<{success: boolean, records?: Object[], total?: number, error?: string}>}
 */
export async function getBankReviewQueue({
  status = "pending",
  limit = 20,
  offset = 0,
  callerId = null,
} = {}) {
  try {
    if (callerId && !requireAdminRole(callerId)) {
      logError("ManualReview", "Unauthorized bank queue access", {
        callerId: callerId.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: admin role required" };
    }

    let query = supabaseAdmin
      .from("bank_verifications")
      .select(
        "id, user_id, status, total_accounts, verified_accounts, verified_at, rejection_reason, created_at",
        { count: "exact" },
      );

    if (status) query = query.eq("status", status);

    query = query
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("ManualReview", "Bank queue error", { error: error.message });
      return { success: false, error: "Failed to get bank review queue" };
    }

    // Enrich with creator identity, documents, history, and current status.
    const enriched = await enrichQueueItems(data || []);

    return {
      success: true,
      records: enriched,
      total: count || 0,
    };
  } catch (err) {
    logError("ManualReview", "Bank queue error", { error: err.message });
    return { success: false, error: "Failed to get bank review queue" };
  }
}

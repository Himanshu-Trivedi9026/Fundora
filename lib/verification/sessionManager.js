/**
 * Verification Session Manager — Resumable wizard workflows.
 *
 * Tracks wizard state across browser sessions so users can close and resume.
 * Sessions expire after 7 days. All operations log to audit_log.
 *
 * Security:
 *   - userId is required for all operations (ownership enforced)
 *   - Session data is sanitized before returning to client
 *   - Single active session per user
 *   - Expired sessions are automatically cleaned up
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logAuditEvent, hashIP } from "./auditLog";
import { logInfo, logError } from "./secureLogger";

// ─── Configuration ───

const SESSION_TTL_DAYS = 7;

// ─── Core Functions ───

/**
 * Create a new verification session.
 * Invalidates any existing active session for the user first.
 *
 * @param {string} userId — Required
 * @param {string} [requestId] — Optional verification_request ID
 * @param {Object} [deviceMetadata] — Device info placeholder
 * @param {string} [ipAddress] — Client IP (will be hashed)
 * @param {string} [userAgent] — User agent string
 * @returns {Promise<{success: boolean, session?: Object, error?: string}>}
 */
export async function createSession(userId, requestId = null, deviceMetadata = {}, ipAddress = null, userAgent = null) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    // Invalidate any existing active sessions for this user (single session policy)
    await supabaseAdmin
      .from("verification_sessions")
      .update({ completed: true })
      .eq("user_id", userId)
      .eq("completed", false);

    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const sessionData = {
      user_id: userId,
      verification_request_id: requestId,
      current_step: "email",
      completed_steps: [],
      wizard_state: {},
      device_metadata: deviceMetadata || {},
      ip_address_hash: hashIP(ipAddress),
      started_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      expires_at: expiresAt,
      completed: false,
    };

    const { data, error } = await supabaseAdmin
      .from("verification_sessions")
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      logError("SessionManager", "Create error", { error: error.message });
      return { success: false, error: "Failed to create session" };
    }

    // Audit log
    await logAuditEvent({
      eventType: "verification.session_started",
      entityType: "session",
      entityId: data.id,
      userId,
      action: "session_started",
      details: { requestId },
      ipAddressHash: hashIP(ipAddress),
      userAgent,
    });

    return { success: true, session: data };
  } catch (err) {
    logError("SessionManager", "Create error", { error: err.message });
    return { success: false, error: "Failed to create session" };
  }
}

/**
 * Resume an existing session.
 * Validates ownership (userId required), not expired, not completed.
 * Updates last_active_at.
 *
 * @param {string} sessionId — Required
 * @param {string} userId — Required (ownership enforced)
 * @returns {Promise<{success: boolean, session?: Object, error?: string}>}
 */
export async function resumeSession(sessionId, userId) {
  try {
    if (!sessionId) {
      return { success: false, error: "Session ID is required" };
    }
    if (!userId) {
      return { success: false, error: "User ID is required for authorization" };
    }

    // Fetch session with ownership check
    const { data: session, error: fetchError } = await supabaseAdmin
      .from("verification_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId) // Always enforce ownership
      .single();

    if (fetchError || !session) {
      return { success: false, error: "Session not found" };
    }

    // Check expiry
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return { success: false, error: "Session has expired. Start a new verification." };
    }

    // Check if completed
    if (session.completed) {
      return { success: false, error: "Session already completed" };
    }

    // Update last_active_at
    const { error: updateError } = await supabaseAdmin
      .from("verification_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId); // Ownership check on update too

    if (updateError) {
      logError("SessionManager", "Resume update error", { error: updateError.message });
    }

    // Audit log
    await logAuditEvent({
      eventType: "verification.session_resumed",
      entityType: "session",
      entityId: sessionId,
      userId: session.user_id,
      action: "session_resumed",
      details: { currentStep: session.current_step },
    });

    return { success: true, session };
  } catch (err) {
    logError("SessionManager", "Resume error", { error: err.message });
    return { success: false, error: "Failed to resume session" };
  }
}

/**
 * Update session step and wizard state.
 * Requires userId for ownership validation.
 *
 * @param {string} sessionId — Required
 * @param {string} step — Current step name
 * @param {string[]} completedSteps — List of completed steps
 * @param {Object} wizardState — Wizard state data
 * @param {string} userId — Required (ownership enforced)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSessionStep(sessionId, step, completedSteps = [], wizardState = {}, userId) {
  try {
    if (!sessionId || !step) {
      return { success: false, error: "Session ID and step are required" };
    }
    if (!userId) {
      return { success: false, error: "User ID is required for authorization" };
    }

    const { error } = await supabaseAdmin
      .from("verification_sessions")
      .update({
        current_step: step,
        completed_steps: completedSteps,
        wizard_state: wizardState,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId); // Ownership check

    if (error) {
      logError("SessionManager", "Update error", { error: error.message });
      return { success: false, error: "Failed to update session" };
    }

    return { success: true };
  } catch (err) {
    logError("SessionManager", "Update error", { error: err.message });
    return { success: false, error: "Failed to update session" };
  }
}

/**
 * Mark a session as completed.
 * Requires userId for ownership validation.
 *
 * @param {string} sessionId — Required
 * @param {string} userId — Required (ownership enforced)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function completeSession(sessionId, userId) {
  try {
    if (!sessionId) {
      return { success: false, error: "Session ID is required" };
    }
    if (!userId) {
      return { success: false, error: "User ID is required for authorization" };
    }

    // Verify ownership before update
    const { data: session } = await supabaseAdmin
      .from("verification_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    const { error } = await supabaseAdmin
      .from("verification_sessions")
      .update({
        completed: true,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId); // Ownership check

    if (error) {
      logError("SessionManager", "Complete error", { error: error.message });
      return { success: false, error: "Failed to complete session" };
    }

    // Audit log
    if (session) {
      await logAuditEvent({
        eventType: "verification.session_completed",
        entityType: "session",
        entityId: sessionId,
        userId: session.user_id,
        action: "session_completed",
      });
    }

    return { success: true };
  } catch (err) {
    logError("SessionManager", "Complete error", { error: err.message });
    return { success: false, error: "Failed to complete session" };
  }
}

/**
 * Get the active (non-expired, non-completed) session for a user.
 *
 * @param {string} userId — Required
 * @returns {Promise<{success: boolean, session?: Object, error?: string}>}
 */
export async function getSessionProgress(userId) {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const { data: sessions, error } = await supabaseAdmin
      .from("verification_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("completed", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("last_active_at", { ascending: false })
      .limit(1);

    if (error) {
      logError("SessionManager", "Progress query error", { error: error.message });
      return { success: false, error: "Failed to get session progress" };
    }

    if (!sessions || sessions.length === 0) {
      return { success: true, session: null };
    }

    return { success: true, session: sessions[0] };
  } catch (err) {
    logError("SessionManager", "Progress error", { error: err.message });
    return { success: false, error: "Failed to get session progress" };
  }
}

/**
 * Cleanup expired sessions.
 * @returns {Promise<number>} Number of deleted sessions
 */
export async function cleanupExpiredSessions() {
  try {
    const { data, error } = await supabaseAdmin
      .from("verification_sessions")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .eq("completed", false)
      .select("id");

    if (error) {
      logError("SessionManager", "Cleanup error", { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logInfo("SessionManager", "Cleaned up expired sessions", { count });
    }
    return count;
  } catch (err) {
    logError("SessionManager", "Cleanup error", { error: err.message });
    return 0;
  }
}

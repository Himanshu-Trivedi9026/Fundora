/**
 * Verification Session API — Real wizard session persistence.
 *
 * Wraps the existing lib/verification/sessionManager.js (server-side) with
 * the caller's real user.id. The client wizard never calls the session lib
 * directly (it used to, with a hardcoded "current-user-id" — broken).
 *
 *   GET              → resume the caller's active session (if any)
 *   POST             → create a new session (invalidates the old one)
 *   PATCH            → update current step / completed steps / wizard state
 *   DELETE           → complete the session AND upsert a verification_requests
 *                      row so the submission flows into the existing admin
 *                      review flow (manualReview.getReviewQueue reads
 *                      verification_requests).
 *
 * All sessionManager calls pass user.id for ownership enforcement.
 */

import { withAuth } from "../../../lib/withAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { rateLimit } from "../../../lib/rateLimit";
import {
  createSession,
  resumeSession,
  updateSessionStep,
  completeSession,
  getSessionProgress,
} from "../../../lib/verification/sessionManager";
import { logAuditEvent } from "../../../lib/verification/auditLog";
import { hashIP } from "../../../lib/verification/auditLog";

// Per-user sliding window (wizard steps are user-paced; 60/min is generous
// for a full multi-step flow while still bounding abuse of the endpoint).
const rl = rateLimit({ windowMs: 60_000, max: 60 });

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Upsert a verification_requests row for the user so the submission shows up
 * in the existing admin review queue. Reuses the existing table + lifecycle —
 * this is the request record, not a new creation mechanism.
 */
async function upsertVerificationRequest(
  userId,
  verificationId,
  metadata = {},
) {
  const { data: existing } = await supabaseAdmin
    .from("verification_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("verification_type", "identity")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("verification_requests")
      .update({
        current_step: "complete",
        status: "submitted",
        submitted_at: new Date().toISOString(),
        verification_id: verificationId || undefined,
        metadata: { ...(existing.metadata || {}), ...metadata },
      })
      .eq("id", existing.id);
    return { error };
  }

  const { error } = await supabaseAdmin.from("verification_requests").insert({
    user_id: userId,
    verification_id: verificationId || null,
    verification_type: "identity",
    current_step: "complete",
    status: "submitted",
    submitted_at: new Date().toISOString(),
    metadata,
  });
  return { error };
}

export default withAuth(async function handler(req, res, user) {
  const ipAddress = clientIp(req);

  // Rate limit (keyed per-user via the Authorization token).
  if (!rl(req, res)) return;

  try {
    // ─── GET — resume ───
    if (req.method === "GET") {
      const result = await getSessionProgress(user.id);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      return res.status(200).json({ success: true, session: result.session });
    }

    // ─── POST — create ───
    if (req.method === "POST") {
      const { requestId, deviceMetadata } = req.body || {};
      const result = await createSession(
        user.id,
        requestId || null,
        deviceMetadata || {},
        ipAddress,
        req.headers["user-agent"],
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(201).json({ success: true, session: result.session });
    }

    // ─── PATCH — update step ───
    if (req.method === "PATCH") {
      const { sessionId, step, completedSteps, wizardState } = req.body || {};
      if (!sessionId || !step) {
        return res
          .status(400)
          .json({ error: "sessionId and step are required" });
      }
      const result = await updateSessionStep(
        sessionId,
        step,
        completedSteps || [],
        wizardState || {},
        user.id,
      );
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(200).json({ success: true });
    }

    // ─── DELETE — complete ───
    if (req.method === "DELETE") {
      const { sessionId, action } = req.body || {};

      if (action === "complete" || req.query.action === "complete") {
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId is required" });
        }

        // Require at least one uploaded document before accepting a submission.
        // The wizard always uploads documents first; a bare "complete" call must
        // not fabricate a reviewable request (would flood the admin review queue
        // with empty submissions and let a creator "complete" the flow with no
        // evidence).
        const { count, error: docCountError } = await supabaseAdmin
          .from("verification_documents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!docCountError && count === 0) {
          return res.status(400).json({ error: "No documents uploaded yet" });
        }

        const result = await completeSession(sessionId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        // Upsert the verification_requests row into the existing review flow.
        const { data: verification } = await supabaseAdmin
          .from("creator_verifications")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const { error: requestError } = await upsertVerificationRequest(
          user.id,
          verification?.id || null,
          { submitted_via: "wizard" },
        );
        if (requestError) {
          console.error(
            "Session complete: request upsert failed:",
            requestError.message,
          );
        }

        await logAuditEvent({
          eventType: "verification.submitted",
          entityType: "session",
          entityId: sessionId,
          userId: user.id,
          action: "verification_submitted",
          details: { completedVia: "wizard" },
          ipAddressHash: hashIP(ipAddress),
          userAgent: req.headers["user-agent"],
        });

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Invalid delete action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Verification session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Verification Phone API — Real OTP send / verify.
 *
 * Wraps the existing lib/verification/phoneVerification.js (server-side) with
 * the caller's real user.id. The client wizard used to call createOTP /
 * verifyOTP directly with a hardcoded "current-user-id" — broken.
 *
 *   POST { action: "send",   phone }  → createOTP(user.id, phone)
 *   POST { action: "verify", phone, otp } → verifyOTP(user.id, phone, otp);
 *        on success, sets creator_verifications.phone_verified = TRUE
 *
 * The OTP is NEVER returned to the client (no SMS provider wired in dev).
 */

import { withAuth } from "../../../lib/withAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { rateLimit } from "../../../lib/rateLimit";
import {
  createOTP,
  verifyOTP,
  getOTPStatus,
} from "../../../lib/verification/phoneVerification";

// Per-user sliding window. OTP send/verify are already internally throttled
// (60s send cooldown, 3 attempts per OTP); this bounds verify/status spam and
// DB write amplification at the route layer, matching the admin/funding routes.
const rl = rateLimit({ windowMs: 60_000, max: 30 });

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit (keyed per-user via the Authorization token).
  if (!rl(req, res)) return;

  const { action } = req.body || {};

  try {
    // ─── Status check (optional, non-mutating) ───
    if (action === "status") {
      const { phone } = req.body || {};
      if (!phone) {
        return res.status(400).json({ error: "phone is required" });
      }
      const status = await getOTPStatus(user.id, phone);
      return res.status(200).json({ success: true, ...status });
    }

    // ─── Send OTP ───
    if (action === "send") {
      const { phone } = req.body || {};
      if (!phone) {
        return res.status(400).json({ error: "phone is required" });
      }
      const result = await createOTP(user.id, phone);
      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          cooldown: result.cooldown || undefined,
        });
      }
      return res.status(200).json({ success: true });
    }

    // ─── Verify OTP ───
    if (action === "verify") {
      const { phone, otp } = req.body || {};
      if (!phone || !otp) {
        return res.status(400).json({ error: "phone and otp are required" });
      }
      const result = await verifyOTP(user.id, phone, otp);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Mark the creator_verifications row as phone-verified.
      const { error: updateError } = await supabaseAdmin
        .from("creator_verifications")
        .update({ phone_verified: true })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Phone verify: creator_verifications update failed:", updateError.message);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Verification phone error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

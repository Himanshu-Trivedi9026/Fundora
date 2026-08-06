// lib/verification/status.js
//
// Server-side creator verification reads. Used by API-route gates so that
// publishing, receiving donations, and withdrawing funds are blocked until a
// creator is verified — never relying on client-side UI alone.
//
// Uses the service-role client (supabaseAdmin), which bypasses RLS, so the
// check works regardless of who is making the request (a donor creating an
// order for a project's owner, a creator withdrawing, etc.).
//
// NOTE: the returned verification object includes fields beyond the status
// (verification_level, identity_verified, bank_verified, business_verified)
// so later phases can enforce on them without changing this signature.
// Phase 1 enforces ONLY verification_status === "approved".
import { supabaseAdmin } from "../supabaseAdmin";

/**
 * Fetch a user's creator_verifications row (the fields relevant to gating).
 *
 * @param {string} userId — the user's auth.id
 * @returns {Promise<{
 *   verification_status: string,
 *   verification_level: number,
 *   identity_verified: boolean,
 *   bank_verified: boolean,
 *   business_verified: boolean,
 * } | null>} — the row, or null when missing or the lookup errors (fail-closed).
 */
export async function getCreatorVerification(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("creator_verifications")
    .select(
      "verification_status, verification_level, identity_verified, bank_verified, business_verified",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    verification_status: data.verification_status,
    verification_level: data.verification_level,
    identity_verified: data.identity_verified,
    bank_verified: data.bank_verified,
    business_verified: data.business_verified,
  };
}

/**
 * Whether a user's creator verification is approved.
 * Fail-closed: anything other than an explicit "approved" (missing row,
 * pending/rejected/expired, lookup error) returns false.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isCreatorVerified(userId) {
  const verification = await getCreatorVerification(userId);
  return verification?.verification_status === "approved";
}

-- =============================================================================
-- 023_verification_rls_harden.sql
-- =============================================================================
-- Security hardening of the creator-verification RLS surface (Phase D audit).
--
-- Problem: migrations 001/002/003 granted the AUTHENTICATED role INSERT and
-- UPDATE policies on the verification tables that were never exercised by the
-- app (every write goes through service-role API routes: documents.js,
-- session.js, phone.js, admin manualReview). Those blanket policies let any
-- signed-in user drive the verification lifecycle directly through PostgREST
-- with their own JWT:
--
--   * creator_verifications   — set verification_status='approved' on their own
--                               row (self-approval), bypassing admin review and
--                               every isCreatorVerified() gate (publishing,
--                               donations, withdrawals, the 020 publish trigger).
--   * verification_documents  — mark their own documents 'verified', or swap
--                               the storage_path of an approved document to
--                               replace it after approval.
--   * verification_requests   — flip their own request back to 'submitted'
--                               after rejection (re-enter the queue with no new
--                               documents), set it to 'approved'/'cancelled' to
--                               hide it from review, or wipe rejection_reason.
--   * verification_sessions   — mark their own session complete / tamper state.
--
-- Fix: remove those authenticated-role write policies. The legitimate SELECT
-- ("view own") and service-role ("full access") policies are preserved, so
-- existing behavior (reading your own status/docs; server-side writes via the
-- service role) is unchanged.
--
-- Also locks down recalculate_verification_level(): a SECURITY DEFINER helper
-- that takes an arbitrary user UUID and writes that user's verification_level.
-- It is unused in application code and callable by any authenticated user via
-- PostgREST RPC, making it an unauthorized cross-user write primitive. EXECUTE
-- is revoked from PUBLIC/authenticated; the function remains for the owner /
-- service role.
-- =============================================================================

-- ── creator_verifications ────────────────────────────────────────────────────
-- Drop self-INSERT (a legacy user without a row could insert one with
-- verification_status='approved') and self-UPDATE (could set
-- verification_status='approved' directly).
DROP POLICY IF EXISTS "Users can insert own verification" ON creator_verifications;
DROP POLICY IF EXISTS "Users can update own verification" ON creator_verifications;

-- ── verification_documents ───────────────────────────────────────────────────
-- Drop self-INSERT / self-UPDATE (could mark own documents 'verified' or
-- replace the storage_path of an approved document).
DROP POLICY IF EXISTS "Users can insert own documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON verification_documents;

-- ── verification_requests ────────────────────────────────────────────────────
-- Drop self-INSERT / self-UPDATE (could re-enter the review queue after
-- rejection, hide requests, or forge request review state).
DROP POLICY IF EXISTS "Users can insert own requests" ON verification_requests;
DROP POLICY IF EXISTS "Users can update own requests" ON verification_requests;

-- ── verification_sessions ────────────────────────────────────────────────────
-- Drop self-INSERT / self-UPDATE (session.js writes via the service role).
DROP POLICY IF EXISTS "Users can insert own sessions" ON verification_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON verification_sessions;

-- ── recalculate_verification_level ───────────────────────────────────────────
-- SECURITY DEFINER helper accepting an arbitrary target user UUID; unused in
-- app code. Restrict so a signed-in user cannot mutate another user's row.
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_level(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_verification_level(UUID) FROM authenticated;

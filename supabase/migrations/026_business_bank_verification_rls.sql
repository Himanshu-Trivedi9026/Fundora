-- 026_business_bank_verification_rls.sql
-- =============================================================================
-- Harden the remaining verification tables (migration 004) — same class as 023.
--
-- Migrations 001/002/003 were locked down in 023 by removing the
-- authenticated-role INSERT/UPDATE policies that let any signed-in user drive
-- the verification lifecycle directly through PostgREST. The 004 tables
-- (business_verifications, business_documents, bank_accounts,
-- bank_verifications) were created with the SAME blanket self-write policies
-- and were never hardened:
--
--   * business_verifications — user can INSERT their own row with
--     status='approved' or UPDATE an existing row to status='approved'
--     (self-approval), bypassing admin review and every isCreatorVerified()
--     gate.
--   * business_documents    — user can INSERT documents with status='validated'
--     or UPDATE the storage_path of an approved document (swap the file after
--     approval).
--   * bank_accounts         — user can set status='verified' on their own
--     account, bypassing the penny-drop / manual verification flow.
--   * bank_verifications    — user can INSERT with status='approved' or UPDATE
--     their own row to status='approved' (self-approval).
--
-- Verification performed before writing this migration:
--   * Every write to these tables in the codebase goes through the service-role
--     client (supabaseAdmin) in lib/verification/{bank,gst,pan,pennyDrop,
--     manualReview}.js and pages/api/account/delete.js — RLS is bypassed, so
--     dropping the authenticated policies changes nothing for real writes.
--   * The only client-side reads (pages/creator/bank-verification.js,
--     pages/creator/business-verification.js) SELECT the caller's own rows —
--     the self-SELECT policies below are preserved.
--   * No later migration (017, 020, 022, 023) altered these policies.
--
-- Fix (mirrors 023): drop the authenticated-role INSERT/UPDATE policies,
-- keep the self-SELECT and service-role "full access" policies. No DELETE
-- policy was ever granted to authenticated users on these tables.
--
-- Also locks down recalculate_bank_verification(UUID): a SECURITY DEFINER
-- helper that takes an arbitrary user UUID and writes that user's
-- bank_verifications counts. It is unused in application code and callable by
-- any authenticated user via PostgREST RPC, making it an unauthorized
-- cross-user write primitive. EXECUTE is revoked from PUBLIC/authenticated;
-- the function remains for the owner / service role.
-- =============================================================================

-- ── business_verifications ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own business verification" ON business_verifications;
DROP POLICY IF EXISTS "Users can update own business verification" ON business_verifications;

-- ── business_documents ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own business documents" ON business_documents;
DROP POLICY IF EXISTS "Users can update own business documents" ON business_documents;

-- ── bank_accounts ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON bank_accounts;

-- ── bank_verifications ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own bank verification" ON bank_verifications;
DROP POLICY IF EXISTS "Users can update own bank verification" ON bank_verifications;

-- ── recalculate_bank_verification ────────────────────────────────────────────
-- SECURITY DEFINER helper accepting an arbitrary target user UUID; unused in
-- app code. Restrict so a signed-in user cannot mutate another user's row.
REVOKE EXECUTE ON FUNCTION public.recalculate_bank_verification(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_bank_verification(UUID) FROM authenticated;

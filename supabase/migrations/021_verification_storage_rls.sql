-- ============================================================================
-- 021_verification_storage_rls.sql
-- Private verification-docs bucket + RLS on storage.objects.
--
-- Fixes audit findings #5/#7/#17: no storage bucket / RLS migration existed
-- for the verification-docs bucket, leaving whether files were private
-- unverified.
--
-- Guarantees:
--   * The bucket is private (public = FALSE) — files are never publicly
--     accessible via a bare URL.
--   * RLS on storage.objects backstops access: only the document owner
--     (folder prefix == auth.uid()) or a platform_admin can SELECT/DELETE;
--     only the owner can INSERT into their own folder.
--
-- NOTE: all real uploads / signed URLs run through the service-role client
-- server-side, which bypasses RLS. These policies are defense-in-depth
-- against any accidental anon / authenticated client access.
-- ============================================================================

-- 1. Create the private bucket (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS enabled on storage.objects (Supabase enables by default; make sure).
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Owner SELECT — can read objects in their own folder.
DROP POLICY IF EXISTS "verification_docs_owner_select" ON storage.objects;
CREATE POLICY "verification_docs_owner_select"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Admin SELECT — platform admins can read any verification document.
DROP POLICY IF EXISTS "verification_docs_admin_select" ON storage.objects;
CREATE POLICY "verification_docs_admin_select"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    )
  );

-- 5. Owner INSERT — a client can only upload into its own folder.
DROP POLICY IF EXISTS "verification_docs_owner_insert" ON storage.objects;
CREATE POLICY "verification_docs_owner_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Owner DELETE — can remove objects in their own folder.
DROP POLICY IF EXISTS "verification_docs_owner_delete" ON storage.objects;
CREATE POLICY "verification_docs_owner_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Admin DELETE — platform admins can remove any verification document.
DROP POLICY IF EXISTS "verification_docs_admin_delete" ON storage.objects;
CREATE POLICY "verification_docs_admin_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    )
  );

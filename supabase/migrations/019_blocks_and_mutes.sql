-- 019_blocks_and_mutes.sql
-- =============================================================================
-- FORWARD-ONLY RECONCILIATION — blocked_users / muted_users (Step 4, Task #9)
--
-- Problem:
--   The live database has NO blocked_users or muted_users tables (confirmed via
--   live PostgREST schema: 404 / not present). But the application writes to
--   them:
--     pages/dm/[userId].js:237   supabase.from("blocked_users").insert({...})
--     pages/dm/[userId].js:245   supabase.from("muted_users").insert({...})
--     pages/api/account/delete.js:49-51  deletes from both
--   Every "Block" / "Mute" click therefore throws a PostgREST "relation does
--   not exist" error, and account deletion omits cleanup for these tables.
--   (The live table dm_blocks is a different, unused shape and is not
--   referenced by the app.)
--
-- Fix:
--   Create both tables with the exact columns the app uses:
--     blocked_users  → (blocker_id, blocked_id)
--     muted_users    → (user_id, muted_user_id)
--   Fully idempotent (CREATE TABLE IF NOT EXISTS). Safe on all databases:
--     * live: creates the missing tables (the actual fix)
--     * fresh: no-op if created elsewhere, or created here consistently
--   Additive and backward compatible; does not touch any existing migration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL,
  blocked_id  uuid NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.muted_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  muted_user_id uuid NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, muted_user_id)
);

-- Indexes match the delete paths in pages/api/account/delete.js (lookups by
-- blocker_id / blocked_id / user_id) and the unique-constraint lookups above.
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker
  ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
  ON public.blocked_users (blocked_id);

CREATE INDEX IF NOT EXISTS idx_muted_users_user
  ON public.muted_users (user_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_muted
  ON public.muted_users (muted_user_id);

-- RLS: self-scoped only, matching the access pattern (a user blocks/mutes and
-- reads their own list; nothing here is public).
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_self_read" ON public.blocked_users;
CREATE POLICY "blocked_users_self_read"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocked_users_self_insert" ON public.blocked_users;
CREATE POLICY "blocked_users_self_insert"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocked_users_self_delete" ON public.blocked_users;
CREATE POLICY "blocked_users_self_delete"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocked_users_service_role_all" ON public.blocked_users;
CREATE POLICY "blocked_users_service_role_all"
  ON public.blocked_users FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "muted_users_self_read" ON public.muted_users;
CREATE POLICY "muted_users_self_read"
  ON public.muted_users FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "muted_users_self_insert" ON public.muted_users;
CREATE POLICY "muted_users_self_insert"
  ON public.muted_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "muted_users_self_delete" ON public.muted_users;
CREATE POLICY "muted_users_self_delete"
  ON public.muted_users FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "muted_users_service_role_all" ON public.muted_users;
CREATE POLICY "muted_users_service_role_all"
  ON public.muted_users FOR ALL
  USING (auth.role() = 'service_role');

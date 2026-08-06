-- 017_core_rls.sql
-- =============================================================
-- Enable RLS on the core crowdfunding tables (C6).
--
-- Audit finding (C6): `projects`, `public_donations`, `followers`,
-- `dm_conversations`, `dm_messages`, `project_messages`, and `media`
-- had RLS DISABLED — any anon/authenticated client could read every
-- row and (worse) INSERT forged rows directly through the browser
-- client (fake donations, forged chat/DM messages).
--
-- Design (policies mirror the live access patterns exactly, so no
-- working flow regresses):
--   * projects            — public SELECT; owner INSERT/UPDATE/DELETE
--                           (owner_id OR creator_id; both are used by
--                           client code).
--   * public_donations    — public SELECT (fund-page donor list + backer
--                           count + investor/creator reads are all real);
--                           INSERT/UPDATE/DELETE are server-side only, so
--                           NO client write policies → forged donations
--                           are impossible. fund.js selects safe columns.
--   * followers           — public SELECT (public follower counts);
--                           INSERT/DELETE self-scoped to follower_id.
--   * dm_conversations    — participants (user1/user2) only, SELECT+INSERT
--                           (find-or-create insert().select() needs both).
--   * dm_messages         — participants (sender OR in a convo the user is
--                           part of) for SELECT (Navbar's cross-conversation
--                           unread count depends on this); INSERT only into
--                           conversations the sender participates in.
--   * project_messages    — public SELECT (chat is public project content);
--                           INSERT self-scoped; UPDATE open to authenticated
--                           (read_by read-receipts target others' messages);
--                           DELETE own only.
--   * media               — public SELECT (public gallery); owner-scoped
--                           INSERT/DELETE via project ownership.
--
-- NOTE: service-role policies are included for consistency with earlier
-- migrations (001/005/014) but the service_role client (supabaseAdmin)
-- bypasses RLS regardless, so it is unaffected.
-- =============================================================

/* ─────────────────────────── projects ─────────────────────────── */
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_public_read" ON public.projects;
CREATE POLICY "projects_public_read"
  ON public.projects FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "projects_owner_insert" ON public.projects;
CREATE POLICY "projects_owner_insert"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS "projects_owner_update" ON public.projects;
CREATE POLICY "projects_owner_update"
  ON public.projects FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = creator_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS "projects_owner_delete" ON public.projects;
CREATE POLICY "projects_owner_delete"
  ON public.projects FOR DELETE
  USING (auth.uid() = owner_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS "projects_service_role_all" ON public.projects;
CREATE POLICY "projects_service_role_all"
  ON public.projects FOR ALL
  USING (auth.role() = 'service_role');

/* ─────────────────────── public_donations ─────────────────────── */
ALTER TABLE public.public_donations ENABLE ROW LEVEL SECURITY;

-- SELECT stays public: the fund-page donor list, the landing backer
-- count, investor self-views, and creator views (via projects!inner)
-- all read through the anon/authenticated client. PII columns are
-- avoided at the query layer (fund.js selects safe columns).
DROP POLICY IF EXISTS "public_donations_public_read" ON public.public_donations;
CREATE POLICY "public_donations_public_read"
  ON public.public_donations FOR SELECT
  USING (true);

-- No client INSERT/UPDATE/DELETE policies: all writes are server-side
-- (razorpay verify/webhook, receipt engine) via the service-role client
-- which bypasses RLS. Clients can therefore never forge donations.

DROP POLICY IF EXISTS "public_donations_service_role_all" ON public.public_donations;
CREATE POLICY "public_donations_service_role_all"
  ON public.public_donations FOR ALL
  USING (auth.role() = 'service_role');

/* ─────────────────────────── followers ─────────────────────────── */
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "followers_public_read" ON public.followers;
CREATE POLICY "followers_public_read"
  ON public.followers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "followers_self_insert" ON public.followers;
CREATE POLICY "followers_self_insert"
  ON public.followers FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "followers_self_delete" ON public.followers;
CREATE POLICY "followers_self_delete"
  ON public.followers FOR DELETE
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "followers_service_role_all" ON public.followers;
CREATE POLICY "followers_service_role_all"
  ON public.followers FOR ALL
  USING (auth.role() = 'service_role');

/* ─────────────────────── dm_conversations ─────────────────────── */
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_conversations_participant_read" ON public.dm_conversations;
CREATE POLICY "dm_conversations_participant_read"
  ON public.dm_conversations FOR SELECT
  USING (auth.uid() = user1 OR auth.uid() = user2);

-- find-or-create does insert().select(), so INSERT must also satisfy
-- the participant rule for the returned row.
DROP POLICY IF EXISTS "dm_conversations_participant_insert" ON public.dm_conversations;
CREATE POLICY "dm_conversations_participant_insert"
  ON public.dm_conversations FOR INSERT
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "dm_conversations_service_role_all" ON public.dm_conversations;
CREATE POLICY "dm_conversations_service_role_all"
  ON public.dm_conversations FOR ALL
  USING (auth.role() = 'service_role');

/* ────────────────────────── dm_messages ────────────────────────── */
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- Participant read: my own sent messages OR messages in any conversation
-- I am part of. The Navbar cross-conversation unread badge (components/
-- Navbar.jsx) counts unread across ALL conversations I participate in, so
-- this scope (not just sender_id = auth.uid()) is required.
DROP POLICY IF EXISTS "dm_messages_participant_read" ON public.dm_messages;
CREATE POLICY "dm_messages_participant_read"
  ON public.dm_messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE user1 = auth.uid() OR user2 = auth.uid()
    )
  );

-- Can only send into a conversation I am part of.
DROP POLICY IF EXISTS "dm_messages_participant_insert" ON public.dm_messages;
CREATE POLICY "dm_messages_participant_insert"
  ON public.dm_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE user1 = auth.uid() OR user2 = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dm_messages_service_role_all" ON public.dm_messages;
CREATE POLICY "dm_messages_service_role_all"
  ON public.dm_messages FOR ALL
  USING (auth.role() = 'service_role');

/* ─────────────────────── project_messages ─────────────────────── */
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- Chat is public project content (rendered on the public project page).
DROP POLICY IF EXISTS "project_messages_public_read" ON public.project_messages;
CREATE POLICY "project_messages_public_read"
  ON public.project_messages FOR SELECT
  USING (true);

-- Cannot send as another user.
DROP POLICY IF EXISTS "project_messages_self_insert" ON public.project_messages;
CREATE POLICY "project_messages_self_insert"
  ON public.project_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- read_by read-receipt updates target OTHERS' messages, so UPDATE is open
-- to authenticated users (client only ever writes read_by/delivered_at).
DROP POLICY IF EXISTS "project_messages_auth_update" ON public.project_messages;
CREATE POLICY "project_messages_auth_update"
  ON public.project_messages FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "project_messages_self_delete" ON public.project_messages;
CREATE POLICY "project_messages_self_delete"
  ON public.project_messages FOR DELETE
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "project_messages_service_role_all" ON public.project_messages;
CREATE POLICY "project_messages_service_role_all"
  ON public.project_messages FOR ALL
  USING (auth.role() = 'service_role');

/* ──────────────────────────── media ──────────────────────────── */
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Gallery is public on the project page.
DROP POLICY IF EXISTS "media_public_read" ON public.media;
CREATE POLICY "media_public_read"
  ON public.media FOR SELECT
  USING (true);

-- Writes are owner-scoped via project ownership.
DROP POLICY IF EXISTS "media_owner_insert" ON public.media;
CREATE POLICY "media_owner_insert"
  ON public.media FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE owner_id = auth.uid() OR creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "media_owner_delete" ON public.media;
CREATE POLICY "media_owner_delete"
  ON public.media FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE owner_id = auth.uid() OR creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "media_service_role_all" ON public.media;
CREATE POLICY "media_service_role_all"
  ON public.media FOR ALL
  USING (auth.role() = 'service_role');

/* ─────────────────────── realtime delivery ───────────────────────
   Supabase realtime only delivers a change to a subscriber if their
   RLS lets them SELECT the row. The policies above therefore already
   scope realtime:
     - dm_messages / dm_conversations → participants only.
     - projects / media / project_messages / followers / public_donations
       → public (as today).
   Tables must also be members of the supabase_realtime publication;
   013_project_chat_receipts.sql adds them. Re-added here idempotently
   for deployments that never applied 013. */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'public_donations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_donations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
  END IF;
END $$;

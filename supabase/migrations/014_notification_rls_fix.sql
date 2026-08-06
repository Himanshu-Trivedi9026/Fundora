-- 014_notification_rls_fix.sql
-- =============================================================
-- Notification system: security hardening + preferences table.
--
-- Audit findings (verified against the live database):
--   1. The live `notifications` table has RLS DISABLED — the anonymous
--      key can READ and INSERT rows. Any unauthenticated client can
--      read every user's notifications.
--   2. The `notification_preferences` table does NOT exist in the live
--      database (PostgREST: PGRST205). The preferences API therefore
--      cannot persist anything.
--   3. The live `notifications` table columns are:
--        id, user_id, type, is_read, actor_id, entity_id, created_at
--      (migration 007's richer schema was never applied).
--
-- This migration secures the live schema WITHOUT renaming columns or
-- dropping data. Apply with:  supabase db push   (or the SQL editor).
-- =============================================================

-- 1. Enable RLS on notifications.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owner can view their own notifications.
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Owner can update their own notifications (mark read, etc.).
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Owner can delete their own notifications.
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (server-side engine / API) bypasses RLS entirely.
CREATE POLICY "Service role can manage all notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Realtime for notifications (so the client can subscribe to live
--    updates once the publication includes this table).
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 3. notification_preferences — the table the preferences API writes to.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notification preferences"
  ON notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Indexes for the common notification queries.
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

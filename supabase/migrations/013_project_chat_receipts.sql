-- 013_project_chat_receipts.sql
-- =============================================================
-- Project Chat: fix realtime publication + add read/delivery state
--
-- Two problems found in the audit:
--   1. Realtime is broken project-wide: the supabase_realtime
--      publication is EMPTY, so no postgres_changes events are
--      ever broadcast — not for project_messages, not for media,
--      not for projects. Every subscription SUBSCRIBES but
--      receives 0 events. Add every table the app subscribes to.
--   2. project_messages has no columns for read/delivery state,
--      so read receipts / seen status / delivery status cannot
--      be persisted.
--
-- Apply with:  supabase db push   (or run in the Supabase SQL editor)
-- =============================================================

-- 1. Realtime publication — add the tables the client subscribes to.
ALTER PUBLICATION supabase_realtime ADD TABLE
  project_messages,
  media,
  projects,
  public_donations,
  dm_messages,
  dm_conversations;

-- 2. Persistent read receipts + delivery status on project_messages.
ALTER TABLE project_messages
  ADD COLUMN IF NOT EXISTS read_by uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Index to support "which messages in this project has user X read".
CREATE INDEX IF NOT EXISTS project_messages_project_created_idx
  ON project_messages (project_id, created_at);

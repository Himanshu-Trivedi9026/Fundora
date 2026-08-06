-- 015_notification_trigger_paths.sql
-- =============================================================
-- Notification trigger paths — server-side fan-out.
--
-- Audit finding: NOTHING ever wrote to the `notifications` table.
-- `createNotification` / `sendNotification` had zero call sites, so
-- donations, messages, follows, and campaign publications completed
-- without notifying anyone. The notification center was always empty.
--
-- Fix: generate notifications in the DATABASE via triggers. This is
-- server-side (cannot be spoofed by a client), fires regardless of
-- which code path mutates the source table, and is the standard
-- Supabase pattern for notification fan-out.
--
-- Live table columns referenced:
--   notifications(id, user_id, type, is_read, actor_id, entity_id, created_at)
--   followers(id, follower_id, following_id, created_at)
--   project_messages(id, project_id, sender_id, sender_name, content, ...)
--   dm_messages(id, conversation_id, sender_id, content, ...)
--   dm_conversations(id, user1, user2, ...)
--   projects(id, owner_id, creator_id, deleted, title, ...)  -- NO status column
--
-- Apply with:  supabase db push   (or the SQL editor).
-- Requires 014_notification_rls_fix.sql first (RLS + indexes).
-- =============================================================

-- 1. NEW FOLLOWER ──────────────────────────────────────────────
-- When user B follows user A, notify A.
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify when someone "follows" themselves.
  IF NEW.follower_id IS DISTINCT FROM NEW.following_id THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_id, is_read)
    VALUES (NEW.following_id, 'new_follower', NEW.follower_id, NEW.following_id, false);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON followers;
CREATE TRIGGER trg_notify_new_follower
  AFTER INSERT ON followers
  FOR EACH ROW EXECUTE FUNCTION notify_new_follower();

-- 2. NEW PROJECT MESSAGE ───────────────────────────────────────
-- When a donor/member messages a project's chat, notify the owner.
CREATE OR REPLACE FUNCTION notify_project_message()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
    FROM projects WHERE id = NEW.project_id;

  -- Notify the owner unless they sent the message themselves.
  IF v_owner_id IS NOT NULL AND v_owner_id IS DISTINCT FROM NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_id, is_read)
    VALUES (v_owner_id, 'new_message', NEW.sender_id, NEW.project_id, false);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_project_message ON project_messages;
CREATE TRIGGER trg_notify_project_message
  AFTER INSERT ON project_messages
  FOR EACH ROW EXECUTE FUNCTION notify_project_message();

-- 3. NEW DM MESSAGE ────────────────────────────────────────────
-- Notify the OTHER participant of a DM conversation.
CREATE OR REPLACE FUNCTION notify_dm_message()
RETURNS TRIGGER AS $$
DECLARE
  v_user1 uuid;
  v_user2 uuid;
  v_recipient uuid;
BEGIN
  SELECT user1, user2 INTO v_user1, v_user2
    FROM dm_conversations WHERE id = NEW.conversation_id;

  v_recipient := CASE
    WHEN v_user1 IS DISTINCT FROM NEW.sender_id THEN v_user1
    ELSE v_user2
  END;

  IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_id, is_read)
    VALUES (v_recipient, 'new_message', NEW.sender_id, NEW.conversation_id, false);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_dm_message ON dm_messages;
CREATE TRIGGER trg_notify_dm_message
  AFTER INSERT ON dm_messages
  FOR EACH ROW EXECUTE FUNCTION notify_dm_message();

-- 4. CAMPAIGN PUBLISHED ────────────────────────────────────────
-- The `projects` table has no status column (campaigns go live on
-- INSERT). Notify the creator's followers that a new campaign is live.
-- Fan-out is bounded by the creator's follower count.
CREATE OR REPLACE FUNCTION notify_campaign_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT TRUE THEN
    INSERT INTO notifications (user_id, type, actor_id, entity_id, is_read)
    SELECT f.follower_id, 'campaign_published', NEW.owner_id, NEW.id, false
      FROM followers f
     WHERE f.following_id = NEW.owner_id
       AND f.follower_id IS DISTINCT FROM NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_campaign_published ON projects;
CREATE TRIGGER trg_notify_campaign_published
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION notify_campaign_published();

-- 5. CAMPAIGN APPROVED / SYSTEM ALERT ──────────────────────────
-- No approval workflow or system-alert broadcast mechanism exists in
-- the current product, so there is no source event to hook. When one
-- is introduced, add an AFTER INSERT/UPDATE trigger here using the same
-- pattern as the four triggers above.

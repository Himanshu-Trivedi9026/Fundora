-- 018_base_tables.sql
-- =============================================================================
-- FORWARD-ONLY RECONCILIATION — base tables (Step 4, Task #9)
--
-- Problem:
--   The live database contains 14 core tables (profiles, projects, donations,
--   DMs, media, ...) that NO existing migration (001–017) creates. They were
--   created outside the migration system (dashboard / seed). The migrations
--   reference them (013 realtime, 014/015/016/017) but never CREATE them, so:
--     * a fresh deployment of the migration set fails at 013/015/016/017
--       (relation "public.projects" does not exist, etc.)
--     * the repository cannot reproduce the production schema.
--
-- Fix:
--   A forward-only, idempotent migration that defines these base tables with
--   the EXACT live column definitions (captured 2026-08-02 via the live
--   PostgREST/OpenAPI schema). Every statement is CREATE TABLE IF NOT EXISTS /
--   ALTER ... IF NOT EXISTS, so:
--     * on live databases: no-ops (tables already exist)
--     * on fresh deployments: creates the schema so later migrations succeed
--
-- This does NOT alter, renumber, or supersede any existing migration. It is
-- purely additive and backward compatible.
-- =============================================================================

-- ─────────────────────────────── profiles ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name    text,
  bio          text,
  website      text,
  avatar_url   text,
  created_at   timestamp without time zone DEFAULT now(),
  banner_url   text,
  twitter      text,
  instagram    text,
  linkedin     text,
  github       text,
  youtube      text,
  is_private   boolean DEFAULT false,
  is_verified  boolean DEFAULT false
);

-- ─────────────────────────────── projects ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text,
  title        text,
  short        text,
  description  text,
  goal         bigint,
  pledged      bigint DEFAULT 0,
  deadline     timestamp with time zone,
  owner_id     uuid,
  created_at   timestamp with time zone DEFAULT now(),
  updated_at   timestamp with time zone DEFAULT now(),
  deleted      boolean DEFAULT false,
  media        jsonb,
  team         jsonb,
  "prototypeUrl" text,
  categories   text[],
  thumbnail    text,
  creator_id   uuid
);

-- ─────────────────────────── public_donations ───────────────────────────
CREATE TABLE IF NOT EXISTS public.public_donations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid,
  name               text,
  amount             numeric,
  created_at         timestamp with time zone DEFAULT now(),
  payer_id           uuid,
  razorpay_payment_id text,
  razorpay_order_id  text,
  status             text
);

-- ─────────────────────────────── media ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid,
  url          text,
  type         text,
  name         text,
  "order"      integer,
  created_at   timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────── followers ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.followers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid,
  following_id uuid,
  created_at   timestamp without time zone DEFAULT now()
);

-- ─────────────────────────── dm_conversations ───────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1      uuid,
  user2      uuid,
  created_at timestamp without time zone DEFAULT now()
);

-- ───────────────────────────── dm_messages ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  sender_id       uuid,
  content         text,
  created_at      timestamp without time zone DEFAULT now(),
  attachment_url  text,
  attachment_type text
);

-- ─────────────────────────── project_messages ───────────────────────────
CREATE TABLE IF NOT EXISTS public.project_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid,
  sender_id       uuid,
  sender_name     text,
  content         text,
  attachment_url  text,
  attachment_type text,
  created_at      timestamp with time zone DEFAULT now(),
  is_ai           boolean DEFAULT false
);

-- ───────────────────────────── typing_status ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.typing_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_id         uuid,
  is_typing       boolean DEFAULT false,
  updated_at      timestamp with time zone DEFAULT now()
);

-- ─────────────────────────── saved_projects ───────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  project_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────── creators ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.creators (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  name       text,
  age        integer,
  email      text,
  mobile     text,
  photo      text,
  upi_qr     text,
  created_at timestamp with time zone DEFAULT now()
);

-- ──────────────────────── creator_payment_configs ────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_payment_configs (
  creator_user_id     uuid PRIMARY KEY,
  razorpay_key_id     text,
  razorpay_key_secret text,
  created_at          timestamp with time zone DEFAULT now(),
  updated_at          timestamp with time zone DEFAULT now()
);

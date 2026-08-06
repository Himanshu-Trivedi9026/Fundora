// lib/supabaseServer.js
//
// Server-side Supabase client for server-rendered PUBLIC data (used by the
// landing page's getStaticProps). Uses the same PUBLIC anon key as the browser
// client (lib/supabaseClient.js) — least-privilege, RLS-respecting reads. It
// does NOT use the service-role key and never reads authenticated/session data.
//
// Sessions are intentionally not persisted or refreshed here: this client only
// reads public tables, and anything user-specific is resolved client-side via
// RoleContext, so no authenticated data ever lands in a cached payload.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables!");
}

export const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

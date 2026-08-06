// lib/supabaseClient.js
//
// Uses @supabase/ssr's createBrowserClient so sessions are stored in
// cookies (not localStorage). This lets the Next.js middleware read
// the auth session server-side without a client-side redirect race.
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables!");
}

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

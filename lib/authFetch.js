/**
 * authFetch — Single authenticated fetch helper for all protected API routes.
 *
 * Every Fundora API route guarded by `withAuth` / `withRole` / `withVerified`
 * requires an `Authorization: Bearer <access_token>` header; without it the
 * route returns 401. Historically each page duplicated this logic inline
 * (or missed it entirely), which caused silent 401s on admin / creator
 * dashboards. This module is the one source of truth for attaching the
 * Supabase session token to a request.
 *
 *   import { authFetch, authHeaders } from "../lib/authFetch";
 *
 *   const res = await authFetch("/api/admin/review-queue?type=identity");
 *   if (!res.ok) throw new Error(`API returned ${res.status}`);
 *
 * The helper resolves the current session via supabase.auth.getSession() and
 * throws if no session exists, so callers' existing try/catch error handling
 * keeps working. Use `authHeaders(false)` for bodyless/FormData XHR uploads
 * (e.g. the document uploader).
 */

import { supabase } from "./supabaseClient";

/**
 * Resolve the Authorization header for the current user.
 *
 * @param {boolean} json - true to include `Content-Type: application/json`.
 * @returns {Promise<Object>} header map, e.g. { Authorization: "Bearer <token>" }.
 * @throws {Error} if the user has no active Supabase session.
 */
export async function authHeaders(json = true) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  if (!json) return { Authorization: `Bearer ${token}` };

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * fetch() wrapper that always attaches the Bearer token.
 *
 * The caller's own headers (e.g. a custom Content-Type) are preserved, then
 * the Authorization header is applied on top. Returns the raw Response — use
 * `await res.json()` / `res.ok` exactly as with plain fetch.
 *
 * @param {string} url - absolute or relative API path.
 * @param {Object} [options] - standard fetch options (method, body, headers…).
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(await authHeaders(true)),
  };
  return fetch(url, { ...options, headers });
}

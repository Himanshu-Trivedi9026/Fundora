import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ROLES,
  AREA_ROLES,
  roleHome,
  protectedArea,
  requiresVerification,
} from "./lib/roles";

/**
 * Next.js Proxy — server-side auth + role gate for protected routes.
 *
 * In Next.js 16, the file-based convention is proxy.js (not middleware.js).
 * This runs on every matched request before the page handler.
 *
 * Responsibilities:
 *  1. Auth gate — redirects unauthenticated users to /login with a redirect param.
 *  2. Role gate — enforces platform role access on role-scoped areas:
 *       /admin/*    → platform_admin only
 *       /creator/*  → creator or platform_admin
 *       /investor/* → any signed-in user
 *     Role is read from public.profiles.role (single source of truth). If the
 *     lookup fails (e.g. role column not yet migrated), the user is allowed
 *     through and RoleContext refines the role client-side.
 *  3. Auth-page bounce — logged-in users hitting /login, /signup or
 *     /forgot-password are sent home. /reset-password is intentionally
 *     excluded: it must remain reachable during a password-recovery session,
 *     and the page itself rejects invalid/expired sessions.
 */

/** Auth-only paths beyond the role-scoped areas (any signed-in user). */
const EXTRA_AUTH_PATHS = [
  "/payments",
  "/saved",
  "/followers",
  "/dm",
  "/edit-profile",
  "/account",
];

function isProtected(pathname) {
  const rule = protectedArea(pathname); // /admin,/creator,/investor + /create,/edit
  if (rule) return rule;

  return EXTRA_AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  )
    ? { authOnly: true }
    : null;
}

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const rule = isProtected(pathname);

  /* ─── Unprotected path: allow through ─── */
  if (!rule) return supabaseResponse;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ─── Auth gate ─── */
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ─── Creator-verification gate (fail-closed) ───
       Publish / analytics / payout entry points require an approved creator
       verification. Allow through ONLY when the lookup succeeds and returns
       "approved"; any failure (lookup error, missing row, non-approved status)
       redirects to /creator/verification. /creator/dashboard and
       /creator/verification are never matched by requiresVerification(), so
       they stay reachable even when the lookup fails. Placed before the
       authOnly short-circuit because /create is authOnly. */
  if (requiresVerification(pathname)) {
    try {
      const { data: verification } = await supabase
        .from("creator_verifications")
        .select("verification_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!verification || verification.verification_status !== "approved") {
        const verifyUrl = new URL("/creator/verification", request.url);
        verifyUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(verifyUrl);
      }
    } catch (err) {
      console.error(
        "[proxy] verification lookup failed for",
        user.id,
        err?.message,
      );
      const verifyUrl = new URL("/creator/verification", request.url);
      verifyUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(verifyUrl);
    }
  }

  /* ─── Auth-only routes: signed in is enough (creating a first campaign
        auto-promotes the user to creator via the DB trigger) ─── */
  if (rule.authOnly) return supabaseResponse;

  /* ─── Role gate ─── */
  let role = ROLES.INVESTOR;
  try {
    const { data: prof, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // PostgREST returns lookup failures (e.g. "column profiles.role does not
    // exist" before migration 016 is applied) in the `error` field, NOT as a
    // thrown exception. Without this check the user is silently treated as an
    // investor and bounced out of every /creator/* route — exactly the bug
    // observed at runtime (307 -> /investor/dashboard). Fail open so the
    // client-side RoleContext can refine the real role.
    if (roleError) {
      console.error(
        "[proxy] role lookup failed for",
        user.id,
        roleError.message,
      );
      return supabaseResponse;
    }

    role = prof?.role || ROLES.INVESTOR;
  } catch (err) {
    // Pre-migration or transient error → allow; RoleContext refines client-side.
    console.error("[proxy] role lookup failed for", user.id, err?.message);
    return supabaseResponse;
  }

  if (!AREA_ROLES[rule.area].includes(role)) {
    const home = roleHome(role);
    const redirectUrl = new URL(home, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (logo.png, robots.txt, etc.)
     * - api (handled by withAuth)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/).*)",
  ],
};

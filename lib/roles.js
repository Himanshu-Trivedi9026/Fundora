/**
 * lib/roles.js — Platform role constants and helpers.
 *
 * Framework-agnostic (no React, no Supabase client import) so it can be used
 * by the edge middleware, API routes, and client components alike.
 *
 * Role values mirror supabase/migrations/016_user_roles.sql.
 */

export const ROLES = {
  INVESTOR: "donor", // display: "Investor" (default)
  CREATOR: "creator", // display: "Creator"
  ADMIN: "platform_admin", // display: "Admin"
};

export const ROLE_LABELS = {
  [ROLES.INVESTOR]: "Investor",
  [ROLES.CREATOR]: "Creator",
  [ROLES.ADMIN]: "Admin",
};

export const ROLE_HOME = {
  [ROLES.INVESTOR]: "/investor/dashboard",
  [ROLES.CREATOR]: "/creator/dashboard",
  [ROLES.ADMIN]: "/admin/dashboard",
};

/** Landing page for a role (used when access is denied to a route). */
export function roleHome(role) {
  return ROLE_HOME[role] || ROLE_HOME[ROLES.INVESTOR];
}

/**
 * Sanitize a signup `role` query param into a valid self-assignable role.
 *
 * Only the exact string "creator" maps to the creator role; every other value
 * (undefined, "", "admin", "platform_admin", "CREATOR", or a repeated-query
 * array) falls back to the default investor ("donor") role. This fail-closed
 * behavior makes it impossible to self-elevate to platform_admin through the
 * URL. Used identically by the signup page and the auth callback so the rule
 * lives in one place.
 */
export function parseSignupRole(raw) {
  return raw === "creator" ? ROLES.CREATOR : ROLES.INVESTOR;
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS[ROLES.INVESTOR];
}

/**
 * Can this user see a "Start Project" affordance?
 *
 * Product rule (single source of truth): only creators. Guests are onboarded
 * through /get-started instead, and investors (donors) have no create-flow
 * entry point. platform_admin is not a creator — the hero CTA already hides
 * Start Project for admins — so this stays strictly creator-only.
 *
 * @param {{ role?: string }} ctx role from RoleContext (or raw role value).
 */
export function canStartProject({ role } = {}) {
  return role === ROLES.CREATOR;
}

/**
 * Where a "Start Project" action should navigate.
 *
 * Creators enter the creator project-creation flow (/create). Anyone else —
 * defensively, since the affordance should already be hidden from them — is
 * sent to /get-started so a stray link never bounces a guest to the login
 * page or the auth-gated /create route.
 *
 * @param {{ role?: string }} ctx role from RoleContext (or raw role value).
 */
export function startProjectHref({ role } = {}) {
  return canStartProject({ role }) ? "/create" : "/get-started";
}

/** All roles that can access a given role area. */
export const AREA_ROLES = {
  investor: [ROLES.INVESTOR, ROLES.CREATOR, ROLES.ADMIN], // everyone signed-in
  creator: [ROLES.CREATOR, ROLES.ADMIN],
  admin: [ROLES.ADMIN],
};

export function canAccessArea(role, area) {
  return (AREA_ROLES[area] || AREA_ROLES.investor).includes(role);
}

/**
 * Map a pathname to the protection rule that applies (used by middleware).
 * Returns `null` for public paths, `{ authOnly: true }` for signed-in-only
 * paths, or `{ area: 'investor'|'creator'|'admin' }` for role-gated areas.
 */
export function protectedArea(pathname) {
  // Auth-only pages (any signed-in user).
  if (pathname === "/create" || pathname.startsWith("/create/")) {
    return { authOnly: true };
  }
  if (pathname === "/edit" || pathname.startsWith("/edit/")) {
    return { authOnly: true };
  }

  for (const area of Object.keys(AREA_ROLES)) {
    if (pathname === "/" + area || pathname.startsWith("/" + area + "/")) {
      return { area };
    }
  }
  return null;
}

/**
 * Page routes that require the user's creator verification to be "approved"
 * before they may be opened. These are the publish / receive-donation /
 * withdraw / analytics entry points. The middleware (proxy.js) redirects
 * unverified users away from them to /creator/verification.
 *
 * /creator/dashboard and /creator/verification are deliberately NOT listed:
 * the dashboard renders its own verification-gate screen, and the verification
 * page is where unverified users are sent.
 */
export const VERIFICATION_REQUIRED_PATHS = [
  "/create",
  "/creator/analytics",
  "/creator/payouts",
  "/creator/earnings",
  "/creator/funds-got",
];

/**
 * Whether a pathname requires an approved creator verification.
 * Mirrors the EXTRA_AUTH_PATHS style used in proxy.js.
 */
export function requiresVerification(pathname) {
  return VERIFICATION_REQUIRED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

import { supabaseAdmin } from "./supabaseAdmin";
import { hasPermission } from "./rbac/rbacEngine.js";
import { ROLES } from "./roles";
import { isCreatorVerified } from "./verification/status";

/**
 * Higher-order function that wraps an API route handler with authentication.
 *
 * Usage:
 *   import { withAuth } from "@/lib/withAuth";
 *   export default withAuth(async function handler(req, res, user) {
 *     // user is guaranteed to exist
 *   });
 *
 * The wrapper:
 *  1. Extracts the Bearer token from the Authorization header
 *  2. Validates it via supabaseAdmin.auth.getUser()
 *  3. Attaches the user object to req.user
 *  4. Calls the handler with (req, res, user)
 *  5. Returns 401 if the token is missing or invalid
 */
export function withAuth(handler) {
  return async function authedHandler(req, res) {
    try {
      // Support page component usage (no req.headers during prerender)
      if (!req?.headers) {
        return handler(req, res);
      }

      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data?.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Attach user to request for downstream handlers
      req.user = data.user;

      return handler(req, res, data.user);
    } catch (err) {
      console.error("Auth middleware error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Higher-order function that wraps an API route handler with authentication
 * and RBAC permission checking.
 *
 * Usage:
 *   import { withAuthAndPermission } from "@/lib/withAuth";
 *   export default withAuthAndPermission(async function handler(req, res, user) {
 *     // user is authenticated and has the required permission
 *   }, "campaign:create");
 *
 * The wrapper:
 *  1. Authenticates the user (same as withAuth)
 *  2. Extracts organizationId from query or body
 *  3. Checks if user has the required permission in that organization
 *  4. Returns 403 if permission is denied
 *  5. Attaches userRole and userPermissions to req
 */
export function withAuthAndPermission(handler, permission) {
  return withAuth(async (req, res, user) => {
    try {
      const orgId = req.query.organizationId || req.body?.organizationId;

      const result = await hasPermission(user.id, orgId, permission);

      if (!result.success) {
        return res.status(500).json({ error: "Permission check failed" });
      }

      if (!result.data.allowed) {
        return res.status(403).json({
          error: "Forbidden",
          requiredPermission: permission,
          reason: result.data.reason,
        });
      }

      req.userRole = result.data.role;
      req.userPermissions = result.data.permissions;

      return handler(req, res, user);
    } catch (err) {
      console.error("Auth+Permission middleware error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}

/**
 * Higher-order function that wraps an API route handler with authentication
 * and a platform-role check against public.profiles.role.
 *
 * Usage:
 *   import { withRole } from "@/lib/withAuth";
 *   export default withRole(async function handler(req, res, user) { ... },
 *     [ROLES.ADMIN]);            // platform_admin only
 *
 * The wrapper:
 *  1. Authenticates via withAuth (same Bearer-token flow)
 *  2. Looks up the caller's role on public.profiles
 *  3. Returns 403 unless the role is in `allowedRoles`
 *  4. Attaches the resolved role to req.userRole
 */
export function withRole(handler, allowedRoles = [ROLES.INVESTOR, ROLES.CREATOR, ROLES.ADMIN]) {
  return withAuth(async (req, res, user) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!allowedRoles.includes(data.role)) {
        return res.status(403).json({
          error: "Forbidden",
          requiredRole: allowedRoles,
        });
      }

      req.userRole = data.role;

      return handler(req, res, user);
    } catch (err) {
      console.error("Role middleware error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}

/**
 * Higher-order function that wraps an API route handler with authentication
 * and a creator-verification check.
 *
 * Usage:
 *   import { withVerified } from "@/lib/withAuth";
 *   export default withVerified(async function handler(req, res, user) { ... });
 *
 * The wrapper:
 *  1. Authenticates via withAuth (same Bearer-token flow)
 *  2. Requires the caller's creator_verifications.verification_status to be
 *     "approved" (isCreatorVerified, fail-closed on lookup errors)
 *  3. Returns 403 { error: "VerificationRequired" } otherwise
 *  4. Calls the handler with (req, res, user)
 *
 * Deliberately does NOT add a role check: the existing auto-promote trigger
 * (donor → creator on first project insert) stays intact for verified donors.
 */
export function withVerified(handler) {
  return withAuth(async (req, res, user) => {
    try {
      const verified = await isCreatorVerified(user.id);

      if (!verified) {
        return res.status(403).json({
          error: "VerificationRequired",
          message: "Creator verification is required for this action",
        });
      }

      return handler(req, res, user);
    } catch (err) {
      console.error("Verification middleware error:", err);
      return res.status(403).json({ error: "VerificationRequired" });
    }
  });
}

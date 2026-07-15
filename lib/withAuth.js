import { supabaseAdmin } from "./supabaseAdmin";

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

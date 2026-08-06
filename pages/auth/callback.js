import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { parseSignupRole } from "../../lib/roles";
import { useEffect, useState } from "react";

/**
 * Auth callback — the landing page for every Supabase auth redirect:
 *   - email confirmation (signup)      → "?next=/"            (hash or PKCE code)
 *   - password recovery (reset)        → "?type=recovery"      (hash or PKCE code)
 *   - error responses                  → "?error=..." & "error_description=..."
 *
 * Responsibilities:
 *   1. Exchange the PKCE `?code=` for a session when present (the hash-based
 *      flow is handled automatically by the browser client on load).
 *   2. Ensure the user's public profile row exists.
 *   3. Route the user to the right destination: reset-password for recovery,
 *      the `next` target (or home) for normal confirmation.
 */
export default function Callback() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing login...");

  useEffect(() => {
    if (!router.isReady) return;

    async function handleCallback() {
      const { code, error, error_description, next, role, type } = router.query;

      // Role-first onboarding: sanitize the role carried over from the signup
      // email link. Only "creator" maps to creator; everything else (including
      // an attempted platform_admin) becomes the default investor role.
      const sanitizedRole = parseSignupRole(role);

      // Auth provider / link errors (e.g. expired or invalid link)
      if (error) {
        if (type === "recovery") {
          setMessage("This reset link is invalid or has expired.");
          setTimeout(() => router.push("/forgot-password"), 1800);
        } else {
          setMessage(error_description || error);
          setTimeout(() => router.push("/login"), 1800);
        }
        return;
      }

      let session = null;

      if (code) {
        // PKCE flow — exchange the one-time code for a session
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setMessage(exchangeError.message);
          setTimeout(() => router.push("/login"), 1800);
          return;
        }
        session = data.session;
      } else {
        // Hash flow — the browser client already parsed #access_token
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      const user = session?.user;

      // Recovery (password reset) — hand off to the reset-password page.
      // The current session carries a limited token scoped to updateUser.
      if (type === "recovery") {
        router.replace("/reset-password");
        return;
      }

      if (user) {
        // Ensure the public profile row exists (mirrors the signup trigger)
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          // INSERT is the only path that can set the role at signup — the
          // protect_user_role trigger (016) blocks UPDATEs of `role` for the
          // client, but does not fire on INSERT.
          try {
            await supabase.from("profiles").insert({
              id: user.id,
              full_name:
                user.user_metadata?.full_name || user.email?.split("@")[0],
              bio: "",
              website: "",
              avatar_url: "",
              role: sanitizedRole,
            });
          } catch (insertErr) {
            // Ignore duplicate-key race when the verification link is double-fired.
            if (insertErr?.code !== "23505") throw insertErr;
          }
        }
      }

      // Normal confirmation → go to `next` (defaults to home)
      const safeNext =
        typeof next === "string" && next.startsWith("/") ? next : "/";
      router.replace(safeNext);
    }

    handleCallback();
  }, [router.isReady, router.query, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface-dim"
      role="status"
    >
      <div className="flex flex-col items-center gap-4 text-on-surface-variant">
        <span
          className="material-symbols-outlined text-[40px] animate-spin"
          aria-hidden="true"
        >
          progress_activity
        </span>
        <p className="font-inter text-sm">{message}</p>
      </div>
    </div>
  );
}

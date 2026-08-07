import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { parseSignupRole } from "../../lib/roles";
import { useEffect, useState } from "react";

export default function Callback() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing login...");

  useEffect(() => {
    if (!router.isReady) return;

    async function handleCallback() {
      console.log("========================================");
      console.log("AUTH CALLBACK START");
      console.log("========================================");

      const { code, error, error_description, next, role, type } = router.query;

      console.log("Router Query:", router.query);
      console.log("Raw role from URL:", role);
      console.log("Code:", code);
      console.log("Next:", next);
      console.log("Type:", type);

      const sanitizedRole = parseSignupRole(role);

      console.log("Sanitized Role:", sanitizedRole);

      if (error) {
        console.error("Supabase Error:", error);
        console.error(error_description);

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
        console.log("Using PKCE flow...");

        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error("Exchange Error:", exchangeError);

          setMessage(exchangeError.message);
          setTimeout(() => router.push("/login"), 1800);
          return;
        }

        session = data.session;
      } else {
        console.log("Using Hash flow...");

        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      console.log("Session:", session);

      const user = session?.user;

      console.log("Logged User:", user);

      if (type === "recovery") {
        router.replace("/reset-password");
        return;
      }

      if (user) {
        console.log("Checking profile...");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        console.log("Profile Query Error:", profileError);
        console.log("Existing Profile:", profile);

        if (!profile) {
          console.log("Profile does not exist.");
          console.log("Creating profile...");
          console.log("Role being inserted:", sanitizedRole);

          const { data: insertData, error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              full_name:
                user.user_metadata?.full_name ||
                user.email?.split("@")[0],
              bio: "",
              website: "",
              avatar_url: "",
              role: sanitizedRole,
            })
            .select();

          console.log("Insert Data:", insertData);
          console.log("Insert Error:", insertError);

          if (insertError) {
            console.error("Profile Insert Failed:", insertError);
          } else {
            console.log("Profile Created Successfully.");
          }
        } else {
          console.log("Profile already exists.");
          console.log("Existing Role:", profile.role);
        }
      } else {
        console.warn("No authenticated user found.");
      }

      const safeNext =
        typeof next === "string" && next.startsWith("/")
          ? next
          : "/";

      console.log("Redirecting to:", safeNext);

      console.log("========================================");
      console.log("AUTH CALLBACK END");
      console.log("========================================");

      router.replace(safeNext);
    }

    handleCallback();
  }, [router.isReady]);

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
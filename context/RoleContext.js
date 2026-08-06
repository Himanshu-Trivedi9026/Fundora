/**
 * RoleContext — User role detection and role-based feature access.
 *
 * Single source of truth: the `role` column on public.profiles
 * (see supabase/migrations/016_user_roles.sql).
 *
 * Values:
 *   donor          → "Investor"  (default) — browses, funds projects
 *   creator        → "Creator"   — owns campaigns
 *   platform_admin → "Admin"     — platform operations
 *
 * A legacy fallback (owns a project) promotes donors to creator for rows that
 * predate the role column backfill.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { ROLES } from "../lib/roles";

const RoleContext = createContext({
  user: null,
  profile: null,
  role: ROLES.INVESTOR,
  isAdmin: false,
  isCreator: false,
  isDonor: true,
  isInvestor: true,
  loading: true,
  refreshRole: () => {},
});

export function RoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(ROLES.INVESTOR);
  const [loading, setLoading] = useState(true);

  const detectRole = useCallback(async (u) => {
    if (!u) {
      setRole(ROLES.INVESTOR);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // Canonical role from the profile row.
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", u.id)
        .maybeSingle();

      setProfile(prof);

      let detected = prof?.role || ROLES.INVESTOR;

      // Validate against the known role set (protects against bad rows).
      if (!Object.values(ROLES).includes(detected)) {
        detected = ROLES.INVESTOR;
      }

      // Legacy fallback: pre-migration creators (no role column, or row still
      // marked donor) who already own a project should be treated as creators.
      if (detected === ROLES.INVESTOR) {
        const { count } = await supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", u.id);
        if (count > 0) detected = ROLES.CREATOR;
      }

      setRole(detected);
    } catch (err) {
      console.error("Role detection error:", err);
      setRole(ROLES.INVESTOR);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);
      await detectRole(u);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // init() above already performs the initial profile lookup. The
        // listener's INITIAL_SESSION replay would duplicate every profile
        // query on mount (doubled again by React StrictMode) — skip it.
        // Subsequent SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED events still refresh.
        if (event === "INITIAL_SESSION") return;
        const u = session?.user || null;
        setUser(u);
        setLoading(true);
        await detectRole(u);
      }
    );

    return () => listener?.subscription?.unsubscribe();
  }, [detectRole]);

  const refreshRole = useCallback(async () => {
    setLoading(true);
    await detectRole(user);
  }, [user, detectRole]);

  const value = {
    user,
    profile,
    role,
    isAdmin: role === ROLES.ADMIN,
    isCreator: role === ROLES.CREATOR,
    isDonor: role === ROLES.INVESTOR,
    isInvestor: role === ROLES.INVESTOR,
    loading,
    refreshRole,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export default RoleContext;

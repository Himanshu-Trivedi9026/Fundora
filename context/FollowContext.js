import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const FollowContext = createContext(null);

export function FollowProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user || null);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUser(session?.user || null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setFollowingIds(new Set());
      setLoading(false);
      return;
    }

    async function loadFollowing() {
      setLoading(true);

      const { data, error } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", currentUser.id);

      if (!error && data) {
        setFollowingIds(new Set(data.map(r => r.following_id)));
      }

      setLoading(false);
    }

    loadFollowing();
  }, [currentUser?.id]);

  const follow = useCallback(async (userId) => {
    if (!currentUser) return;

    await supabase.from("followers").insert({
      follower_id: currentUser.id,
      following_id: userId,
    });

    setFollowingIds(prev => new Set([...prev, userId]));
  }, [currentUser]);

  const unfollow = useCallback(async (userId) => {
    if (!currentUser) return;

    await supabase
      .from("followers")
      .delete()
      .eq("follower_id", currentUser.id)
      .eq("following_id", userId);

    setFollowingIds(prev => {
      const s = new Set(prev);
      s.delete(userId);
      return s;
    });
  }, [currentUser]);

  // Memoize the value object to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    currentUser, followingIds, follow, unfollow, loading
  }), [currentUser, followingIds, follow, unfollow, loading]);

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  return useContext(FollowContext);
}

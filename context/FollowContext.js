import { createContext, useContext, useEffect, useState } from "react";
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

  async function follow(userId) {
    if (!currentUser) return;

    await supabase.from("followers").insert({
      follower_id: currentUser.id,
      following_id: userId,
    });

    setFollowingIds(prev => new Set([...prev, userId]));
  }

  async function unfollow(userId) {
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
  }

  return (
    <FollowContext.Provider
      value={{ currentUser, followingIds, follow, unfollow, loading }}
    >
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  return useContext(FollowContext);
}

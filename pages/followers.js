import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ConnectionCard from "../components/connections/ConnectionCard";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export default function FollowersPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("followers");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  /* ================= LOAD USER (once) ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ================= LOAD FOLLOWING IDS ================= */
  useEffect(() => {
    if (!user) return;

    supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        setFollowingIds(data?.map((f) => f.following_id) || []);
      });
  }, [user]);

  /* ================= LOAD CONNECTIONS ================= */
  const loadConnections = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const { data: followRows, error } = await supabase
        .from("followers")
        .select(tab === "followers" ? "follower_id" : "following_id")
        .eq(tab === "followers" ? "following_id" : "follower_id", user.id);

      if (error || !followRows || followRows.length === 0) {
        setList([]);
        return;
      }

      const ids = followRows.map((r) =>
        tab === "followers" ? r.follower_id : r.following_id,
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio")
        .in("id", ids);

      setList(profiles || []);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [user, tab]);

  useEffect(() => {
    if (!user || search) return;
    loadConnections();
  }, [user, tab, search, loadConnections]);

  /* ================= SEARCH ================= */
  useEffect(() => {
    if (!search.trim()) {
      queueMicrotask(() => setSearchResults([]));
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio")
        .ilike("full_name", `%${search}%`)
        .limit(10);

      setSearchResults(data || []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  /* ================= TOGGLE FOLLOW ================= */
  async function toggleFollow(targetId) {
    if (!user) return;

    const isFollowing = followingIds.includes(targetId);

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);

      setFollowingIds((prev) => prev.filter((id) => id !== targetId));
    } else {
      await supabase.from("followers").insert({
        follower_id: user.id,
        following_id: targetId,
      });

      setFollowingIds((prev) => [...prev, targetId]);
    }
  }

  const displayList = search ? searchResults : list;

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-32 pb-24 min-h-screen flex-1 relative">
        {/* ─── Ambient Background Blobs ─── */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-primary-container/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-16">
          {/* ═══════════ HEADER ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center mb-16"
          >
            <h1 className="font-geist text-4xl md:text-5xl font-bold text-on-surface mb-8 tracking-tighter">
              Connections
            </h1>

            {/* Pill Toggle */}
            <LayoutGroup>
              <div className="inline-flex p-1.5 bg-surface-container rounded-full border border-outline-variant/20 shadow-inner relative">
                <motion.button
                  onClick={() => {
                    setTab("followers");
                    setSearch("");
                  }}
                  className={`relative z-10 px-8 py-2.5 rounded-full font-inter text-sm font-medium transition-colors duration-300 ${
                    tab === "followers"
                      ? "text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab === "followers" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary rounded-full shadow-lg"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.5,
                      }}
                    />
                  )}
                  <span className="relative z-10">Followers</span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setTab("following");
                    setSearch("");
                  }}
                  className={`relative z-10 px-8 py-2.5 rounded-full font-inter text-sm font-medium transition-colors duration-300 ${
                    tab === "following"
                      ? "text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab === "following" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary rounded-full shadow-lg"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.5,
                      }}
                    />
                  )}
                  <span className="relative z-10">Following</span>
                </motion.button>
              </div>
            </LayoutGroup>
          </motion.div>

          {/* ═══════════ SEARCH ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.1,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="max-w-2xl mx-auto mb-16 relative"
          >
            <div className="glass-card flex items-center px-6 py-4 rounded-full group focus-within:ring-2 focus-within:ring-primary/40">
              <span
                className="material-symbols-outlined text-primary group-focus-within:scale-110 transition-transform"
                aria-hidden="true"
              >
                search
              </span>
              <input
                className="bg-transparent border-none focus:ring-0 focus:outline-none w-full ml-4 text-on-surface placeholder:text-outline/60 font-inter"
                placeholder="Search your network by name, company, or role..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search connections"
              />
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-outline px-2 py-1 border border-outline-variant/30 rounded uppercase tracking-widest font-bold">
                  ⌘K
                </span>
              </div>
            </div>
          </motion.div>

          {/* ═══════════ CONNECTIONS GRID ═══════════ */}
          <AnimatePresence mode="wait">
            {loading || searching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card p-6 rounded-xl opacity-60">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-16 h-16 rounded-full shimmer" />
                      <div className="w-20 h-5 rounded-full shimmer" />
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="h-5 w-3/4 shimmer rounded" />
                      <div className="h-4 w-full shimmer rounded" />
                      <div className="h-3 w-1/2 shimmer rounded" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 h-10 shimmer rounded-lg" />
                      <div className="w-10 h-10 shimmer rounded-lg" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : displayList.length === 0 && !search ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {/* Empty state */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="border-2 border-dashed border-outline-variant/30 p-6 rounded-xl flex flex-col items-center justify-center text-center bg-surface-container-low/30 hover:border-primary/50 transition-colors cursor-pointer col-span-full"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center mb-4">
                    <span
                      className="material-symbols-outlined text-primary"
                      aria-hidden="true"
                    >
                      person_add
                    </span>
                  </div>
                  <h3 className="text-on-surface font-geist text-lg font-semibold mb-1">
                    No {tab} yet
                  </h3>
                  <p className="text-on-surface-variant font-inter text-sm">
                    {tab === "followers"
                      ? "When people follow you, they'll appear here."
                      : "Start following people to see them here."}
                  </p>
                </motion.div>
              </motion.div>
            ) : displayList.length === 0 && search ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <span
                  className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4"
                  aria-hidden="true"
                >
                  search_off
                </span>
                <p className="text-on-surface-variant font-inter text-lg">
                  No users found matching &ldquo;{search}&rdquo;
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`grid-${tab}`}
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {displayList.map((profile) => (
                  <ConnectionCard
                    key={profile.id}
                    profile={profile}
                    isFollowing={followingIds.includes(profile.id)}
                    isSelf={user?.id === profile.id}
                    onToggleFollow={toggleFollow}
                  />
                ))}

                {/* Expand Network Card */}
                {!search && (
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      /* Navigate to discover/explore */
                    }}
                    className="border-2 border-dashed border-outline-variant/30 p-6 rounded-xl flex flex-col items-center justify-center text-center bg-surface-container-low/30 hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <span
                        className="material-symbols-outlined text-primary"
                        aria-hidden="true"
                      >
                        person_add
                      </span>
                    </div>
                    <h3 className="text-on-surface font-geist text-lg font-semibold mb-1">
                      Expand Network
                    </h3>
                    <p className="text-on-surface-variant font-inter text-sm">
                      Discover more leaders in architectural intelligence
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════ LOAD MORE ═══════════ */}
          {!search && list.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-20 flex flex-col items-center"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-12 py-4 bg-surface-container-highest text-on-surface font-inter text-sm rounded-xl hover:bg-surface-bright transition-colors border border-outline-variant/30 flex items-center gap-2 group"
              >
                Load More Connections
                <span
                  className="material-symbols-outlined group-hover:translate-y-1 transition-transform"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </motion.button>
              <p className="mt-6 text-outline font-inter text-sm">
                Showing {list.length} {tab}
              </p>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

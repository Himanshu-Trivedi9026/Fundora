// pages/dm/index.js
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

/* ─── Animation Variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function DMInbox() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      else setUserId(data.user.id);
    });
  }, [router]);

  const loadInbox = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const { data } = await supabase
        .from("dm_conversations")
        .select(`
          id,
          user1,
          user2,
          created_at,
          dm_messages (
            content,
            created_at
          )
        `)
        .or(`user1.eq.${userId},user2.eq.${userId}`)
        .order("created_at", { ascending: false });

      setThreads(data || []);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadInbox();

    const channel = supabase
      .channel("dm-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        () => loadInbox()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId, loadInbox]);

  function openThread(thread) {
    const otherUser =
      thread.user1 === userId ? thread.user2 : thread.user1;
    router.push(`/dm/${otherUser}`);
  }

  function getLastMessage(thread) {
    const msgs = thread.dm_messages || [];
    if (msgs.length === 0) return "No messages yet";
    return msgs[0].content || "Attachment";
  }

  function getTimestamp(thread) {
    const msgs = thread.dm_messages || [];
    const date = msgs.length > 0 ? msgs[0].created_at : thread.created_at;
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const filteredThreads = threads.filter((t) => {
    if (!search.trim()) return true;
    const lastMsg = getLastMessage(t).toLowerCase();
    return lastMsg.includes(search.toLowerCase());
  });

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <main className="pt-32 pb-24 min-h-screen flex-1">
          <div className="max-w-3xl mx-auto px-6">
            <div className="flex items-center justify-between mb-8">
              <div className="h-9 w-40 shimmer rounded" />
            </div>
            <div className="glass-card rounded-xl mb-6">
              <div className="h-12 shimmer rounded-xl" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card p-4 rounded-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full shimmer shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 shimmer rounded" />
                    <div className="h-3 w-2/3 shimmer rounded" />
                  </div>
                  <div className="h-3 w-12 shimmer rounded" />
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-32 pb-24 min-h-screen flex-1 relative">
        {/* ─── Ambient Background Blobs ─── */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-primary-container/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-3xl mx-auto px-6">

          {/* ═══════════ HEADER ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="font-geist text-3xl md:text-4xl font-bold text-on-surface tracking-tighter">
                Messages
              </h1>
              <p className="text-on-surface-variant font-inter text-sm mt-1">
                {threads.length} conversation{threads.length !== 1 ? "s" : ""}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary hover:bg-primary-container/30 transition-colors"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">edit_square</span>
            </motion.button>
          </motion.div>

          {/* ═══════════ SEARCH ═══════════ */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-6"
          >
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl" aria-hidden="true">
                search
              </span>
              <input
                className="w-full bg-surface-container border border-outline-variant rounded-xl pl-12 pr-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface placeholder:text-on-surface-variant/50 font-inter text-sm outline-none transition-all"
                placeholder="Search conversations..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search conversations"
              />
            </div>
          </motion.div>

          {/* ═══════════ CONVERSATION LIST ═══════════ */}
          {filteredThreads.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-12 rounded-xl text-center"
            >
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4" aria-hidden="true">
                {search ? "search_off" : "forum"}
              </span>
              <h3 className="font-geist text-lg font-semibold text-on-surface mb-2">
                {search ? "No matches found" : "No conversations yet"}
              </h3>
              <p className="text-on-surface-variant font-inter text-sm">
                {search
                  ? "Try a different search term"
                  : "Start a conversation with a creator or backer"}
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {filteredThreads.map((thread) => {
                const otherUserId =
                  thread.user1 === userId ? thread.user2 : thread.user1;

                return (
                  <motion.div
                    key={thread.id}
                    variants={fadeUp}
                    whileHover={{ x: 4 }}
                    onClick={() => openThread(thread)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openThread(thread);
                      }
                    }}
                    className="glass-card p-4 rounded-xl cursor-pointer hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant/50 text-xl" aria-hidden="true">
                            person
                          </span>
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface-container rounded-full" aria-hidden="true" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-geist text-sm font-semibold text-on-surface truncate">
                            {otherUserId.slice(0, 8)}...
                          </span>
                          <span className="text-[11px] text-on-surface-variant/60 shrink-0 ml-2">
                            {getTimestamp(thread)}
                          </span>
                        </div>
                        <p className="text-on-surface-variant/70 font-inter text-sm truncate">
                          {getLastMessage(thread)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}

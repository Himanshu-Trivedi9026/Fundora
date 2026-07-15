// pages/dm/index.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function DMInbox() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      else setUserId(data.user.id);
    });
  }, []);

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
  }, [userId]);

  async function loadInbox() {
    setLoading(true);

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
    setLoading(false);
  }

  function openThread(thread) {
    const otherUser =
      thread.user1 === userId ? thread.user2 : thread.user1;
    router.push(`/dm/${otherUser}`);
  }

  if (loading) {
    return (
      <div role="status" aria-label="Loading conversations" className="min-h-screen flex items-center justify-center text-white">
        Loading inbox...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

        {threads.length === 0 ? (
          <p className="text-slate-400">No conversations yet.</p>
        ) : (
          <div className="space-y-3">
            {threads.map((t) => (
              <div
                key={t.id}
                onClick={() => openThread(t)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThread(t); } }}
                className="p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700"
              >
                <p className="text-white text-sm truncate">
                  {t.dm_messages?.[0]?.content || "New conversation"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(
                    t.dm_messages?.[0]?.created_at || t.created_at
                  ).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

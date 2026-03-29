import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";

export default function FollowersPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("followers");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

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

  useEffect(() => {
    if (!user || search) return;
    loadConnections();
  }, [user, tab, search]);

  async function loadConnections() {
    setLoading(true);

    const { data: followRows, error } = await supabase
      .from("followers")
      .select(tab === "followers" ? "follower_id" : "following_id")
      .eq(
        tab === "followers" ? "following_id" : "follower_id",
        user.id
      );

    if (error || !followRows || followRows.length === 0) {
      setList([]);
      setLoading(false);
      return;
    }

    const ids = followRows.map((r) =>
      tab === "followers" ? r.follower_id : r.following_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);

    setList(profiles || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${search}%`)
        .limit(10);

      setSearchResults(data || []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  async function toggleFollow(targetId) {
    if (!user) return;

    const isFollowing = followingIds.includes(targetId);

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);

      setFollowingIds((prev) =>
        prev.filter((id) => id !== targetId)
      );
    } else {
      await supabase.from("followers").insert({
        follower_id: user.id,
        following_id: targetId,
      });

      setFollowingIds((prev) => [...prev, targetId]);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />

      {/* 🔥 PREMIUM LAYOUT */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">

          {/* TITLE */}
          <h1 className="text-3xl font-bold text-white text-center mb-8">
            Connections
          </h1>

          {/* TABS */}
          <div className="flex justify-center gap-3 mb-8">
            <button
              onClick={() => setTab("followers")}
              className={`px-5 py-2 rounded-full text-sm transition ${
                tab === "followers"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Followers
            </button>

            <button
              onClick={() => setTab("following")}
              className={`px-5 py-2 rounded-full text-sm transition ${
                tab === "following"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Following
            </button>
          </div>

          {/* SEARCH */}
          <div className="max-w-md mx-auto mb-10">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* 🔍 SEARCH RESULTS */}
          {search && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">

              {searching && (
                <p className="text-center text-slate-400 col-span-full">
                  Searching...
                </p>
              )}

              {!searching && searchResults.length === 0 && (
                <p className="text-center text-slate-400 col-span-full">
                  No users found.
                </p>
              )}

              {searchResults.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] transition"
                >
                  <img
                    src={
                      p.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        p.full_name || "User"
                      )}`
                    }
                    className="w-14 h-14 rounded-full border border-slate-600"
                  />

                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {p.full_name || "User"}
                    </p>
                  </div>

                  {user?.id !== p.id && (
                    <button
                      onClick={() => toggleFollow(p.id)}
                      className={`px-3 py-1 rounded text-xs ${
                        followingIds.includes(p.id)
                          ? "bg-slate-700 text-slate-300"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {followingIds.includes(p.id)
                        ? "Unfollow"
                        : "+ Follow"}
                    </button>
                  )}
                </div>
              ))}

            </div>
          )}

          {/* 👥 NORMAL LIST */}
          {!search && (
            <>
              {loading ? (
                <p className="text-center text-slate-400">Loading...</p>
              ) : list.length === 0 ? (
                <p className="text-center text-slate-400">No users found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                  {list.map((p) => (
                    <Link key={p.id} href={`/creator/${p.id}`}>
                      <div className="cursor-pointer bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] transition">

                        <img
                          src={
                            p.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              p.full_name || "User"
                            )}`
                          }
                          className="w-14 h-14 rounded-full border border-slate-600"
                        />

                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {p.full_name || "User"}
                          </p>
                        </div>

                      </div>
                    </Link>
                  ))}

                </div>
              )}
            </>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
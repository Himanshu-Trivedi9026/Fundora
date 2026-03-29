import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { signOutUser } from "../lib/auth";
import { FaEnvelope, FaChartBar } from "react-icons/fa";
import { FiMenu } from "react-icons/fi";
import { useRouter } from "next/router";

/* -------------------------------------------
   MENU ITEM HELPER (UI ONLY)
------------------------------------------- */
function MenuItem({ href, onClick, label, danger }) {
  const base =
    "block w-full px-4 py-2.5 text-sm transition rounded-md mx-1";

  const normal =
    "text-slate-200 hover:bg-slate-700/60 hover:text-white";

  const dangerStyle =
    "text-red-400 hover:bg-red-500/10 hover:text-red-300";

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} ${danger ? dangerStyle : normal}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${base} ${danger ? dangerStyle : normal} text-left`}
    >
      {label}
    </button>
  );
}

export default function Navbar({ onToggleFilters }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  /* ---------------- LOAD USER ---------------- */
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);

      if (u) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .single();

        setProfile(prof);
        loadUnread(u.id);
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user || null;
        setUser(u);

        if (u) {
          supabase
            .from("profiles")
            .select("*")
            .eq("id", u.id)
            .single()
            .then((res) => setProfile(res.data));

          loadUnread(u.id);
        }
      }
    );

    return () => listener?.subscription?.unsubscribe();
  }, []);

  /* ---------------- START PROJECT ---------------- */
  const handleStartProject = () => {
    if (!user) {
      router.push("/login?redirect=/create");
    } else {
      router.push("/create");
    }
  };

  /* ---------------- UNREAD DM COUNT ---------------- */
  async function loadUnread(userId) {
    const { count } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", userId)
      .eq("read", false);

    setUnreadCount(count || 0);
  }

  const avatarSrc =
    profile?.avatar_url ||
    `https://ui-avatars.com/api/?bold=true&background=0D8ABC&color=fff&name=${
      profile?.full_name || user?.email || "User"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

        {/* LEFT */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFilters}
            className="text-slate-300 hover:text-white p-2 rounded-md hover:bg-slate-800"
            aria-label="Open filters"
          >
            <FiMenu size={22} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Fundora" className="h-10 w-auto" />
            <span className="text-xl font-semibold text-white">Fundora</span>
          </Link>
        </div>

        {/* CENTER */}
        <div className="hidden md:flex items-center gap-5 text-sm text-slate-300">
          <Link href="/explore" className="hover:text-blue-400">
            Explore
          </Link>

          <button
            onClick={handleStartProject}
            className="hover:text-blue-400"
          >
            Start a project
          </button>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {!user && (
            <>
              <Link
                href="/login"
                className="hidden md:inline-flex rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Log in
              </Link>

              <Link
                href="/signup"
                className="inline-flex rounded-full bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Sign up
              </Link>
            </>
          )}

          {user && (
            <>
              {/* 📊 ANALYTICS BUTTON (NEW) */}
              <button
                onClick={() => router.push("/creator/analytics")}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full
                           bg-slate-800 text-slate-200 text-xs hover:bg-blue-600 hover:text-white transition"
              >
                <FaChartBar size={14} />
                Analytics
              </button>

              {/* MESSAGES */}
              <Link
                href="/dm"
                className="relative text-slate-300 hover:text-white"
              >
                <FaEnvelope size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white
                    text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* AVATAR + MENU */}
              <div className="relative">
                <img
                  src={avatarSrc}
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-9 h-9 rounded-full cursor-pointer border border-slate-600"
                />

                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-60 rounded-2xl bg-slate-900/95 backdrop-blur
                                  border border-slate-700 shadow-2xl overflow-hidden z-50">

                    {/* PROFILE HEADER */}
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-sm font-semibold text-white truncate">
                        {profile?.full_name || user?.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        Account menu
                      </p>
                    </div>

                    {/* ITEMS */}
                    <div className="py-2">
                      <MenuItem href={`/creator/${user.id}`} label="View Profile" />
                      <MenuItem href="/creator/analytics" label="Analytics" />
                      <MenuItem href="/creator/payments" label="Razorpay Setup" />
                      <MenuItem href="/payments" label="My Payments" />
                      <MenuItem href="/creator/profile" label="Edit Payment Portal" />
                      <MenuItem href="/followers" label="Followers" />

                      <div className="my-2 border-t border-slate-700" />

                      <MenuItem
                        href="/account/delete"
                        label="Delete Account"
                        danger
                      />

                      <button
                        onClick={async () => {
                          await signOutUser();
                          setMenuOpen(false);
                          setUser(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400
                                   hover:bg-red-500/10 hover:text-red-300 transition"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

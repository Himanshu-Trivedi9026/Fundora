import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { signOutUser } from "../lib/auth";
import { useRouter } from "next/router";

/* Inline SVG icons — eliminates 2.2MB react-icons/fa + react-icons/fi from Navbar */
function EnvelopeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChartBarIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-7" />
    </svg>
  );
}

function MenuIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

/* -------------------------------------------
   MENU ITEM HELPER (UI ONLY)
------------------------------------------- */
function MenuItem({ href, onClick, label, danger }) {
  const base =
    "block w-full px-4 py-2.5 text-sm transition rounded-md mx-1";

  const normal =
    "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface";

  const dangerStyle =
    "text-danger hover:bg-danger-muted hover:text-danger";

  if (href) {
    return (
      <Link
        href={href}
        role="menuitem"
        className={`${base} ${danger ? dangerStyle : normal}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      role="menuitem"
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
        // Parallelize profile + unread queries (was sequential)
        const [profResult, unreadCount] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", u.id).single(),
          supabase
            .from("dm_messages")
            .select("id", { count: "exact", head: true })
            .neq("sender_id", u.id)
            .eq("read", false),
        ]);

        setProfile(profResult.data);
        setUnreadCount(unreadCount.count || 0);
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user || null;
        setUser(u);

        if (u) {
          // Parallelize on auth change too
          Promise.all([
            supabase.from("profiles").select("*").eq("id", u.id).single(),
            supabase
              .from("dm_messages")
              .select("id", { count: "exact", head: true })
              .neq("sender_id", u.id)
              .eq("read", false),
          ]).then(([profResult, unreadResult]) => {
            setProfile(profResult.data);
            setUnreadCount(unreadResult.count || 0);
          });
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

  const avatarSrc =
    profile?.avatar_url ||
    `https://ui-avatars.com/api/?bold=true&background=8b5cf6&color=fff&name=${
      profile?.full_name || user?.email || "User"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-dim/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

        {/* LEFT */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFilters}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-md hover:bg-surface-container-high/50"
            aria-label="Open filters"
          >
            <MenuIcon size={22} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Fundora" className="h-10 w-auto" />
            <span className="text-xl font-semibold text-on-surface">Fundora</span>
          </Link>
        </div>

        {/* CENTER */}
        <div className="hidden md:flex items-center gap-5 text-sm text-on-surface-variant">
          <Link href="/explore" className="hover:text-primary transition-colors">
            Explore
          </Link>

          <button
            onClick={handleStartProject}
            className="hover:text-primary transition-colors"
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
                className="hidden md:inline-flex rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high/50 transition-colors"
              >
                Log in
              </Link>

              <Link
                href="/signup"
                className="inline-flex rounded-full bg-primary px-4 py-1.5 text-xs text-on-primary hover:bg-primary/90 transition-colors"
              >
                Sign up
              </Link>
            </>
          )}

          {user && (
            <>
              {/* ANALYTICS BUTTON */}
              <button
                onClick={() => router.push("/creator/analytics")}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full
                           bg-surface-container-high/50 text-on-surface-variant text-xs hover:bg-primary hover:text-on-primary transition-colors"
              >
                <ChartBarIcon size={14} />
                Analytics
              </button>

              {/* MESSAGES */}
              <Link
                href="/dm"
                className="relative text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              >
                <EnvelopeIcon size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-danger text-white
                    text-[10px] w-5 h-5 rounded-full flex items-center justify-center" aria-hidden="true">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* AVATAR + MENU */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className="w-9 h-9 rounded-full cursor-pointer border border-white/[0.08] overflow-hidden"
                >
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 mt-3 w-60 rounded-2xl glass-card
                              shadow-glass-lg overflow-hidden z-50"
                  >

                    {/* PROFILE HEADER */}
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-sm font-semibold text-on-surface truncate">
                        {profile?.full_name || user?.email}
                      </p>
                      <p className="text-xs text-muted">
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

                      <div className="my-2 border-t border-white/[0.06]" />

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
                        className="w-full text-left px-4 py-2.5 text-sm text-danger
                                   hover:bg-danger-muted hover:text-danger transition"
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

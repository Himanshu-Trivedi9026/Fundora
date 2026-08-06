import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOutUser } from "../lib/auth";
import { useRouter } from "next/router";
import { useRole } from "../context/RoleContext";
import {
  canStartProject,
  startProjectHref,
  canAccessArea,
} from "../lib/roles";

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

/* ─── Role Badge & Menu Definitions ─── */
const ROLE_BADGE = {
  platform_admin: { label: "Admin", class: "bg-amber-500/20 text-amber-400 border border-amber-500/20" },
  creator: { label: "Creator", class: "bg-purple-500/20 text-purple-400 border border-purple-500/20" },
  donor: { label: "Investor", class: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" },
};

const ROLE_MENUS = {
  donor: [
    { href: "/investor/dashboard", label: "Dashboard" },
    { href: "/investor/portfolio", label: "Portfolio" },
    { href: "/investor/analytics", label: "Analytics" },
    { href: "/investor/investments", label: "Investments" },
    { href: "/saved", label: "Saved Projects" },
    { href: "/investor/payment-history", label: "Payment History" },
  ],
  creator: [
    { href: "/creator/dashboard", label: "Dashboard" },
    { href: "/creator/projects", label: "My Campaigns" },
    { href: "/creator/analytics", label: "Analytics" },
    /* AI Insights — required path /creator/insights has no page; the real
       AI page lives at /creator/ai-assistant (would otherwise fall through
       to the dynamic /creator/[id] profile route). */
    { href: "/creator/ai-assistant", label: "AI Insights" },
    { href: "/creator/verification", label: "Verification" },
    { href: "/creator/payouts", label: "Payouts" },
    /* Razorpay — required path /creator/razorpay has no page; the real
       Razorpay portal lives at /creator/payments. */
    { href: "/creator/payments", label: "Razorpay" },
    /* Followers — required path /creator/followers has no page; the real
       page lives at /followers. */
    { href: "/followers", label: "Followers" },
  ],
  platform_admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/organizations", label: "Users" },
    { href: "/admin/verification-review", label: "Verification Queue" },
    { href: "/admin/fraud", label: "Fraud Detection" },
    { href: "/admin/escrow", label: "Escrow" },
    { href: "/admin/compliance", label: "Compliance" },
    { href: "/admin/audit-logs", label: "Audit Logs" },
    { href: "/admin/infrastructure", label: "System Health" },
  ],
};

export default function Navbar({ onToggleFilters, onToggleSidebar, sidebarCollapsed }) {
  const { user, profile, role, isAdmin, isCreator, isDonor } = useRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const router = useRouter();

  const avatarSrc =
    avatarError || !profile?.avatar_url
      ? `https://ui-avatars.com/api/?bold=true&background=8b5cf6&color=fff&name=${
          profile?.full_name || user?.email || "User"
        }`
      : profile.avatar_url;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-dim/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

        {/* LEFT */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar || onToggleFilters}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-md hover:bg-surface-container-high/50 transition-colors"
            aria-label={onToggleSidebar ? (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar") : "Open filters"}
          >
            <MenuIcon size={22} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Fundora" width={41} height={40} className="h-10 w-auto" priority />
            <span className="text-xl font-semibold text-on-surface">Fundora</span>
          </Link>
        </div>

        {/* CENTER */}
        <div className="hidden md:flex items-center gap-5 text-sm text-on-surface-variant">
          <Link href="/explore" className="hover:text-primary transition-colors">
            Explore
          </Link>

          {/* Start Project is a creator-only affordance (see lib/roles.js).
              Guests are onboarded via /get-started; investors never see it. */}
          {canStartProject({ role }) && (
            <Link
              href={startProjectHref({ role })}
              className="hover:text-primary transition-colors"
            >
              Start a project
            </Link>
          )}
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
              {/* ANALYTICS BUTTON — creator-area route, so only roles that can
                  access /creator/* (creator, platform_admin) see it. */}
              {canAccessArea(role, "creator") && (
                <button
                  onClick={() => router.push("/creator/analytics")}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full
                             bg-surface-container-high/50 text-on-surface-variant text-xs hover:bg-primary hover:text-on-primary transition-colors"
                >
                  <ChartBarIcon size={14} />
                  Analytics
                </button>
              )}

              {/* MESSAGES */}
              <Link
                href="/dm"
                className="relative text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Messages"
              >
                <EnvelopeIcon size={18} />
              </Link>

              {/* AVATAR + MENU */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className="w-9 h-9 rounded-full cursor-pointer border border-white/[0.08] overflow-hidden relative"
                >
                  <Image
                    src={avatarSrc}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                    onError={() => setAvatarError(true)}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 mt-3 w-60 rounded-2xl glass-card
                              shadow-glass-lg overflow-hidden z-50"
                  >

                    {/* PROFILE HEADER + ROLE BADGE */}
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-2">
                        <Image
                          src={avatarSrc}
                          alt=""
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover border border-white/[0.1]"
                          onError={() => setAvatarError(true)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {profile?.full_name || user?.email}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[role]?.class || ROLE_BADGE.donor.class}`}>
                        {ROLE_BADGE[role]?.label || "Investor"}
                      </span>
                    </div>

                    {/* ROLE-SPECIFIC MENU ITEMS */}
                    <div className="py-1">
                      {(ROLE_MENUS[role] || ROLE_MENUS.donor).map((item) => (
                        <MenuItem key={item.href} href={item.href} label={item.label} />
                      ))}
                    </div>

                    {/* COMMON ITEMS */}
                    {/* Settings — required path /settings has no page; the
                        existing account-settings page is /edit-profile. */}
                    <div className="py-1 border-t border-white/[0.06]">
                      <MenuItem href="/edit-profile" label="Settings" />
                    </div>

                    <div className="py-1 border-t border-white/[0.06]">
                      <MenuItem href="/account/delete" label="Delete Account" danger />

                      <button
                        onClick={async () => {
                          setMenuOpen(false);
                          await signOutUser();
                          router.push("/");
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

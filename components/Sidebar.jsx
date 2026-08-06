/**
 * Sidebar — Role-aware collapsible sidebar navigation.
 *
 * Shows role-appropriate sections with grouped links and icons.
 * Roles: platform_admin, creator, donor (investor)
 */

import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useRole } from "../context/RoleContext";

/* ─── Inline SVG Icons ─── */

function Icon({ svg, size = 18 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="shrink-0 inline-flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const ICONS = {
  // Navigation
  dashboard:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  explore:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  saved:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  portfolio:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  investments:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  payments:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  history:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  receipts:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',

  // Creator
  projects:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  create:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  ai: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-4 5-2-2-4-3-4-5a4 4 0 0 1 4-4z"/><path d="M12 11v9"/><path d="M8 17h8"/></svg>',
  analytics:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-7"/></svg>',
  recommendations:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  predictions:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  earnings:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  escrow:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  milestones:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  payouts:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  verification:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  security:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',

  // Social
  messages:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  notifications:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  followers:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>',
  profile:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',

  // Admin
  adminDashboard:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>',
  fraud:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  compliance:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  appeals:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>',
  moderation:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  organizations:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  tenants:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  flags:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  branding:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  marketplace:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  plugins:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  connectors:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="8" height="8" rx="1"/><rect x="15" y="1" width="8" height="8" rx="1"/><rect x="1" y="15" width="8" height="8" rx="1"/><rect x="15" y="15" width="8" height="8" rx="1"/><line x1="9" y1="5" x2="15" y2="5"/><line x1="5" y1="9" x2="5" y2="15"/></svg>',
  integrations:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  agents:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  infrastructure:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/></svg>',
  observability:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12L6 8 10 12 14 8 18 12 22 8"/><path d="M2 17L6 13 10 17 14 13 18 17 22 13"/></svg>',
  policies:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  developer:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',

  // Utility
  collapse:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  expand:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  help: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

/* ─── Section Definitions ─── */

const SECTIONS = {
  donor: [
    {
      title: "Dashboard",
      items: [
        {
          label: "Overview",
          href: "/investor/dashboard",
          icon: ICONS.dashboard,
        },
      ],
    },
    {
      title: "Discover",
      items: [
        { label: "Explore", href: "/explore", icon: ICONS.explore },
        { label: "Saved Projects", href: "/saved", icon: ICONS.saved },
      ],
    },
    {
      title: "Portfolio",
      items: [
        {
          label: "My Investments",
          href: "/investor/investments",
          icon: ICONS.investments,
        },
        {
          label: "Portfolio",
          href: "/investor/portfolio",
          icon: ICONS.portfolio,
        },
        {
          label: "Analytics",
          href: "/investor/analytics",
          icon: ICONS.analytics,
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          label: "Payment History",
          href: "/investor/payment-history",
          icon: ICONS.history,
        },
        {
          label: "My Receipts",
          href: "/investor/receipts",
          icon: ICONS.receipts,
        },
      ],
    },
    {
      title: "Social",
      items: [
        { label: "Messages", href: "/dm", icon: ICONS.messages },
        {
          label: "Notifications",
          href: "/notifications",
          icon: ICONS.notifications,
        },
        { label: "Followers", href: "/followers", icon: ICONS.followers },
      ],
    },
  ],
  creator: [
    {
      title: "Dashboard",
      items: [
        {
          label: "Creator Home",
          href: "/creator/dashboard",
          icon: ICONS.dashboard,
        },
        {
          label: "Analytics",
          href: "/creator/analytics",
          icon: ICONS.analytics,
        },
      ],
    },
    {
      title: "Campaigns",
      items: [
        {
          label: "My Projects",
          href: "/creator/projects",
          icon: ICONS.projects,
        },
        { label: "Create Campaign", href: "/create", icon: ICONS.create },
        {
          label: "AI Assistant",
          href: "/creator/ai-assistant",
          icon: ICONS.ai,
        },
        {
          label: "Recommendations",
          href: "/creator/recommendations",
          icon: ICONS.recommendations,
        },
        {
          label: "Predictions",
          href: "/creator/predictions",
          icon: ICONS.predictions,
        },
      ],
    },
    {
      title: "Finance",
      items: [
        { label: "Earnings", href: "/creator/earnings", icon: ICONS.earnings },
        { label: "Escrow", href: "/creator/escrow", icon: ICONS.escrow },
        {
          label: "Milestones",
          href: "/creator/milestones",
          icon: ICONS.milestones,
        },
        { label: "Payouts", href: "/creator/payouts", icon: ICONS.payouts },
      ],
    },
    {
      title: "Verification",
      items: [
        {
          label: "Verification Center",
          href: "/creator/verification",
          icon: ICONS.verification,
        },
        {
          label: "Business Verification",
          href: "/creator/business-verification",
          icon: ICONS.compliance,
        },
        {
          label: "Bank Verification",
          href: "/creator/bank-verification",
          icon: ICONS.payments,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          label: "Fraud Status",
          href: "/creator/fraud-status",
          icon: ICONS.security,
        },
        {
          label: "Reputation",
          href: "/creator/reputation",
          icon: ICONS.recommendations,
        },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Profile", href: `/creator/`, icon: ICONS.profile },
        { label: "Edit Profile", href: "/creator/edit", icon: ICONS.settings },
        { label: "Messages", href: "/dm", icon: ICONS.messages },
        {
          label: "Notifications",
          href: "/notifications",
          icon: ICONS.notifications,
        },
        { label: "Followers", href: "/followers", icon: ICONS.followers },
      ],
    },
  ],
  platform_admin: [
    {
      title: "Overview",
      items: [
        {
          label: "Admin Dashboard",
          href: "/admin/dashboard",
          icon: ICONS.dashboard,
        },
        {
          label: "Platform Analytics",
          href: "/admin/analytics",
          icon: ICONS.analytics,
        },
      ],
    },
    {
      title: "Verification & Security",
      items: [
        {
          label: "Verification Review",
          href: "/admin/verification-review",
          icon: ICONS.verification,
        },
        { label: "Fraud Center", href: "/admin/fraud", icon: ICONS.fraud },
      ],
    },
    {
      title: "Finance",
      items: [
        { label: "Escrow Center", href: "/admin/escrow", icon: ICONS.escrow },
        {
          label: "Payout Approvals",
          href: "/admin/payout-approvals",
          icon: ICONS.payouts,
        },
      ],
    },
    {
      title: "Compliance",
      items: [
        {
          label: "Compliance Center",
          href: "/admin/compliance",
          icon: ICONS.compliance,
        },
        { label: "Appeals", href: "/admin/appeals", icon: ICONS.appeals },
        {
          label: "Moderation",
          href: "/admin/moderation",
          icon: ICONS.moderation,
        },
        { label: "Policies", href: "/admin/policies", icon: ICONS.policies },
      ],
    },
    {
      title: "Platform",
      items: [
        {
          label: "Organizations",
          href: "/admin/organizations",
          icon: ICONS.organizations,
        },
        { label: "Tenants", href: "/admin/tenants", icon: ICONS.tenants },
        {
          label: "Feature Flags",
          href: "/admin/feature-flags",
          icon: ICONS.flags,
        },
        { label: "Branding", href: "/admin/branding", icon: ICONS.branding },
      ],
    },
    {
      title: "Ecosystem",
      items: [
        {
          label: "Marketplace",
          href: "/admin/marketplace",
          icon: ICONS.marketplace,
        },
        { label: "Plugins", href: "/admin/plugins", icon: ICONS.plugins },
        {
          label: "Connectors",
          href: "/admin/connectors",
          icon: ICONS.connectors,
        },
        {
          label: "Integrations",
          href: "/admin/integrations",
          icon: ICONS.integrations,
        },
        { label: "Agents", href: "/admin/agents", icon: ICONS.agents },
      ],
    },
    {
      title: "Infrastructure",
      items: [
        {
          label: "Infrastructure",
          href: "/admin/infrastructure",
          icon: ICONS.infrastructure,
        },
        {
          label: "Observability",
          href: "/admin/observability",
          icon: ICONS.observability,
        },
      ],
    },
    {
      title: "Monitoring",
      items: [
        { label: "Audit Logs", href: "/admin/audit-logs", icon: ICONS.history },
        {
          label: "Observability",
          href: "/admin/observability",
          icon: ICONS.observability,
        },
      ],
    },
    {
      title: "Enterprise",
      items: [
        {
          label: "Automation",
          href: "/enterprise/automation",
          icon: ICONS.agents,
        },
        {
          label: "Connectors",
          href: "/enterprise/connectors",
          icon: ICONS.connectors,
        },
        {
          label: "Currency",
          href: "/enterprise/currency",
          icon: ICONS.payments,
        },
        { label: "Events", href: "/enterprise/events", icon: ICONS.connectors },
        {
          label: "Exports",
          href: "/enterprise/exports",
          icon: ICONS.analytics,
        },
        {
          label: "Feature Flags",
          href: "/enterprise/feature-flags",
          icon: ICONS.flags,
        },
        {
          label: "Language",
          href: "/enterprise/language",
          icon: ICONS.branding,
        },
        {
          label: "Marketplace",
          href: "/enterprise/marketplace",
          icon: ICONS.marketplace,
        },
        { label: "MCP", href: "/enterprise/mcp", icon: ICONS.ai },
        {
          label: "Observability",
          href: "/enterprise/observability",
          icon: ICONS.observability,
        },
        { label: "Plugins", href: "/enterprise/plugins", icon: ICONS.plugins },
      ],
    },
    {
      title: "Developer",
      items: [
        {
          label: "Developer Portal",
          href: "/developer",
          icon: ICONS.developer,
        },
      ],
    },
  ],
};

export default function Sidebar({ collapsed, onToggle }) {
  const router = useRouter();
  const { role, profile, user, loading } = useRole();
  const [activePath, setActivePath] = useState("");
  const [prevActivePath, setPrevActivePath] = useState("");

  // Sync active path with router.asPath on route changes. The initial value and
  // any subsequent asPath change are applied during render (not in an effect) to
  // satisfy React 19's set-state-in-effect rule; the routeChangeComplete listener
  // covers the async navigation events fired by the router.
  const currentPath = router.asPath ? router.asPath.split("?")[0] : "";
  if (prevActivePath !== currentPath) {
    setPrevActivePath(currentPath);
    setActivePath(currentPath);
  }

  useEffect(() => {
    const handleRouteChange = (url) => {
      setActivePath(url.split("?")[0]);
    };
    router.events?.on("routeChangeComplete", handleRouteChange);
    return () => router.events?.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  // Expanded/collapsed sections persisted to localStorage
  const [expandedSections, setExpandedSections] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("sidebarExpandedSections");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSection = useCallback((title) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      try {
        localStorage.setItem(
          "sidebarExpandedSections",
          JSON.stringify([...next]),
        );
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  // Auto-expand section containing the active path. Deferred via queueMicrotask
  // so the state write is not a synchronous setState-in-effect (React 19 rule).
  useEffect(() => {
    queueMicrotask(() => {
      const sections = SECTIONS[role] || SECTIONS.donor;
      const sectionWithActive = sections.find((s) =>
        s.items.some((item) => {
          const href = item.href.replace(/\/$/, "");
          return activePath === href || activePath.startsWith(href);
        }),
      );
      if (sectionWithActive && !expandedSections.has(sectionWithActive.title)) {
        setExpandedSections((prev) => {
          const next = new Set(prev);
          next.add(sectionWithActive.title);
          try {
            localStorage.setItem(
              "sidebarExpandedSections",
              JSON.stringify([...next]),
            );
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    });
  }, [activePath, role, expandedSections]);

  const sections = SECTIONS[role] || SECTIONS.donor;

  const navTo = (href) => {
    const resolved = href.replace(/\/$/, "");
    if (href.startsWith("/creator/") && href === "/creator/") {
      if (user) {
        router.push(`/creator/${user.id}`);
        return;
      }
    }
    router.push(href);
  };

  const isActive = (href) => {
    const clean = href.replace(/\/$/, "");
    if (clean === "/creator/") {
      return (
        activePath.startsWith("/creator/") &&
        !SECTIONS.creator.some((s) =>
          s.items.some(
            (i) =>
              i.href !== "/creator/" &&
              i.href.replace(/\/$/, "") === activePath,
          ),
        )
      );
    }
    return (
      activePath === clean ||
      activePath.startsWith(clean + "/") ||
      activePath.startsWith(clean + "?")
    );
  };

  /* ─── Collapsed sidebar: just icons ─── */
  if (collapsed) {
    return (
      <motion.aside
        initial={{ width: 64 }}
        animate={{ width: 64 }}
        className="fixed left-0 top-0 h-full z-40 bg-surface-dim/80 backdrop-blur-xl border-r border-white/[0.06] flex flex-col pt-16"
      >
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {sections.flatMap((section) =>
            section.items.map((item) => (
              <button
                key={item.href}
                onClick={() => navTo(item.href)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  isActive(item.href)
                    ? "bg-primary/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
                }`}
                title={item.label}
                aria-label={item.label}
              >
                <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              </button>
            )),
          )}
        </nav>
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={onToggle}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-all duration-200 mx-auto"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <span dangerouslySetInnerHTML={{ __html: ICONS.expand }} />
          </button>
        </div>
      </motion.aside>
    );
  }

  /* ─── Expanded sidebar ─── */
  return (
    <motion.aside
      initial={{ width: 256 }}
      animate={{ width: 256 }}
      className="fixed left-0 top-0 h-full z-40 bg-surface-dim/80 backdrop-blur-xl border-r border-white/[0.06] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-on-surface font-geist tracking-wide uppercase">
          {role === "platform_admin"
            ? "Admin Panel"
            : role === "creator"
              ? "Creator Hub"
              : "Investor Hub"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3 scrollbar-thin">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.title);
          return (
            <div key={section.title}>
              {/* Clickable section header */}
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-on-surface transition-colors"
                aria-expanded={isExpanded}
              >
                <span>{section.title}</span>
                <span
                  className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              </button>

              {/* Collapsible items with CSS max-height transition */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="space-y-0.5 pt-0.5">
                  {section.items.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => navTo(item.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
                        isActive(item.href)
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
                      }`}
                      aria-label={item.label}
                    >
                      <span
                        className="shrink-0"
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-all duration-200"
        >
          <span
            className="shrink-0"
            dangerouslySetInnerHTML={{ __html: ICONS.collapse }}
          />
          <span>Collapse</span>
        </button>
      </div>
    </motion.aside>
  );
}

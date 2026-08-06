/**
 * QuickActions — Reusable quick action grid
 *
 * Usage:
 *   <QuickActions actions={[
 *     { label: "New Project", href: "/create", icon: "add_circle" },
 *     { label: "Analytics", href: "/creator/analytics", icon: "analytics", description: "View your stats" },
 *   ]} />
 */

import Link from "next/link";

export default function QuickActions({ actions = [], className = "" }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className="glass-card p-4 hover:border-primary/30 transition-all duration-200 group flex flex-col items-center text-center gap-2 fade-in-up"
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            <span
              className="material-symbols-outlined text-[28px] text-primary/80 group-hover:text-primary transition-colors"
              aria-hidden="true"
            >
              {action.icon || "arrow_forward"}
            </span>
            <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">
              {action.label}
            </span>
            {action.description && (
              <span className="text-[11px] text-on-surface-variant leading-tight">
                {action.description}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
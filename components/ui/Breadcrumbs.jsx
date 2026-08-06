/**
 * Breadcrumbs — Breadcrumb trail with chevron separators
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: "Dashboard", href: "/creator/dashboard" },
 *     { label: "Analytics" },
 *   ]} />
 */

import Link from "next/link";

export default function Breadcrumbs({ items = [], className = "" }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span
                  className="material-symbols-outlined text-[14px] text-outline"
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-outline hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast ? "text-on-surface font-medium" : "text-outline"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * SectionCard — Reusable dashboard section wrapper
 *
 * Handles loading, error, empty, and content states uniformly.
 *
 * Usage:
 *   <SectionCard title="Portfolio" icon="account_balance" loading loading={true}>
 *     <p>Content renders here on success</p>
 *   </SectionCard>
 */

import GlassCard from "../ui/GlassCard";
import Skeleton from "../ui/Skeleton";
import RetryError from "../ui/RetryError";
import EmptyState from "../ui/EmptyState";
import Link from "next/link";

export default function SectionCard({
  title,
  icon,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyIcon = "inbox",
  emptyTitle = "Nothing here yet",
  emptyAction,
  viewAllLink,
  children,
  className = "",
}) {
  return (
    <GlassCard className={className}>
      {/* Header */}
      {(title || viewAllLink) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon && (
              <span
                className="material-symbols-outlined text-[20px] text-primary"
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            {title && (
              <h3 className="text-sm font-semibold text-on-surface font-geist">
                {title}
              </h3>
            )}
          </div>
          {viewAllLink && (
            <Link
              href={viewAllLink}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </Link>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton.Card />
        </div>
      )}

      {/* Error state */}
      {!loading && error && <RetryError message={error} onRetry={onRetry} />}

      {/* Empty state */}
      {!loading && !error && empty && (
        <EmptyState icon={emptyIcon} title={emptyTitle} action={emptyAction} />
      )}

      {/* Content */}
      {!loading && !error && !empty && children}
    </GlassCard>
  );
}

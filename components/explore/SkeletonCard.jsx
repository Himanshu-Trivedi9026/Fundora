/**
 * SkeletonCard — Shimmer loading placeholder matching ExploreCard layout.
 */
export default function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full opacity-60">
      <div className="h-48 shimmer" />
      <div className="p-6 space-y-4">
        <div className="h-6 w-3/4 shimmer rounded" />
        <div className="h-4 w-full shimmer rounded" />
        <div className="h-4 w-5/6 shimmer rounded" />
        <div className="pt-6 space-y-2">
          <div className="h-2 w-full shimmer rounded" />
          <div className="flex justify-between">
            <div className="h-4 w-12 shimmer rounded" />
            <div className="h-4 w-12 shimmer rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

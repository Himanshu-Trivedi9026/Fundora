/**
 * Skeleton — Shimmer loading placeholders
 *
 * Usage:
 *   <Skeleton.Box width={320} height={48} />
 *   <Skeleton.Text lines={3} />
 *   <Skeleton.Card />
 */

export function SkeletonBox({
  width,
  height = 20,
  rounded = "rounded-lg",
  className = "",
}) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer ${rounded} ${className}`}
      style={{ width: width || "100%", height }}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  const widths = ["100%", "85%", "65%"];
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="shimmer rounded-md"
          style={{ width: widths[i] || "55%", height: 14 }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div aria-hidden="true" className={`glass-card p-6 space-y-4 ${className}`}>
      <div className="shimmer rounded-lg" style={{ width: 48, height: 48 }} />
      <div
        className="shimmer rounded-md"
        style={{ width: "60%", height: 18 }}
      />
      <div
        className="shimmer rounded-md"
        style={{ width: "100%", height: 14 }}
      />
      <div
        className="shimmer rounded-md"
        style={{ width: "80%", height: 14 }}
      />
    </div>
  );
}

export default function Skeleton({
  width,
  height = 20,
  rounded = "rounded-lg",
  className = "",
}) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer ${rounded} ${className}`}
      style={{ width: width || "100%", height }}
    />
  );
}

Skeleton.Box = SkeletonBox;
Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;

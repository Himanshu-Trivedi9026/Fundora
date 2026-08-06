/**
 * RetryError — Error state with retry button
 *
 * Usage:
 *   <RetryError message="Failed to load data" onRetry={fetchData} />
 */

import Button from "./Button";

export default function RetryError({
  message = "Something went wrong",
  onRetry,
  className = "",
}) {
  return (
    <div
      role="alert"
      className={`glass-card p-6 text-center border border-danger/20 ${className}`}
    >
      <span
        className="material-symbols-outlined text-[40px] text-danger mb-3"
        aria-hidden="true"
      >
        error_outline
      </span>
      <p className="text-on-surface-variant text-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Retry
        </Button>
      )}
    </div>
  );
}

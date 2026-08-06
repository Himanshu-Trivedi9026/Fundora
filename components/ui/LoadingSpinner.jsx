export default function LoadingSpinner({ size = "md", text, className = "" }) {
  const sizes = {
    sm: "text-[18px]",
    md: "text-[24px]",
    lg: "text-[36px]",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span
        className={`material-symbols-outlined animate-spin text-primary ${sizes[size]}`}
      >
        progress_activity
      </span>
      {text && (
        <p className="text-on-surface-variant font-inter text-sm">{text}</p>
      )}
    </div>
  );
}

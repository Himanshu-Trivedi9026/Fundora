export default function EmptyState({
  icon = "inbox",
  title = "Nothing here yet",
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`fade-in-up flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <span className="material-symbols-outlined text-[56px] text-outline-variant mb-4">
        {icon}
      </span>

      <h3 className="font-geist text-lg font-semibold text-on-surface mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-on-surface-variant font-inter text-sm max-w-sm mb-6">
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}

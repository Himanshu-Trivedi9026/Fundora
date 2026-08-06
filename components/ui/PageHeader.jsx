export default function PageHeader({
  title,
  description,
  icon,
  action,
  className = "",
}) {
  return (
    <div className={`fade-in-up space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h1 className="font-geist text-2xl md:text-3xl font-bold text-on-surface flex items-center gap-3">
          {icon && (
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          )}
          {title}
        </h1>
        {action && <div>{action}</div>}
      </div>
      {description && (
        <p className="text-on-surface-variant font-inter text-sm md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}

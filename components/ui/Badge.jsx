const variants = {
  default:
    "bg-surface-container-lowest text-on-surface-variant border-white/[0.08] hover:border-primary/30 hover:text-on-surface",
  primary:
    "bg-primary/20 text-primary border-primary/30",
  success:
    "bg-success-muted text-success border-success/20",
  warning:
    "bg-warning-muted text-warning border-warning/20",
  danger:
    "bg-danger-muted text-danger border-danger/20",
};

export default function Badge({
  variant = "default",
  children,
  className = "",
  active = false,
  animate = true,
  onClick,
  ...props
}) {
  const appliedVariant = active ? "primary" : variant;

  // CSS hover/tap scale replaces framer-motion whileHover/whileTap
  const interactiveClass = animate
    ? "hover:scale-105 active:scale-95 transition-transform duration-150"
    : "transition-colors";

  const classes = `inline-flex items-center px-3 py-1.5 text-xs rounded-full border font-inter ${interactiveClass} ${variants[appliedVariant]} ${className}`;

  const content = children;

  if (onClick) {
    return (
      <button
        className={`${classes} cursor-pointer`}
        onClick={onClick}
        {...props}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} {...props}>
      {content}
    </span>
  );
}

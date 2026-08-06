const variants = {
  primary:
    "bg-primary text-on-primary font-medium shadow-glow hover:bg-primary/90 hover:shadow-glow-lg",
  secondary:
    "bg-white/[0.04] border border-white/[0.08] text-on-surface-variant hover:bg-white/[0.08] hover:text-on-surface",
  danger: "bg-danger text-white hover:bg-danger/90",
  ghost:
    "bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]",
  icon: "bg-transparent text-on-surface-variant hover:text-on-surface p-2",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-lg",
  lg: "px-6 md:px-8 py-2.5 text-sm rounded-lg",
  icon: "p-2 rounded-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  disabled = false,
  loading = false,
  animate = true,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-inter transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  // CSS hover/tap scale replaces framer-motion whileHover/whileTap
  const interactiveClass =
    animate && !disabled ? "hover:scale-[1.02] active:scale-[0.98]" : "";

  const classes = `${base} ${variants[variant]} ${sizes[size]} ${interactiveClass} ${className}`;

  const content = loading ? (
    <span className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px] animate-spin">
        progress_activity
      </span>
      Loading...
    </span>
  ) : (
    children
  );

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}

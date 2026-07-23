export default function Card({
  children,
  className = "",
  padding = "md",
  hover = false,
  animate = true,
  ...props
}) {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-6 md:p-8",
  };

  const hoverClass = hover
    ? "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-white/[0.1]"
    : "";

  // CSS fade-in replaces framer-motion initial/animate (fadeUp keyframe in globals.css)
  const animateClass = animate ? "fade-in-up" : "";

  const classes = `bg-surface-container-low rounded-xl border border-white/[0.06] ${paddings[padding]} ${hoverClass} ${animateClass} ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

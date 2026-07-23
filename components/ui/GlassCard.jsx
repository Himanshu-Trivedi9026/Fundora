export default function GlassCard({
  children,
  className = "",
  padding = "md",
  animate = true,
  hover = false,
  ...props
}) {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-6 md:p-8",
  };

  const hoverClass = hover
    ? "transition-shadow duration-300 hover:shadow-glass-lg hover:border-white/[0.1]"
    : "";

  // CSS fade-in replaces framer-motion initial/animate (fadeUp keyframe in globals.css)
  const animateClass = animate ? "fade-in-up" : "";

  const classes = `glass-card ${paddings[padding]} ${hoverClass} ${animateClass} ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

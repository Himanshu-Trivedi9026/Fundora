import { motion } from "framer-motion";

/**
 * SecurityShield — Large shield icon with glow effect.
 * Used as hero element on verification pages.
 *
 * Props:
 *   level   — 0-5 verification level
 *   size    — 'sm' | 'md' | 'lg' (default: 'lg')
 *   animate — boolean (default: true)
 *   className — additional classes
 */
export default function SecurityShield({
  level = 0,
  size = "lg",
  animate = true,
  className = "",
}) {
  const sizes = {
    sm: { container: "w-12 h-12", icon: "text-[24px]" },
    md: { container: "w-16 h-16", icon: "text-[32px]" },
    lg: { container: "w-24 h-24", icon: "text-[48px]" },
  };

  const s = sizes[size] || sizes.lg;

  const levelColors = {
    0: "from-outline/20 to-outline/5",
    1: "from-primary/20 to-primary/5",
    2: "from-primary/30 to-primary/10",
    3: "from-primary/40 to-primary/15",
    4: "from-primary/50 to-primary/20",
    5: "from-success/40 to-success/15",
  };

  const iconColors = {
    0: "text-outline",
    1: "text-primary",
    2: "text-primary",
    3: "text-primary",
    4: "text-primary",
    5: "text-success",
  };

  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
      }
    : {};

  return (
    <Wrapper
      className={`relative flex items-center justify-center ${className}`}
      {...wrapperProps}
    >
      {/* Glow ring */}
      {level >= 2 && (
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-b ${levelColors[level]} blur-xl opacity-60`}
          style={level >= 5 ? { animation: "glowPulse 3s ease-in-out infinite" } : {}}
        />
      )}

      {/* Shield */}
      <div
        className={`relative ${s.container} rounded-full flex items-center justify-center
          bg-gradient-to-b ${levelColors[level]} border border-white/10
        `}
      >
        <span
          className={`material-symbols-outlined ${s.icon} ${iconColors[level]}`}
          style={level >= 2 ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          {level >= 5 ? "verified" : level >= 2 ? "shield" : "shield"}
        </span>
      </div>
    </Wrapper>
  );
}

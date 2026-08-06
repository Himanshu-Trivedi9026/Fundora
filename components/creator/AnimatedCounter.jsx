import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/**
 * AnimatedCounter — counts from 0 to `end` when in viewport.
 * Supports prefix/suffix (e.g. "$", "K", "%").
 */
export default function AnimatedCounter({
  end = 0,
  duration = 1.8,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = performance.now();
    let animationId;

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      start = eased * end;
      setValue(start);
      if (progress < 1) {
        animationId = requestAnimationFrame(tick);
      }
    }

    animationId = requestAnimationFrame(tick);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [inView, end, duration]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
      {suffix}
    </motion.span>
  );
}

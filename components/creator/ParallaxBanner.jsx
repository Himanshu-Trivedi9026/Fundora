import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function ParallaxBanner({ banner, avatar, fullName, bio, children }) {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const bannerY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const bannerScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      {/* ── Parallax banner image ── */}
      <motion.img
        style={{ y: bannerY, scale: bannerScale }}
        className="absolute inset-0 w-full h-[120%] object-cover origin-center"
        src={banner}
        alt="Creator banner"
      />

      {/* ── Gradient overlay ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-dim/60 to-surface-dim" />

      {/* ── Content area ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-12 pt-20 md:pt-28">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
          {/* Avatar with glass-card ring */}
          <motion.div
            className="glass-card p-1 rounded-full shrink-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            whileHover={{ scale: 1.05 }}
          >
            <img
              className="w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-full object-cover"
              src={avatar}
              alt={fullName || "Creator avatar"}
            />
          </motion.div>

          {/* Name + bio + action buttons */}
          <div className="text-center md:text-left flex-1">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="text-2xl md:text-3xl font-bold text-on-surface font-geist">
                {fullName}
              </h1>
              <span
                className="material-symbols-outlined text-primary text-xl hidden"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
            <p className="text-on-surface-variant mt-1 font-inter text-sm md:text-base">
              {bio || "Creator"}
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

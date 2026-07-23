import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * HeroBanner — Full-width parallax hero with glass-panel overlay.
 * Props: { project, isOwner }
 */
export default function HeroBanner({ project, isOwner }) {
  const ref = useRef(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);

  const thumbnail = project?.thumbnail;
  const title = project?.title || "Untitled Project";
  const short = project?.short || "";
  const creatorName = project?.owner_name || project?.owner_id || "Unknown";
  const categories = project?.categories || (project?.category ? [project.category] : []);

  return (
    <section ref={ref} className="relative w-full h-[716px] flex items-end pb-12 overflow-hidden">
      {/* Background Image with Parallax */}
      <motion.div
        style={{ y }}
        className="absolute inset-0 z-0"
      >
        {thumbnail ? (
          <div
            className="w-full h-[120%] bg-cover bg-center"
            style={{ backgroundImage: `url(${thumbnail})` }}
          />
        ) : (
          <div className="w-full h-full bg-surface-container" />
        )}
      </motion.div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent z-[1]" />

      {/* Glass Panel Content */}
      <div className="relative z-10 w-full px-6 lg:px-16 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-8 md:p-12 rounded-xl max-w-3xl"
          style={{
            border: "1px solid transparent",
            background: "linear-gradient(rgba(28,28,31,0.7), rgba(28,28,31,0.7)) padding-box, linear-gradient(to bottom, rgba(196,168,255,0.4), rgba(196,168,255,0)) border-box",
          }}
        >
          {/* Creator Row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full border border-primary/40 p-0.5">
              <div className="w-full h-full rounded-full bg-surface-container-high flex items-center justify-center text-sm font-bold text-primary">
                {creatorName.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-sm font-inter text-primary">
              Created by {creatorName}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1 text-sm font-inter text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">verified</span>
              Verified Project
            </span>
          </div>

          {/* Title */}
          <h1 className="font-geist text-3xl md:text-5xl font-bold text-on-surface mb-6 leading-tight">
            {title}
          </h1>

          {/* Short Description */}
          {short && (
            <p className="text-on-surface-variant font-inter text-base md:text-lg mb-6 leading-relaxed">
              {short}
            </p>
          )}

          {/* Tags */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {categories.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-surface-container-highest rounded text-on-surface-variant text-sm font-inter"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

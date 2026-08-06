import { motion } from "framer-motion";

/**
 * HeroBanner — Project title section (no bg image).
 * Props: { project }
 */
export default function HeroBanner({ project }) {
  const title = project?.title || "Untitled Project";
  const short = project?.short || "";
  const category = project?.categories?.[0] || project?.category || "";

  return (
    <div className="space-y-4">
      {/* Badge Row */}
      <div className="flex items-center gap-3">
        <span className="bg-primary/20 text-primary px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-primary/30">
          Active Round
        </span>
        {category && (
          <span className="text-on-surface-variant text-sm font-medium">
            &bull; {category}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="font-geist text-[40px] md:text-[48px] lg:text-[56px] text-on-surface leading-[1.1] font-bold tracking-tight">
        {title}
      </h1>

      {/* Description */}
      {short && (
        <p className="text-on-surface-variant font-inter text-sm md:text-base leading-relaxed max-w-2xl">
          {short}
        </p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { isSaved, toggleSave, getSaveCounts } from "../../lib/saved";

export const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/**
 * ExploreCard — Glass-card project card with bookmark, avatar group, category pill, progress bar.
 * Preserves save/bookmark logic from lib/saved.js.
 */
export default function ExploreCard({ project, currentUserId, creatorName }) {
  const router = useRouter();
  if (!project) return null;

  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);

  /* ---------------- SAVE STATE ---------------- */
  useEffect(() => {
    if (!project?.id) return;
    const counts = getSaveCounts();
    setSaveCount(counts[project.id] || 0);
    setSaved(isSaved(project.id));
  }, [project?.id]);

  function handleSave(e) {
    e.stopPropagation();
    setSaved(toggleSave(project.id));
    setSaveCount((c) => (saved ? Math.max(0, c - 1) : c + 1));
  }

  /* ---------------- CALCULATIONS ---------------- */
  const fundedPercent = project.goal
    ? Math.min(Math.round(((project.pledged || 0) / project.goal) * 100), 100)
    : 0;

  const isOwner = currentUserId === project.owner_id;
  const thumbnail = project.thumbnail || null;
  const daysLeft = project.deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const category =
    project.category ||
    (project.categories && project.categories[0]) ||
    null;

  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -4 }}
      onClick={() => router.push(`/projects/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/projects/${project.id}`);
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={`View project: ${project.title}`}
      className="glass-card rounded-xl overflow-hidden flex flex-col group h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface-dim"
    >
      {/* IMAGE */}
      <div className="h-48 relative overflow-hidden bg-surface-container-high">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">
              rocket_launch
            </span>
          </div>
        )}
        {category && (
          <div className="absolute top-4 left-4 bg-background/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-inter text-primary uppercase tracking-tighter">
            {category}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-6 flex flex-col flex-1">
        {/* Title + Bookmark */}
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-geist text-base font-semibold leading-tight text-on-surface">
            {project.title}
          </h4>
          <button
            onClick={handleSave}
            aria-label={saved ? "Unsave project" : "Save project"}
            className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors shrink-0 ml-2"
            style={saved ? { fontVariationSettings: "'FILL' 1", color: "var(--color-primary)" } : {}}
          >
            bookmark
          </button>
        </div>

        {/* Description */}
        <p className="text-on-surface-variant text-sm font-inter line-clamp-2 mb-6">
          {project.short || project.description?.slice(0, 120)}
        </p>

        {/* Progress + Footer */}
        <div className="mt-auto space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-inter">
              <span className="text-on-surface-variant">{fundedPercent}% funded</span>
              <span className="text-on-surface">
                ₹{(project.pledged || 0).toLocaleString("en-IN")} / ₹{(project.goal || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${fundedPercent}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>

          {/* Footer: avatar group + days left */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] text-on-surface-variant overflow-hidden">
                {creatorName ? creatorName.charAt(0).toUpperCase() : "?"}
              </div>
              {saveCount > 0 && (
                <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] text-on-surface-variant">
                  +{saveCount}
                </div>
              )}
            </div>
            <span className="text-xs font-inter text-on-surface-variant">
              {daysLeft !== null
                ? daysLeft === 0
                  ? "Ending today"
                  : `${daysLeft} days left`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

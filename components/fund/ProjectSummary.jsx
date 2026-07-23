import { motion } from "framer-motion";

/**
 * ProjectSummary — Project header with thumbnail, title, description, back link.
 */
export default function ProjectSummary({ project, creator, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-primary font-inter text-sm hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to Campaign
      </button>

      {/* Project info */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Thumbnail */}
        <div className="w-24 h-24 rounded-xl bg-surface-container-high overflow-hidden shrink-0 border border-white/[0.06]">
          {project?.thumbnail ? (
            <img
              className="w-full h-full object-cover"
              src={project.thumbnail}
              alt={project.title || "Project"}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="material-symbols-outlined text-3xl text-on-surface-variant/30"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                rocket_launch
              </span>
            </div>
          )}
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-on-surface font-geist">
            {project?.title}
          </h1>
          <p className="text-on-surface-variant mt-1 font-inter text-sm md:text-base">
            {project?.short || project?.description?.slice(0, 120) || "Support this project"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

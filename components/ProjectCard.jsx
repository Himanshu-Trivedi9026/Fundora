import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isSaved, toggleSave, getSaveCounts } from "../lib/saved";

export default function ProjectCard({ project, currentUserId, creatorName }) {
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
  }

  /* ---------------- CALCULATIONS ---------------- */
  const fundedPercent = project.goal
    ? Math.min(
        Math.round(((project.pledged || 0) / project.goal) * 100),
        100
      )
    : 0;

  const isOwner = currentUserId === project.owner_id;
  const thumbnail = project.thumbnail || null;

  return (
    <article
      onClick={() => router.push(`/projects/${project.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/projects/${project.id}`); } }}
      tabIndex={0}
      role="link"
      aria-label={`View project: ${project.title}`}
      className="cursor-pointer bg-slate-900/80 border border-slate-800 rounded-xl
                 shadow hover:shadow-xl hover:-translate-y-1 transition p-4 relative
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
    >
      {/* SAVE */}
      <button
        onClick={handleSave}
        aria-label={saved ? "Unsave project" : "Save project"}
        className="absolute top-3 right-3 text-white/80 hover:text-white text-xl z-10"
      >
        {saved ? "🔖" : "📑"}
      </button>

      {/* THUMBNAIL */}
      <div className="h-40 rounded-lg mb-3 overflow-hidden border border-slate-800 bg-slate-800">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
            No thumbnail
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold text-slate-100 hover:text-blue-400 transition">
        {project.title}
      </h3>

      <p className="text-sm text-slate-400 mt-1 line-clamp-2">
        {project.short}
      </p>

      {/* 🔥 PROGRESS BAR */}
      <div className="mt-3">
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${fundedPercent}%` }}
          />
        </div>

        <p className="text-xs text-slate-300 mt-1">
          ₹{project.pledged || 0} raised of ₹{project.goal} ({fundedPercent}%)
        </p>
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        ❤️ {saveCount} people saved this
      </p>

      {/* CREATOR — batch-fetched from parent */}
      {creatorName && (
        <div
          className="mt-4 pt-3 border-t border-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/creator/${project.owner_id}`);
          }}
        >
          <p className="text-sm text-slate-300 mb-2">
            By: {creatorName}
          </p>

          <button className="w-full text-center px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs hover:bg-slate-600 transition">
            View Profile
          </button>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/projects/${project.id}`);
          }}
          className="flex-1 text-xs bg-slate-700 text-white py-1.5 rounded"
        >
          View
        </button>

        {!isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/projects/${project.id}/fund`);
            }}
            className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded"
          >
            Fund
          </button>
        )}
      </div>
    </article>
  );
}

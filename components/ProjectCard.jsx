import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { isSaved, toggleSave, getSaveCounts } from "../lib/saved";

export default function ProjectCard({ project, currentUserId, creatorName }) {
  const router = useRouter();
  /* Reset imgError when project changes — adjust state during render so the
     reset is not a setState-in-effect (React 19 rule) */
  const [imgError, setImgError] = useState(false);
  const [prevProjectId, setPrevProjectId] = useState(project?.id);
  if (prevProjectId !== project?.id) {
    setPrevProjectId(project?.id);
    setImgError(false);
  }
  /* Lazy-init save state from localStorage — avoids setState in effect */
  const [saved, setSaved] = useState(() => {
    if (typeof window === "undefined" || !project?.id) return false;
    return isSaved(project.id);
  });
  const [saveCount, setSaveCount] = useState(() => {
    if (typeof window === "undefined" || !project?.id) return 0;
    return getSaveCounts()[project.id] || 0;
  });

  /* Sync save state when project.id changes — safe update via effect */
  useEffect(() => {
    if (project?.id) {
      const counts = getSaveCounts();
      queueMicrotask(() => setSaveCount(counts[project.id] || 0));
      queueMicrotask(() => setSaved(isSaved(project.id)));
    }
  }, [project?.id]);

  if (!project) return null;

  function handleSave(e) {
    e.stopPropagation();
    setSaved(toggleSave(project.id));
  }

  /* ---------------- CALCULATIONS ---------------- */
  const fundedPercent = project.goal
    ? Math.min(Math.round(((project.pledged || 0) / project.goal) * 100), 100)
    : 0;

  const isOwner = currentUserId === project.owner_id;
  const thumbnail = project.thumbnail || null;

  return (
    <article
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
      className="cursor-pointer bg-surface-dim/80 border border-outline-variant/50 rounded-xl
                 shadow hover:shadow-xl hover:-translate-y-1 transition p-4 relative
                 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-dim"
    >
      {/* SAVE */}
      <button
        onClick={handleSave}
        aria-label={saved ? "Unsave project" : "Save project"}
        aria-pressed={saved}
        className="absolute top-3 right-3 text-white/80 hover:text-white text-xl z-10"
      >
        <span aria-hidden="true">{saved ? "🔖" : "📑"}</span>
      </button>

      {/* THUMBNAIL */}
      <div className="h-40 rounded-lg mb-3 overflow-hidden border border-outline-variant/50 bg-surface-container relative">
        {thumbnail && !imgError ? (
          <Image
            src={thumbnail}
            alt={project.title}
            fill
            sizes="(max-width: 640px) 100vw, 300px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            No thumbnail
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold text-on-surface hover:text-primary transition">
        {project.title}
      </h3>

      <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
        {project.short}
      </p>

      {/* 🔥 PROGRESS BAR */}
      <div className="mt-3">
        <div
          className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={fundedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${fundedPercent}% funded`}
        >
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${fundedPercent}%` }}
          />
        </div>

        <p className="text-xs text-on-surface-variant mt-1">
          ₹{project.pledged || 0} raised of ₹{project.goal} ({fundedPercent}%)
        </p>
      </div>

      <p className="text-[11px] text-muted mt-2">
        ❤️ {saveCount} people saved this
      </p>

      {/* CREATOR — batch-fetched from parent */}
      {creatorName && (
        <div
          className="mt-4 pt-3 border-t border-outline-variant"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/creator/${project.owner_id}`);
          }}
        >
          <p className="text-sm text-on-surface-variant mb-2">
            By: {creatorName}
          </p>

          <button className="w-full text-center px-3 py-1.5 bg-surface-container-high text-on-surface rounded-lg text-xs hover:bg-surface-container-highest transition">
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
          className="flex-1 text-xs bg-surface-container-high text-on-surface py-1.5 rounded"
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

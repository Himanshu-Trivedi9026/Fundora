import { motion } from "framer-motion";
import { useRouter } from "next/router";

/**
 * FundingSidebar — Sticky funding card with stats, progress bar, Back/Save/Share.
 * Props: { project, isOwner, saved, onSave, onEdit, onDelete }
 */
export default function FundingSidebar({ project, isOwner, saved, onSave, onEdit, onDelete }) {
  const router = useRouter();

  const pledged = project?.pledged || 0;
  const goal = project?.goal || 1;
  const progress = Math.min(Math.round((pledged / goal) * 100), 100);
  const daysLeft = project?.deadline
    ? Math.max(0, Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="sticky top-24 space-y-6"
    >
      <div className="glass-card p-6 rounded-xl space-y-6 shadow-2xl">
        {/* Pledged Amount */}
        <div className="space-y-1">
          <p className="text-4xl font-bold text-primary font-geist">
            ₹{pledged.toLocaleString("en-IN")}
          </p>
          <p className="text-on-surface-variant text-sm font-inter">
            pledged of ₹{goal.toLocaleString("en-IN")} goal
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-inter">
            <span className="text-on-surface">{progress}% funded</span>
            <span className="text-on-surface-variant">
              {daysLeft !== null ? `${daysLeft} days left` : "—"}
            </span>
          </div>
          <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
              className="h-full bg-primary rounded-full relative overflow-hidden"
            >
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  animation: "pulse-move 2s infinite",
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
            <p className="text-xl font-bold text-on-surface font-geist">
              {project?.backers_count || Math.floor(pledged / 1500) || 0}
            </p>
            <p className="text-on-surface-variant text-sm font-inter">Backers</p>
          </div>
          <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/30">
            <p className="text-xl font-bold text-on-surface font-geist">
              {progress >= 100 ? "Funded" : progress >= 50 ? "Medium" : "Growing"}
            </p>
            <p className="text-on-surface-variant text-sm font-inter">Status</p>
          </div>
        </div>

        {/* Action Buttons */}
        {isOwner ? (
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onEdit}
              className="flex-1 bg-primary text-on-primary py-4 rounded-xl font-geist font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">edit</span>
              Edit Project
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onDelete}
              className="px-4 py-4 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-all"
            >
              <span className="material-symbols-outlined">delete</span>
            </motion.button>
          </div>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push(`/projects/${project.id}/fund`)}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-geist font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-3"
            >
              Back this Project
              <span className="material-symbols-outlined">bolt</span>
            </motion.button>

            <div className="flex items-center gap-4 py-2 text-on-surface-variant">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSave}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={saved ? { fontVariationSettings: "'FILL' 1", color: "var(--color-primary)" } : {}}
                >
                  favorite
                </span>
                <span className="text-sm font-inter">{saved ? "Saved" : "Save"}</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: project.title, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-xl">share</span>
                <span className="text-sm font-inter">Share</span>
              </motion.button>
            </div>
          </>
        )}

        <p className="text-xs text-center text-outline leading-tight font-inter">
          By funding, you agree to Fundora&apos;s Investor Terms. All payments are secured via Razorpay Enterprise.
        </p>
      </div>
    </motion.div>
  );
}

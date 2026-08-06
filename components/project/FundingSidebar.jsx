import { useRouter } from "next/router";
import { motion } from "framer-motion";

/**
 * FundingSidebar — Sticky funding card.
 * Props: { project, isOwner, saved, onSave, onEdit, onDelete, creatorVerification }
 */
export default function FundingSidebar({
  project,
  isOwner,
  saved,
  onSave,
  onEdit,
  onDelete,
  creatorVerification,
}) {
  const router = useRouter();
  const pledged = project?.pledged || 0;
  const goal = project?.goal || 1;
  const progress = Math.min(Math.round((pledged / goal) * 100), 100);
  const daysLeft = project?.deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const isFunded = progress >= 100;
  const isEnding = daysLeft !== null && daysLeft <= 3;
  const backersCount =
    project?.backers_count || Math.floor(pledged / 1500) || 0;
  const viewsCount = project?.views_count || 0;

  const formatViews = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-panel p-6 rounded-2xl border-white/10 shadow-2xl space-y-6"
    >
      {/* ── Pledged Amount ── */}
      <div>
        <div className="text-[36px] text-primary text-glow font-bold leading-tight">
          ₹{pledged.toLocaleString("en-IN")}
        </div>
        <div className="text-on-surface-variant text-xs mt-1">
          pledged of{" "}
          <span className="text-on-surface font-semibold">
            ₹{goal.toLocaleString("en-IN")}
          </span>{" "}
          goal
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="space-y-2">
        <div
          className="h-2 bg-surface-container-high rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress}% funded`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{
              duration: 1,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: 0.2,
            }}
            className={`h-full rounded-full relative overflow-hidden ${
              isFunded ? "bg-[#4caf50]" : "bg-primary"
            }`}
          >
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                animation: "shimmer 2s infinite",
              }}
            />
          </motion.div>
        </div>
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
          <span className="text-primary">{progress}% Funded</span>
          <span className="text-on-surface-variant">
            {daysLeft !== null
              ? isEnding
                ? `🔥 ${daysLeft} days left`
                : `${daysLeft} days left`
              : "—"}
          </span>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-surface-container-high/40 rounded-xl border border-white/5">
          <div className="text-lg font-bold">
            {backersCount.toLocaleString()}
          </div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest mt-0.5">
            Backers
          </div>
        </div>
        <div className="p-3 bg-surface-container-high/40 rounded-xl border border-white/5">
          <div className="text-lg font-bold">{formatViews(viewsCount)}</div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest mt-0.5">
            Views
          </div>
        </div>
      </div>

      {/* ── Creator Verification ── */}
      {creatorVerification && !isOwner && (
        <div className="p-3 bg-surface-container-high/30 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="material-symbols-outlined text-[14px] text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              shield
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant font-inter">
              Creator Verification
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`material-symbols-outlined text-[10px] ${
                    creatorVerification.identity_verified
                      ? "text-success"
                      : "text-on-surface-variant/40"
                  }`}
                  style={
                    creatorVerification.identity_verified
                      ? { fontVariationSettings: "'FILL' 1" }
                      : {}
                  }
                  aria-hidden="true"
                >
                  {creatorVerification.identity_verified
                    ? "check_circle"
                    : "pending"}
                </span>
                <span className="text-[10px] text-on-surface-variant font-inter">
                  Identity
                </span>
              </div>
              <div className="text-[10px] font-bold text-primary">
                Trust: {creatorVerification.trust_score || 0}
              </div>
            </div>
            {creatorVerification.verification_level >= 2 && (
              <span
                className="material-symbols-outlined text-success text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-label="Verified creator"
                role="img"
              >
                verified
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Action Buttons ── */}
      {isOwner ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onEdit}
              className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-geist font-semibold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden="true"
              >
                edit
              </span>
              Edit Project
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onDelete}
              className="px-4 py-3 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-all"
              aria-label="Delete project"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden="true"
              >
                delete
              </span>
            </motion.button>
          </div>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: project.title,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant text-xs font-inter hover:bg-surface-container-high hover:border-primary/50 transition-all"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              aria-hidden="true"
            >
              share
            </span>
            Share with potential backers
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              router.push(`/projects/${project.id}/fund`);
            }}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-base hover:brightness-110 active:scale-[0.98] transition-all"
            style={{ boxShadow: "0 10px 30px rgba(208, 188, 255, 0.15)" }}
          >
            Fund this Project
          </button>

          <div className="flex items-center justify-center gap-6 pt-1">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: project.title,
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                aria-hidden="true"
              >
                share
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Share
              </span>
            </button>

            <button
              onClick={onSave}
              className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={
                  saved
                    ? {
                        fontVariationSettings: "'FILL' 1",
                        color: "var(--color-primary)",
                      }
                    : {}
                }
                aria-hidden="true"
              >
                bookmark
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {saved ? "Watching" : "Watchlist"}
              </span>
            </button>
          </div>
        </>
      )}

      <p className="text-[10px] text-center text-on-surface-variant leading-tight font-inter">
        By funding, you agree to Fundora&apos;s Investor Terms. All payments
        secured via Razorpay Enterprise.
      </p>
    </motion.div>
  );
}

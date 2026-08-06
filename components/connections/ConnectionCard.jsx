import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";

export const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/**
 * ConnectionCard — Glass-card connection card with avatar, badge, Follow/Following + Mail.
 * Props: { profile, isFollowing, isSelf, onToggleFollow }
 */
export default function ConnectionCard({ profile, isFollowing, isSelf, onToggleFollow }) {
  // Simulated mutual connections count
  const mutualCount = useState(() => Math.floor(Math.random() * 50) + 1)[0];

  if (!profile) return null;

  const avatarUrl =
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || "User")}&background=1a1a24&color=c4a8ff`;

  // Simulated badge — in production this would come from profile data
  const badge = isFollowing ? "Premium Founder" : null;

  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -2 }}
      className="glass-card p-6 rounded-xl flex flex-col group"
    >
      {/* Avatar + Badge Row */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-16 h-16 rounded-full p-[2px] ${
            isFollowing
              ? "bg-gradient-to-tr from-primary to-transparent"
              : "bg-outline-variant/30"
          }`}
        >
          <Image
            src={avatarUrl}
            alt={profile.full_name || "User"}
            width={64}
            height={64}
            className="w-full h-full rounded-full object-cover"
          />
        </div>
        {badge && (
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
            {badge}
          </span>
        )}
      </div>

      {/* Name + Role */}
      <div className="mb-6">
        <h3 className="font-geist text-lg font-semibold text-on-surface mb-1">
          {profile.full_name || "User"}
        </h3>
        {profile.bio && (
          <p className="text-on-surface-variant font-inter text-sm line-clamp-1">
            {profile.bio}
          </p>
        )}
        <div className="flex items-center mt-3 text-outline text-sm font-inter">
          <span className="material-symbols-outlined text-sm mr-1">group</span>
          {mutualCount} mutual connections
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto flex gap-3">
        {isSelf ? (
          <span className="flex-1 text-center py-2.5 rounded-lg text-on-surface-variant text-sm font-inter border border-outline-variant/30">
            You
          </span>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow(profile.id);
            }}
            className={`flex-1 py-2.5 rounded-lg font-inter text-sm font-medium transition-all ${
              isFollowing
                ? "bg-primary text-on-primary shadow-[0_0_15px_rgba(208,188,255,0.15)] hover:shadow-[0_0_25px_rgba(208,188,255,0.3)]"
                : "bg-surface-variant text-on-surface border border-outline-variant/30 hover:bg-primary/20 hover:text-primary"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="px-3 py-2.5 rounded-lg border border-outline-variant/30 hover:bg-surface-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined text-on-surface-variant">mail</span>
        </motion.button>
      </div>
    </motion.article>
  );
}

import { motion } from "framer-motion";

/**
 * ProfileActions — Edit Profile / Message / Follow / Unfollow / Share buttons.
 */
export default function ProfileActions({
  isOwner,
  isFollowing,
  onEdit,
  onMessage,
  onFollow,
  onUnfollow,
}) {
  return (
    <div className="flex gap-3 mt-4 justify-center md:justify-start items-center">
      {isOwner ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
          className="px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm
                     font-inter font-medium hover:opacity-90 transition-opacity"
        >
          Edit Profile
        </motion.button>
      ) : (
        <>
          {/* Share — icon only */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08]
                       flex items-center justify-center text-on-surface-variant
                       hover:text-primary hover:border-primary/30 transition-colors"
            aria-label="Share profile"
          >
            <span className="material-symbols-outlined text-lg">share</span>
          </motion.button>

          {/* Message — outlined */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onMessage}
            className="px-5 py-2.5 border border-white/[0.12] text-on-surface rounded-full text-sm
                       font-inter font-medium hover:bg-white/[0.06] transition-colors"
          >
            Message
          </motion.button>

          {/* Follow / Unfollow */}
          {isFollowing ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onUnfollow}
              className="px-5 py-2.5 bg-danger text-white rounded-full text-sm
                         font-inter font-medium hover:opacity-90 transition-opacity"
            >
              Unfollow
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onFollow}
              className="px-5 py-2.5 bg-primary-container text-on-primary rounded-full text-sm
                         font-inter font-medium hover:opacity-90 transition-opacity"
            >
              Follow
            </motion.button>
          )}
        </>
      )}
    </div>
  );
}

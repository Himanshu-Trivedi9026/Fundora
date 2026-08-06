import { motion } from "framer-motion";

/**
 * TeamMembers — Team member cards with avatar, name, role, email.
 * Props: { team }
 */
export default function TeamMembers({ team }) {
  if (!team || team.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <h2 className="font-geist text-[24px] font-bold border-b border-outline-variant/30 pb-3">
        Team Members
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {team.map((member) => (
          <div
            key={member.id}
            className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-white/5"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-sm font-geist">
                {member.name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-on-surface font-inter text-sm font-semibold truncate">{member.name}</p>
              <p className="text-on-surface-variant font-inter text-xs truncate">{member.role}</p>
            </div>

            {/* Email */}
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="material-symbols-outlined text-primary text-lg hover:scale-110 transition-transform shrink-0"
                title="Send email"
              >
                mail
              </a>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}

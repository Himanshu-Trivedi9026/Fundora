import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "./SectionReveal";

function cleanUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
}

const socialLinks = [
  { key: "website", icon: "language", label: (v) => v.replace(/https?:\/\//, "").slice(0, 30) },
  { key: "twitter", icon: "alternate_email", label: (v) => "@" + v.split("/").pop() },
  { key: "linkedin", icon: "link", label: () => "LinkedIn" },
  { key: "github", icon: "code", label: () => "GitHub" },
  { key: "instagram", icon: "photo_camera", label: () => "Instagram" },
  { key: "youtube", icon: "smart_display", label: () => "YouTube" },
];

/**
 * SidebarConnect — Social links using Material Symbols icons.
 */
export default function SidebarConnect({ profile }) {
  const active = socialLinks.filter((l) => profile?.[l.key]);

  if (active.length === 0) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className="glass-card p-5 rounded-xl"
    >
      <motion.h3 variants={staggerItem} className="font-geist text-lg font-semibold text-on-surface mb-4">
        Connect
      </motion.h3>
      <div className="space-y-3">
        {active.map((link) => {
          const url = cleanUrl(profile[link.key]);
          return (
            <motion.a
              key={link.key}
              variants={staggerItem}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center gap-3 text-sm text-on-surface-variant
                         hover:text-primary transition-colors group"
            >
              <span
                className="material-symbols-outlined text-lg text-on-surface-variant
                           group-hover:text-primary transition-colors"
              >
                {link.icon}
              </span>
              <span className="truncate">{link.label(profile[link.key])}</span>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}

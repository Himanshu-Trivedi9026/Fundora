import { motion } from "framer-motion";

/**
 * ProjectStory — Project story section with prose styling and prototype link.
 * Props: { project }
 */
export default function ProjectStory({ project }) {
  const description = project?.description || "No description provided.";
  const prototypeUrl = project?.prototypeUrl;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <h2 className="font-geist text-2xl font-bold text-on-surface mb-8 flex items-center gap-3">
        <span className="w-8 h-[2px] bg-primary" />
        Project Story
      </h2>

      <div className="space-y-6 text-on-surface-variant font-inter text-lg leading-relaxed">
        {description.split("\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {/* Prototype Link */}
      {prototypeUrl && (
        <motion.a
          whileHover={{ scale: 1.02 }}
          href={prototypeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary font-inter text-sm hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">open_in_new</span>
          View Prototype
        </motion.a>
      )}
    </motion.section>
  );
}

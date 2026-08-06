import { motion } from "framer-motion";

/**
 * ProjectStory — Project story section.
 * Props: { project }
 */
export default function ProjectStory({ project }) {
  const description = project?.description || "No description provided.";
  const prototypeUrl = project?.prototypeUrl;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
      aria-label="Project story"
    >
      <h2 className="font-geist text-[24px] font-bold border-b border-outline-variant/30 pb-3">
        Project Story
      </h2>

      <div className="space-y-4">
        {description.split("\n").map((paragraph, i) => (
          <p key={i} className="text-on-surface-variant font-inter text-sm md:text-base leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {prototypeUrl && (
        <motion.a
          whileHover={{ scale: 1.02 }}
          href={prototypeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary font-inter text-sm hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">open_in_new</span>
          View Prototype (opens in new tab)
        </motion.a>
      )}
    </motion.section>
  );
}

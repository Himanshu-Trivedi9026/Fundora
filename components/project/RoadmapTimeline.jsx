import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * RoadmapTimeline — Vertical timeline with phase indicators.
 * Props: { project }
 */
export default function RoadmapTimeline({ project }) {
  const createdDate = project?.created_at ? new Date(project.created_at) : new Date();
  const deadline = project?.deadline ? new Date(project.deadline) : null;

  const phases = [
    {
      title: "Phase 1: Project Creation",
      description: `Project was created and published on ${createdDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Initial concept and team formation completed.`,
      status: "COMPLETED",
      statusColor: "text-success",
      dotColor: "bg-success",
      ringColor: "ring-success/20",
    },
    {
      title: "Phase 2: Crowdfunding",
      description: `Active funding round${deadline ? ` — ${Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)))} days remaining` : ""}. Community building and investor outreach in progress.`,
      status: "ACTIVE",
      statusColor: "text-primary",
      dotColor: "bg-primary",
      ringColor: "ring-primary/20",
    },
    {
      title: "Phase 3: Development & Delivery",
      description: "Post-funding development, prototype refinement, and delivery to backers. Scaling operations and market expansion.",
      status: "UPCOMING",
      statusColor: "text-on-surface-variant",
      dotColor: "border-2 border-outline-variant bg-background",
      ringColor: "",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <h2 className="font-geist text-2xl font-bold text-on-surface mb-8">Project Roadmap</h2>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        className="space-y-0 border-l border-outline-variant ml-4"
      >
        {phases.map((phase, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className="relative pl-10 pb-12 last:pb-0"
          >
            {/* Dot */}
            <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full ${phase.dotColor} ${
              phase.ringColor ? `ring-4 ${phase.ringColor}` : ""
            }`} />

            {/* Content */}
            <h4 className="font-geist text-lg font-semibold text-on-surface">
              {phase.title}
            </h4>
            <p className="text-on-surface-variant font-inter mt-2 leading-relaxed">
              {phase.description}
            </p>
            <span className={`text-xs font-inter uppercase tracking-wider mt-2 block ${phase.statusColor}`}>
              {phase.status}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}

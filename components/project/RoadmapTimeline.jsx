import { motion } from "framer-motion";

/**
 * RoadmapTimeline — Vertical timeline with phase indicators.
 * Props: { project }
 */
export default function RoadmapTimeline({ project }) {
  const createdDate = project?.created_at ? new Date(project.created_at) : new Date();
  const deadline = project?.deadline ? new Date(project.deadline) : null;
  const daysRemaining = deadline
    ? Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const phases = [
    {
      title: "Phase 01: Concept & Neural Model",
      description: `Project created on ${createdDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Architectural blueprints finalized and initial concept completed.`,
      status: "Completed",
      dotClass: "bg-primary ring-6 ring-primary/20 shadow-[0_0_12px_rgba(208,188,255,0.4)]",
      badgeClass: "text-primary border-primary/30",
      opacity: "",
    },
    {
      title: "Phase 02: Crowdfunding & Governance",
      description: `Active funding round${daysRemaining !== null ? ` — ${daysRemaining} days remaining` : ""}. Establishing governance and securing initial capital.`,
      status: "Active",
      dotClass: "bg-primary ring-6 ring-primary/20 animate-pulse",
      badgeClass: "text-primary border-primary",
      opacity: "",
    },
    {
      title: "Phase 03: Physical Construction",
      description: "Post-funding development, prototype refinement, and delivery to backers. Scaling operations and market expansion.",
      status: "Upcoming",
      dotClass: "bg-outline-variant",
      badgeClass: "text-on-surface-variant border-outline-variant",
      opacity: "opacity-50",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
      aria-label="Project roadmap"
    >
      <h2 className="font-geist text-[24px] font-bold border-b border-outline-variant/30 pb-3">
        Project Roadmap
      </h2>

      <div className="relative ml-3 pl-10 space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/30">
        {phases.map((phase, i) => (
          <div key={i} className={`relative ${phase.opacity}`}>
            <div className={`absolute -left-[46px] top-1 w-2.5 h-2.5 rounded-full ${phase.dotClass}`} />
            <div className="flex items-center gap-3 mb-1.5">
              <span className={`font-bold uppercase text-[9px] tracking-widest px-2 py-0.5 border rounded ${phase.badgeClass}`}>
                {phase.status}
              </span>
              <h4 className="font-geist text-base font-semibold text-on-surface">{phase.title}</h4>
            </div>
            <p className="text-on-surface-variant text-sm max-w-xl font-inter">{phase.description}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

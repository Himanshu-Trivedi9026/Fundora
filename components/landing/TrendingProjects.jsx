import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * TrendingProjects — 3 glass-card project cards fetched from Supabase.
 */
export default function TrendingProjects() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("pledged", { ascending: false })
        .limit(3);
      setProjects(data || []);
    }
    load();
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="py-24 px-4 md:px-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
        <div className="max-w-2xl">
          <h2 className="font-geist text-3xl md:text-4xl font-bold text-on-surface mb-4">
            Trending Campaigns
          </h2>
          <p className="text-on-surface-variant font-inter">
            Discover top-tier startups vetted by our proprietary Intelligence Layer.
            Every project undergoes a 200-point AI analysis before listing.
          </p>
        </div>
        <button
          onClick={() => router.push("/explore")}
          className="text-primary font-inter flex items-center gap-2 hover:underline transition-all cursor-pointer shrink-0"
        >
          View all projects
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>

      {/* Cards Grid */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {projects.map((project) => {
          const goal = project.goal || 10000;
          const pledged = project.pledged || 0;
          const progress = Math.min((pledged / goal) * 100, 100);
          const daysLeft = project.deadline
            ? Math.max(0, Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
            : null;

          return (
            <motion.div
              key={project.id}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="glass-card group rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-300"
            >
              {/* Image */}
              <div className="h-56 relative overflow-hidden">
                {project.thumbnail ? (
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={project.thumbnail}
                    alt={project.title}
                  />
                ) : (
                  <div className="w-full h-full bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">rocket_launch</span>
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-surface-dim/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-inter text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  {Math.round(progress)}% Funded
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {project.category && (
                  <span className="text-primary text-xs font-inter uppercase tracking-widest mb-2 block">
                    {project.category}
                  </span>
                )}
                <h3 className="font-geist text-lg font-semibold text-on-surface mb-3">
                  {project.title}
                </h3>
                <p className="text-on-surface-variant text-sm font-inter mb-6 line-clamp-2">
                  {project.short || project.description?.slice(0, 100)}
                </p>

                {/* Progress */}
                <div className="space-y-3">
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${progress}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="bg-primary h-full rounded-full"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-on-surface font-bold font-inter text-sm">
                        ₹{pledged.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-on-surface-variant uppercase font-inter">Raised</p>
                    </div>
                    <div className="text-right">
                      <p className="text-on-surface font-bold font-inter text-sm">
                        {daysLeft !== null ? `${daysLeft} Days` : "—"}
                      </p>
                      <p className="text-xs text-on-surface-variant uppercase font-inter">Left</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

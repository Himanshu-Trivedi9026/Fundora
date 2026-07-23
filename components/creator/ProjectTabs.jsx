import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import ProjectCard from "../ProjectCard";

/**
 * ProjectTabs — Tabbed container with Active/Past project filtering.
 */
export default function ProjectTabs({ projects, currentUserId, creatorName }) {
  const [activeTab, setActiveTab] = useState("active");

  const now = new Date();
  const active = projects.filter((p) => !p.deadline || new Date(p.deadline) > now);
  const past = projects.filter((p) => p.deadline && new Date(p.deadline) <= now);

  const tabs = [
    { key: "active", label: "Active Projects", count: active.length },
    { key: "past", label: "Past Successes", count: past.length },
  ];

  const displayProjects = activeTab === "active" ? active : past;

  return (
    <div className="glass-card p-6 rounded-xl">
      {/* ── Tab bar ── */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06] overflow-x-auto">
        <LayoutGroup>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-sm font-inter font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.key ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {tab.label} ({tab.count})
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </LayoutGroup>
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {displayProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  currentUserId={currentUserId}
                  creatorName={creatorName}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span
                className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {activeTab === "active" ? "hourglass_empty" : "history"}
              </span>
              <p className="text-on-surface-variant text-sm font-inter">
                {activeTab === "active" ? "No active projects yet." : "No past projects yet."}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

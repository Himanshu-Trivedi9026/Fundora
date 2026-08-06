import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import { loadTrendingProjects } from "../../lib/landing/landingData";
import { computeGrowthScore } from "../../lib/ai/projectScore";
import { useRole } from "../../context/RoleContext";
import { canStartProject, startProjectHref } from "../../lib/roles";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/** Days between now and the project deadline (0 when past/unknown). */
function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.max(
    0,
    Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)),
  );
}

/**
 * TrendingProjects — the top active campaigns from Supabase, ranked by
 * pledged amount (then recency), kept fresh via a Realtime subscription.
 * Every field on a card comes from real rows: deleted projects are never
 * shown, a missing thumbnail falls back to the icon tile, and an empty
 * database renders a professional empty state rather than dummy campaigns.
 *
 * Accepts `initial` ({ projects, creatorMap }) rendered server-side by the
 * landing page's ISR. When provided, the initial fetch is skipped — the SSR
 * payload is already correct — avoiding a redundant client query. The
 * realtime subscription is always active so the section keeps updating live.
 *
 * @param {object} [props]
 * @param {object} [props.initial] server-rendered trending data (public).
 */
export default function TrendingProjects({ initial = null }) {
  const router = useRouter();
  const { role } = useRole();
  const [projects, setProjects] = useState(initial?.projects || []);
  const [creatorMap, setCreatorMap] = useState(initial?.creatorMap || {});
  const [imgErrors, setImgErrors] = useState({});
  const [loading, setLoading] = useState(initial ? false : true);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    const { projects: projectList, creatorMap: creators } =
      await loadTrendingProjects(supabase);
    setProjects(projectList);
    setCreatorMap(creators);
    setLoading(false);
  }, []);

  useEffect(() => {
    // ISR already rendered these rows; don't re-query them on the client.
    // Deferred to a microtask so the setState inside load is not applied
    // synchronously within this effect (react-hooks/set-state-in-effect).
    if (!initial) queueMicrotask(load);

    // Refetch whenever a project is inserted, updated, or deleted so the
    // section stays in sync with the database. Bursts of events are debounced
    // so a flurry of DB writes collapses into one refetch.
    const scheduleRefetch = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(), 250);
    };

    const channel = supabase
      .channel("landing-trending")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        scheduleRefetch,
      )
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [load, initial]);

  return (
    <section className="py-24 px-4 md:px-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
        <div className="max-w-2xl">
          <h2 className="font-geist text-3xl md:text-4xl font-bold text-on-surface mb-4">
            Trending Campaigns
          </h2>
          <p className="text-on-surface-variant font-inter">
            Discover top-tier startups vetted by our proprietary Intelligence
            Layer. Every project undergoes a 200-point AI analysis before
            listing.
          </p>
        </div>
        <button
          onClick={() => {
            router.push("/explore");
          }}
          className="text-primary font-inter flex items-center gap-2 hover:underline transition-all cursor-pointer shrink-0"
        >
          View all projects
          <span
            className="material-symbols-outlined text-lg"
            aria-hidden="true"
          >
            arrow_forward
          </span>
        </button>
      </div>

      {/* Loading skeleton — visual placeholder while the real rows arrive */}
      {loading ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          data-testid="trending-loading"
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-card rounded-xl overflow-hidden animate-pulse"
            >
              <div className="h-56 bg-surface-container-high" />
              <div className="p-6 space-y-3">
                <div className="h-3 w-1/3 bg-surface-container-high rounded" />
                <div className="h-5 w-2/3 bg-surface-container-high rounded" />
                <div className="h-3 w-full bg-surface-container-high rounded" />
                <div className="h-2 w-full bg-surface-container-high rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* Empty state — no campaigns yet. Real data only, no placeholders. */
        <div className="glass-card rounded-2xl p-10 md:p-16 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-6">
            <span
              className="material-symbols-outlined text-primary text-3xl"
              aria-hidden="true"
            >
              rocket_launch
            </span>
          </div>
          <h3 className="font-geist text-2xl font-bold text-on-surface mb-3">
            No campaigns launched yet
          </h3>
          <p className="text-on-surface-variant font-inter mb-8 max-w-md mx-auto">
            Be the first to bring your idea to life on Fundora. When a project
            goes live, it will appear here.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Start a campaign (create-flow) is creator-only; guests are
                onboarded through /get-started instead. */}
            {canStartProject({ role }) && (
              <button
                type="button"
                onClick={() => {
                  router.push(startProjectHref({ role }));
                }}
                className="w-full sm:w-auto bg-primary text-on-primary px-6 py-3 rounded-lg font-geist font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-all duration-200 cursor-pointer"
              >
                Start a campaign
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                router.push("/explore");
              }}
              className="w-full sm:w-auto border border-outline-variant bg-surface-container-low text-on-surface px-6 py-3 rounded-lg font-geist font-semibold hover:bg-surface-container transition-all duration-200 cursor-pointer"
            >
              Explore projects
            </button>
          </div>
        </div>
      ) : (
        /* Cards Grid */
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
            const remaining = daysLeft(project.deadline);
            const category = Array.isArray(project.categories)
              ? project.categories[0]
              : null;
            // Feed the real category label into the shared AI score so its
            // category bonus reflects the actual row (trending rows carry a
            // `categories[]` array, not a `category` scalar).
            const aiScore = computeGrowthScore({ ...project, category });

            return (
              <motion.div
                key={project.id}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                onClick={() => {
                  router.push(`/projects/${project.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/projects/${project.id}`);
                  }
                }}
                role="link"
                tabIndex={0}
                className="glass-card group rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-300"
              >
                {/* Image */}
                <div className="h-56 relative overflow-hidden">
                  {project.thumbnail && !imgErrors[project.id] ? (
                    <Image
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      src={project.thumbnail}
                      alt={project.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 300px"
                      quality={60}
                      onError={() =>
                        setImgErrors((prev) => ({
                          ...prev,
                          [project.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-surface-container flex items-center justify-center"
                      data-testid="thumbnail-fallback"
                    >
                      <span
                        className="material-symbols-outlined text-4xl text-on-surface-variant/20"
                        aria-hidden="true"
                      >
                        rocket_launch
                      </span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-surface-dim/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-inter text-primary flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      aria-hidden="true"
                    >
                      bolt
                    </span>
                    {Math.round(progress)}% Funded
                  </div>
                  {aiScore != null && (
                    <div
                      className="absolute top-4 left-4 bg-primary/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-inter text-on-primary flex items-center gap-1"
                      title={`Fundora AI score: ${aiScore}/100`}
                    >
                      <span
                        className="material-symbols-outlined text-[14px]"
                        aria-hidden="true"
                      >
                        auto_awesome
                      </span>
                      AI {aiScore}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    {category ? (
                      <span className="text-primary text-xs font-inter uppercase tracking-widest">
                        {category}
                      </span>
                    ) : (
                      <span />
                    )}
                    {creatorMap[project.owner_id] && (
                      <span className="text-on-surface-variant text-xs font-inter truncate max-w-[50%]">
                        by {creatorMap[project.owner_id]}
                      </span>
                    )}
                  </div>
                  <h3 className="font-geist text-lg font-semibold text-on-surface mb-3">
                    {project.title}
                  </h3>
                  <p className="text-on-surface-variant text-sm font-inter mb-6 line-clamp-2">
                    {project.short || project.description?.slice(0, 100)}
                  </p>

                  {/* Progress */}
                  <div className="space-y-3">
                    <div
                      className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${Math.round(progress)}% funded`}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-primary h-full rounded-full"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-on-surface font-bold font-inter text-sm">
                          ₹{pledged.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-on-surface-variant uppercase font-inter">
                          Raised
                        </p>
                      </div>
                      <div>
                        <p className="text-on-surface font-bold font-inter text-sm">
                          ₹{goal.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-on-surface-variant uppercase font-inter">
                          Goal
                        </p>
                      </div>
                      <div>
                        <p className="text-on-surface font-bold font-inter text-sm">
                          {remaining !== null ? `${remaining} Days` : "—"}
                        </p>
                        <p className="text-xs text-on-surface-variant uppercase font-inter">
                          Left
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </section>
  );
}

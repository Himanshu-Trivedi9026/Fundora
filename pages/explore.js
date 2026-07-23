import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ExploreCard from "../components/explore/ExploreCard";
import SidebarFilters from "../components/explore/SidebarFilters";
import SkeletonCard from "../components/explore/SkeletonCard";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const SORT_OPTIONS = [
  { value: "recent", label: "Recently Added" },
  { value: "trending", label: "Trending" },
  { value: "funded", label: "Most Funded" },
  { value: "ending", label: "Ending Soon" },
];

const AI_RECOMMENDED = [
  "Quantum Computing",
  "Sustainable Fashion",
  "Urban Mobility",
  "Biotech startups",
];

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [creatorMap, setCreatorMap] = useState({});

  const [filters, setFilters] = useState({
    categories: [],
    minGoal: "",
    maxGoal: "",
    sort: "recent",
  });

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);

  const router = useRouter();

  /* ================= CLOSE SORT DROPDOWN ON OUTSIDE CLICK ================= */
  useEffect(() => {
    function handleClick(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSort(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ================= LOAD CURRENT USER (once) ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || null);
    });
  }, []);

  /* ================= LOAD PROJECTS ================= */
  async function loadProjects() {
    setLoading(true);

    let q = supabase.from("projects").select("*");

    switch (filters.sort) {
      case "trending":
        q = q.order("pledged", { ascending: false });
        break;
      case "funded":
        q = q.order("goal", { ascending: false });
        break;
      case "ending":
        q = q.order("deadline", { ascending: true });
        break;
      default:
        q = q.order("created_at", { ascending: false });
    }

    if (filters.categories.length > 0) {
      q = q.contains("categories", filters.categories);
    }

    if (filters.minGoal) q = q.gte("goal", filters.minGoal);
    if (filters.maxGoal) q = q.lte("goal", filters.maxGoal);

    const { data } = await q;
    const projectList = data || [];
    setProjects(projectList);

    // Batch-fetch all creator names in a single query (eliminates N+1)
    const ownerIds = [
      ...new Set(projectList.map((p) => p.owner_id).filter(Boolean)),
    ];
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);

      const map = {};
      (profiles || []).forEach((p) => {
        map[p.id] = p.full_name;
      });
      setCreatorMap(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
  }, [filters]);

  /* ================= REALTIME ================= */
  useEffect(() => {
    const channel = supabase
      .channel("projects-live-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
        },
        (payload) => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ================= SEARCH ================= */
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, short")
        .ilike("title", `%${query}%`)
        .limit(5);

      setSuggestions(data || []);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || "Trending";

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-24 pb-12 px-6 lg:px-16 max-w-7xl mx-auto min-h-screen flex-1">
        {/* ═══════════ HEADER ═══════════ */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-10 space-y-6"
        >
          {/* Search + Sort Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Search Input */}
            <div className="relative flex-1 max-w-2xl">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-4 pl-12 pr-4 text-on-surface font-inter focus:outline-none focus:border-primary transition-all shadow-inner"
                placeholder="Search the future of crowdfunding..."
                type="text"
                aria-label="Search projects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {/* Search Suggestions */}
              <AnimatePresence>
                {query && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    role="listbox"
                    aria-label="Search suggestions"
                    className="absolute left-0 right-0 mt-2 bg-surface-container border border-outline-variant rounded-xl z-30 shadow-xl overflow-hidden"
                  >
                    {suggestions.map((s) => (
                      <a
                        key={s.id}
                        href={`/projects/${s.id}`}
                        role="option"
                        className="block px-4 py-3 hover:bg-surface-container-high text-on-surface border-b border-outline-variant/30 last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-primary text-sm">
                          {s.title}
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          {s.short}
                        </div>
                      </a>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-on-surface-variant text-sm font-inter mr-1">
                Sort by
              </span>
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSort(!showSort)}
                  className="flex items-center gap-2 bg-surface-container-high px-4 py-3 rounded-lg border border-outline-variant/30 text-sm font-inter min-w-[160px] justify-between text-on-surface hover:border-primary/50 transition-colors"
                >
                  {currentSortLabel}
                  <span className="material-symbols-outlined text-sm">
                    expand_more
                  </span>
                </button>

                <AnimatePresence>
                  {showSort && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-full bg-surface-container border border-outline-variant rounded-lg z-30 shadow-xl overflow-hidden"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setFilters((f) => ({ ...f, sort: opt.value }));
                            setShowSort(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm font-inter transition-colors ${
                            filters.sort === opt.value
                              ? "bg-primary/10 text-primary"
                              : "text-on-surface hover:bg-surface-container-high"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* AI Recommended Pills */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
            <span className="flex items-center gap-1.5 text-primary text-sm font-inter whitespace-nowrap px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              AI Recommended:
            </span>
            {AI_RECOMMENDED.map((pill) => (
              <button
                key={pill}
                className="px-4 py-1.5 rounded-full bg-surface-container border border-outline-variant text-sm font-inter whitespace-nowrap hover:border-primary hover:text-primary transition-colors"
              >
                {pill}
              </button>
            ))}
          </div>
        </motion.header>

        {/* ═══════════ TWO-COLUMN LAYOUT ═══════════ */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── LEFT: Sticky Sidebar (hidden on mobile) ─── */}
          <div className="hidden lg:block">
            <SidebarFilters filters={filters} setFilters={setFilters} />
          </div>

          {/* ─── RIGHT: Project Grid ─── */}
          <section className="flex-1">
            {loading ? (
              /* ─── SKELETON LOADING ─── */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <>
                {/* ─── PROJECT CARDS ─── */}
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  {projects.map((p) => (
                    <ExploreCard
                      key={p.id}
                      project={p}
                      currentUserId={currentUserId}
                      creatorName={creatorMap[p.owner_id]}
                    />
                  ))}
                </motion.div>

                {/* ─── EMPTY STATE ─── */}
                {projects.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 block mb-4">
                      search_off
                    </span>
                    <p className="text-on-surface-variant font-inter text-lg">
                      No projects found matching your filters.
                    </p>
                    <button
                      onClick={() =>
                        setFilters({
                          categories: [],
                          minGoal: "",
                          maxGoal: "",
                          sort: "recent",
                        })
                      }
                      className="mt-4 text-primary font-inter hover:underline"
                    >
                      Clear all filters
                    </button>
                  </motion.div>
                )}

                {/* ─── LOAD MORE ─── */}
                {projects.length > 0 && (
                  <div className="mt-16 flex flex-col items-center gap-4">
                    <p className="text-on-surface-variant font-inter text-sm">
                      Showing {projects.length} project{projects.length !== 1 ? "s" : ""}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 border border-outline-variant px-8 py-3 rounded-lg hover:border-primary hover:text-primary transition-all text-on-surface-variant font-inter group"
                    >
                      Load more projects
                      <span className="material-symbols-outlined group-hover:translate-y-0.5 transition-transform">
                        expand_more
                      </span>
                    </motion.button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

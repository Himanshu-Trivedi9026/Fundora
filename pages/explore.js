import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ExploreCard from "../components/explore/ExploreCard";
import SidebarFilters from "../components/explore/SidebarFilters";
import SkeletonCard from "../components/explore/SkeletonCard";
import Pagination from "../components/explore/Pagination";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import SEO from "../components/SEO";
import { CATEGORY_LABELS } from "../lib/categories";
import {
  buildExploreQuery,
  EXPLORE_PAGE_SIZE,
  EXPLORE_SORT_OPTIONS,
  DEFAULT_EXPLORE_FILTERS,
} from "../lib/explore/exploreQuery";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const AI_RECOMMENDED = CATEGORY_LABELS.slice(0, 4);

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [creatorMap, setCreatorMap] = useState({});
  const [verificationMap, setVerificationMap] = useState({});
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState(DEFAULT_EXPLORE_FILTERS);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);
  const requestSeq = useRef(0);

  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(totalCount / EXPLORE_PAGE_SIZE));

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

  /* ================= LOAD ONE PAGE =================
     Loads the requested page with the CURRENT filters. A request-sequence
     ref guards against out-of-order responses when the user clicks pages
     faster than the DB answers. */
  const loadPage = useCallback(
    async (targetPage) => {
      const seq = ++requestSeq.current;
      queueMicrotask(() => setLoading(true));
      if (error) queueMicrotask(() => setError(null));

      try {
        const q = buildExploreQuery(supabase, {
          categories: filters.categories,
          minGoal: filters.minGoal,
          maxGoal: filters.maxGoal,
          sort: filters.sort,
          page: targetPage,
          pageSize: EXPLORE_PAGE_SIZE,
        });

        const { data, count, error: queryError } = await q;
        if (seq !== requestSeq.current) return; // stale response — ignore

        if (queryError) {
          setError("Failed to load projects. Please try again.");
          setProjects([]);
          return;
        }

        const projectList = data || [];
        setProjects(projectList);
        setTotalCount(count ?? 0);

        // Batch-fetch creator names + verification levels in two queries
        // (eliminates the N+1 pattern).
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

          const { data: verifications } = await supabase
            .from("creator_verifications")
            .select("user_id, verification_level")
            .in("user_id", ownerIds);

          const vMap = {};
          (verifications || []).forEach((v) => {
            vMap[v.user_id] = v.verification_level;
          });
          setVerificationMap(vMap);
        } else {
          setCreatorMap({});
          setVerificationMap({});
        }
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError("Failed to load projects. Please try again.");
        setProjects([]);
      } finally {
        if (seq === requestSeq.current) {
          queueMicrotask(() => setLoading(false));
        }
      }
    },
    [filters, error],
  );

  /* ================= FILTER CHANGE → RESET TO PAGE 1 =================
     Filters are also passed to SidebarFilters as `setFilters` so a category
     toggle, sort pick, or "clear all" atomically bumps the page back to 1.
     No separate effect is needed — loadPage re-runs on [page, filters]. */
  const applyFilters = useCallback((updater) => {
    setFilters(updater);
    setPage(1);
  }, []);

  /* ================= LOAD WHEN PAGE OR FILTERS CHANGE ================= */
  useEffect(() => {
    queueMicrotask(() => loadPage(page));
  }, [page, loadPage]);

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
              p.id === payload.new.id ? { ...p, ...payload.new } : p,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ================= SEARCH ================= */
  useEffect(() => {
    if (!query.trim()) {
      queueMicrotask(() => setSuggestions([]));
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
    EXPLORE_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ||
    "Newest";

  return (
    <>
      <SEO
        title="Explore Projects"
        description="Discover innovative crowdfunding projects on Fundora. Browse by category, funding stage, and trending campaigns."
        url="/explore"
      />
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
                <span
                  className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline"
                  aria-hidden="true"
                >
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
                        <Link
                          key={s.id}
                          href={`/projects/${s.id}`}
                          role="option"
                          aria-selected={false}
                          className="block px-4 py-3 hover:bg-surface-container-high text-on-surface border-b border-outline-variant/30 last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-primary text-sm">
                            {s.title}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-0.5">
                            {s.short}
                          </div>
                        </Link>
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
                    <span
                      className="material-symbols-outlined text-sm"
                      aria-hidden="true"
                    >
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
                        {EXPLORE_SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              applyFilters((f) => ({ ...f, sort: opt.value }));
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
                  aria-hidden="true"
                >
                  auto_awesome
                </span>
                AI Recommended:
              </span>
              {AI_RECOMMENDED.map((pill) => (
                <button
                  key={pill}
                  onClick={() => {
                    applyFilters((f) =>
                      f.categories.includes(pill)
                        ? f
                        : { ...f, categories: [...f.categories, pill] },
                    );
                  }}
                  className={`px-4 py-1.5 rounded-full border text-sm font-inter whitespace-nowrap transition-colors ${
                    filters.categories.includes(pill)
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-surface-container border-outline-variant hover:border-primary hover:text-primary"
                  }`}
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
              <SidebarFilters filters={filters} setFilters={applyFilters} />
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
              ) : error ? (
                /* ─── ERROR STATE ─── */
                <div className="text-center py-20">
                  <span
                    className="material-symbols-outlined text-6xl text-on-surface-variant/30 block mb-4"
                    aria-hidden="true"
                  >
                    error_outline
                  </span>
                  <p className="text-on-surface-variant font-inter text-lg">
                    {error}
                  </p>
                  <button
                    onClick={() => loadPage(page)}
                    className="mt-4 text-primary font-inter hover:underline"
                  >
                    Try again
                  </button>
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
                        creatorVerificationLevel={
                          verificationMap[p.owner_id] || 0
                        }
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
                      <span
                        className="material-symbols-outlined text-6xl text-on-surface-variant/30 block mb-4"
                        aria-hidden="true"
                      >
                        search_off
                      </span>
                      <p className="text-on-surface-variant font-inter text-lg">
                        No projects found matching your filters.
                      </p>
                      <button
                        onClick={() => applyFilters(DEFAULT_EXPLORE_FILTERS)}
                        className="mt-4 text-primary font-inter hover:underline"
                      >
                        Clear all filters
                      </button>
                    </motion.div>
                  )}

                  {/* ─── PAGINATION ─── */}
                  {totalCount > 0 && (
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      onChange={setPage}
                    />
                  )}
                </>
              )}
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

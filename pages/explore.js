import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProjectCard from "../components/ProjectCard";
import FiltersSidebar from "../components/FiltersSidebar";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import FloatingAIChat from "@/components/FloatingAIChat";

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    categories: [],
    minGoal: "",
    maxGoal: "",
    sort: "recent",
  });

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const router = useRouter();

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
    setProjects(data || []);
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
              p.id === payload.new.id
                ? { ...p, ...payload.new }
                : p
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

  const handleStartProject = async () => {
    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      router.push("/login?redirect=/create");
    } else {
      router.push("/create");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onToggleFilters={() => setShowFilters(true)} />

      <main className="flex-1 w-full px-6 relative">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">
            Explore projects
          </h1>

          <button
            onClick={handleStartProject}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 rounded-lg font-medium hover:scale-105 transition"
          >
            🚀 Start a project
          </button>
        </div>

        {/* SEARCH */}
        <div className="relative mb-8">
          <input
            className="w-full px-5 py-3 rounded-xl bg-slate-900/70 backdrop-blur border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {query && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl z-20 shadow-xl">
              {suggestions.map((s) => (
                <a
                  key={s.id}
                  href={`/projects/${s.id}`}
                  className="block px-4 py-3 hover:bg-slate-800 text-white border-b border-slate-800"
                >
                  <div className="font-semibold text-blue-300">
                    {s.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.short}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 🔥 PREMIUM LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* PROJECT GRID */}
          <div className="lg:col-span-3">
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : (
              <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </div>

          {/* AI SIDEBAR */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <FloatingAIChat />
            </div>
          </div>
        </div>

        {/* BACKDROP */}
        {showFilters && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFilters(false)}
          />
        )}

        {/* FILTER SIDEBAR */}
        {showFilters && (
          <FiltersSidebar
            filters={filters}
            setFilters={setFilters}
            onClose={() => setShowFilters(false)}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
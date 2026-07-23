// pages/projects/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import HeroBanner from "../../components/project/HeroBanner";
import FundingSidebar from "../../components/project/FundingSidebar";
import ProjectStory from "../../components/project/ProjectStory";
import GalleryGrid from "../../components/project/GalleryGrid";
import RoadmapTimeline from "../../components/project/RoadmapTimeline";
import { supabase } from "../../lib/supabaseClient";
import { isSaved, toggleSave } from "../../lib/saved";

// Lazy-load project chat widget — not needed until user opens it
const FloatingProjectChat = dynamic(
  () => import("../../components/FloatingProjectChat"),
  { ssr: false }
);

export default function ProjectDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [media, setMedia] = useState([]);
  const [team, setTeam] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(null);
  const [similarProjects, setSimilarProjects] = useState([]);

  /* ================= LOAD USER (once) ================= */
  useEffect(() => {
    async function loadUser() {
      const user = (await supabase.auth.getUser()).data.user;
      setCurrentUser(user?.id || null);
    }
    loadUser();
  }, []);

  /* ================= LOAD PROJECT + MEDIA + TEAM ================= */
  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (!proj) return;

        setProject(proj);
        setSaved(isSaved(proj.id));

        const { data: mediaRows } = await supabase
          .from("media")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: true });

        setMedia(mediaRows || []);

        const { data: teamRows } = await supabase
          .from("team_members")
          .select("*")
          .eq("project_id", id);

        setTeam(teamRows || []);

        // Load similar projects (other projects, ordered by pledged)
        const { data: similar } = await supabase
          .from("projects")
          .select("*")
          .neq("id", id)
          .order("pledged", { ascending: false })
          .limit(3);

        setSimilarProjects(similar || []);
      } catch (err) {
        console.error(err);
      }
    }

    loadData();
  }, [id]);

  /* ================= REALTIME FUNDING UPDATES ================= */
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel("project-funding-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setProject(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  /* ================= MEMOIZE MEDIA ================= */
  const { images, videos, documents } = useMemo(
    () => ({
      images: media.filter((m) => m.type === "image"),
      videos: media.filter((m) => m.type === "video"),
      documents: media.filter((m) => m.type === "document"),
    }),
    [media]
  );

  /* ================= LOADING STATE ================= */
  if (!project) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-on-surface-variant font-inter text-lg"
          >
            Loading project...
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  const isOwner = currentUser === project.owner_id;

  /* ================= HANDLERS ================= */
  async function handleDelete() {
    if (!confirm("Delete this project permanently?")) return;
    await supabase.from("projects").delete().eq("id", id);
    alert("Deleted");
    router.push("/explore");
  }

  function handleSave() {
    const newState = toggleSave(project.id);
    setSaved(newState);
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-16 min-h-screen flex-1">
        {/* ═══════════ HERO BANNER ═══════════ */}
        <HeroBanner project={project} isOwner={isOwner} />

        {/* ═══════════ CONTENT GRID ═══════════ */}
        <div className="px-6 lg:px-16 max-w-7xl mx-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── LEFT COLUMN: Story & Details ─── */}
          <div className="lg:col-span-8 space-y-16">
            <ProjectStory project={project} />

            <GalleryGrid media={images} onPreview={setPreview} />

            {/* ─── AI Insights Section ─── */}
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="glass-card p-8 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className="material-symbols-outlined text-primary text-4xl animate-pulse">
                    psychology
                  </span>
                </div>
                <h2 className="font-geist text-lg font-semibold mb-4 text-primary">
                  Fundora Intelligence Insight
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-sm font-inter uppercase tracking-wider text-success font-semibold">
                        {project.pledged && project.goal && (project.pledged / project.goal) >= 0.5
                          ? "Strong Performance"
                          : "Growth Potential"}
                      </span>
                    </div>
                    <p className="text-on-surface-variant leading-relaxed font-inter text-sm">
                      Our predictive algorithms analyzed this project&apos;s trajectory, delivery rates, and market demand.
                      Current score: {project.pledged && project.goal
                        ? Math.min(10, ((project.pledged / project.goal) * 10)).toFixed(1)
                        : "N/A"}/10.
                    </p>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${Math.min(100, ((project.pledged || 0) / (project.goal || 1)) * 100)}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-inter text-on-surface font-semibold">
                      Key Growth Catalyst
                    </h4>
                    <ul className="text-sm space-y-2 text-on-surface-variant font-inter">
                      {project.category && (
                        <li className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-primary text-sm mt-0.5">
                            arrow_forward
                          </span>
                          Active in {project.category} sector
                        </li>
                      )}
                      {project.goal >= 100000 && (
                        <li className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-primary text-sm mt-0.5">
                            arrow_forward
                          </span>
                          High-value campaign with strong potential
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-sm mt-0.5">
                          arrow_forward
                        </span>
                        Backed by the Fundora Intelligence Layer
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.section>

            <RoadmapTimeline project={project} />

            {/* ─── Media: Videos & Documents ─── */}
            {(videos.length > 0 || documents.length > 0) && (
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="space-y-6"
              >
                {videos.length > 0 && (
                  <div>
                    <h3 className="font-geist text-lg font-semibold text-on-surface mb-4">Videos</h3>
                    <div className="space-y-4">
                      {videos.map((vid) => (
                        <video
                          key={vid.id}
                          src={vid.url}
                          controls
                          onClick={() => setPreview({ type: "video", url: vid.url })}
                          className="cursor-pointer w-full rounded-xl border border-outline-variant/30"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {documents.length > 0 && (
                  <div>
                    <h3 className="font-geist text-lg font-semibold text-on-surface mb-4">Documents</h3>
                    <ul className="space-y-2">
                      {documents.map((doc) => (
                        <li key={doc.id}>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary font-inter text-sm hover:underline"
                          >
                            <span className="material-symbols-outlined text-lg">description</span>
                            {doc.name || "Open document"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.section>
            )}

            {/* ─── Team Members ─── */}
            {team.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h3 className="font-geist text-lg font-semibold text-on-surface mb-4">Team Members</h3>
                <div className="space-y-3">
                  {team.map((t) => (
                    <div
                      key={t.id}
                      className="glass-card p-4 rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <p className="text-on-surface font-inter text-sm font-medium">{t.name}</p>
                        <p className="text-on-surface-variant font-inter text-xs">{t.role}</p>
                      </div>
                      {t.email && (
                        <a
                          href={`mailto:${t.email}`}
                          className="material-symbols-outlined text-primary text-lg hover:scale-110 transition-transform"
                          title="Send email"
                        >
                          mail
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Sidebar ─── */}
          <aside className="lg:col-span-4 space-y-8">
            <FundingSidebar
              project={project}
              isOwner={isOwner}
              saved={saved}
              onSave={handleSave}
              onEdit={() => router.push(`/edit/${project.id}`)}
              onDelete={handleDelete}
            />

            {/* ─── Similar Projects ─── */}
            {similarProjects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-4"
              >
                <h3 className="font-geist text-lg font-semibold text-on-surface px-2">
                  Similar Opportunities
                </h3>
                <div className="space-y-4">
                  {similarProjects.map((sp) => {
                    const spProgress = sp.goal
                      ? Math.min(Math.round(((sp.pledged || 0) / sp.goal) * 100), 100)
                      : 0;
                    const spDaysLeft = sp.deadline
                      ? Math.max(0, Math.ceil((new Date(sp.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                      : null;

                    return (
                      <motion.a
                        key={sp.id}
                        whileHover={{ scale: 1.01 }}
                        href={`/projects/${sp.id}`}
                        className="group block glass-card p-3 rounded-lg hover:border-primary/50 transition-all"
                      >
                        <div className="flex gap-4">
                          {sp.thumbnail ? (
                            <img
                              src={sp.thumbnail}
                              alt={sp.title}
                              className="w-20 h-20 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded bg-surface-container-high shrink-0 flex items-center justify-center">
                              <span className="material-symbols-outlined text-on-surface-variant/30">
                                rocket_launch
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col justify-center min-w-0">
                            <h4 className="text-sm font-inter text-on-surface group-hover:text-primary transition-colors truncate">
                              {sp.title}
                            </h4>
                            <p className="text-xs text-on-surface-variant mt-1 font-inter">
                              {spProgress}% Funded{spDaysLeft !== null ? ` • ${spDaysLeft}d left` : ""}
                            </p>
                          </div>
                        </div>
                      </motion.a>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </aside>
        </div>
      </main>

      {/* ═══════════ FULLSCREEN PREVIEW ═══════════ */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
            onClick={() => setPreview(null)}
            role="button"
            tabIndex={0}
            aria-label="Close preview"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPreview(null);
            }}
          >
            {preview.type === "image" ? (
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={preview.url}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <motion.video
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={preview.url}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingProjectChat projectId={project.id} />
      <Footer />
    </div>
  );
}

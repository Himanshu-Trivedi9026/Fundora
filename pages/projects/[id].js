// pages/projects/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import SEO from "../../components/SEO";
import HeroBanner from "../../components/project/HeroBanner";
import FundingSidebar from "../../components/project/FundingSidebar";
import ProjectStory from "../../components/project/ProjectStory";
import GalleryGrid from "../../components/project/GalleryGrid";
import RoadmapTimeline from "../../components/project/RoadmapTimeline";
import IntelligenceInsight from "../../components/project/IntelligenceInsight";
import SimilarProjects from "../../components/project/SimilarProjects";
import TeamMembers from "../../components/project/TeamMembers";
import { supabase } from "../../lib/supabaseClient";
import { isSaved, toggleSave } from "../../lib/saved";

/**
 * Extract the object path ("<bucket>/<projectId>/<file>") from a public
 * Supabase storage URL. Returns null when the URL isn't a storage URL, so
 * callers can safely skip object removal for non-storage URLs.
 */
function deriveStoragePath(url) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

// Lazy-load project chat widget
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
  const [creatorVerification, setCreatorVerification] = useState(null);

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

        // Fetch creator's verification data (non-sensitive fields)
        const { data: verificationRow } = await supabase
          .from("creator_verifications")
          .select("verification_level, verification_status, trust_score, risk_score, identity_verified")
          .eq("user_id", proj.owner_id)
          .maybeSingle();

        setCreatorVerification(verificationRow);

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

        const { data: similar } = await supabase
          .from("projects")
          .select("*")
          .neq("id", id)
          .order("pledged", { ascending: false })
          .limit(3);

        setSimilarProjects(similar || []);
      } catch (err) {
        console.error("Failed to load similar projects:", err);
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
            role="status"
            aria-live="polite"
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

    try {
      // Remove media rows + storage objects first, so no orphans remain
      // and the project row delete can't be blocked by a media FK.
      const { data: projectMedia } = await supabase
        .from("media")
        .select("id, url")
        .eq("project_id", id);

      if (projectMedia && projectMedia.length > 0) {
        await supabase.from("media").delete().eq("project_id", id);

        const objectPaths = projectMedia
          .map((m) => deriveStoragePath(m.url))
          .filter(Boolean);
        if (objectPaths.length > 0) {
          await supabase.storage.from("projects").remove(objectPaths);
        }
      }

      // Also remove the thumbnail object if one exists.
      if (project?.thumbnail) {
        const thumbPath = deriveStoragePath(project.thumbnail);
        if (thumbPath) {
          const bucket = thumbPath.startsWith("project-thumbnails/")
            ? "project-thumbnails"
            : "projects";
          await supabase.storage.from(bucket).remove([thumbPath]);
        }
      }

      await supabase.from("projects").delete().eq("id", id);
      alert("Deleted");
      router.push("/explore");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete project.");
    }
  }

  function handleSave() {
    const newState = toggleSave(project.id);
    setSaved(newState);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.short || project.description,
    url: `https://fundora.vercel.app/projects/${id}`,
    image: project.thumbnail,
    creator: {
      "@type": "Person",
      name: project.owner_id,
    },
    offers: {
      "@type": "Offer",
      price: project.goal,
      priceCurrency: "INR",
    },
  };

  return (
    <>
      <SEO
        title={project.title}
        description={project.short || project.description?.slice(0, 160)}
        url={`/projects/${id}`}
        image={project.thumbnail || "/og-default.png"}
        structuredData={structuredData}
      />
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />

        <main className="pt-24 min-h-screen flex-1">
          {/* ═══════════ MAIN CONTENT GRID ═══════════ */}
          <div className="max-w-[1280px] mx-auto px-10 lg:px-16 relative z-10">
            <div className="grid grid-cols-12 gap-6 items-start pb-12">

              {/* ─── LEFT COLUMN: Primary Content ─── */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                {project.thumbnail && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-outline-variant/20"
                  >
                    <Image
                      src={project.thumbnail}
                      alt={`${project.title} banner`}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover"
                    />
                  </motion.div>
                )}
                <HeroBanner project={project} />
                <IntelligenceInsight
                  project={project}
                  mediaCount={media.length}
                  teamCount={team.length}
                />
                <ProjectStory project={project} />
                <GalleryGrid media={images} onPreview={setPreview} />
                <RoadmapTimeline project={project} />

                {/* Videos & Documents */}
                {(videos.length > 0 || documents.length > 0) && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5 }}
                    className="space-y-4"
                  >
                    {videos.length > 0 && (
                      <div>
                        <h3 className="font-geist text-lg font-semibold text-on-surface mb-3">Videos</h3>
                        <div className="space-y-3">
                          {videos.map((vid) => (
                            <video
                              key={vid.id}
                              src={vid.url}
                              controls
                              onClick={() => setPreview({ type: "video", url: vid.url })}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview({ type: "video", url: vid.url }); } }}
                              className="cursor-pointer w-full rounded-xl border border-outline-variant/30"
                              aria-label={vid.name || "Project video"}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {documents.length > 0 && (
                      <div>
                        <h3 className="font-geist text-lg font-semibold text-on-surface mb-3">Documents</h3>
                        <ul className="space-y-2">
                          {documents.map((doc) => (
                            <li key={doc.id}>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-primary font-inter text-sm hover:underline"
                              >
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">description</span>
                                {doc.name || "Open document (opens in new tab)"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.section>
                )}

                <TeamMembers team={team} />
              </div>

              {/* ─── RIGHT COLUMN: Sidebar ─── */}
              <aside className="col-span-12 lg:col-span-4">
                <div className="lg:sticky lg:top-24 space-y-6">
                  <FundingSidebar
                    project={project}
                    isOwner={isOwner}
                    saved={saved}
                    onSave={handleSave}
                    onEdit={() => { router.push(`/edit/${project.id}`); }}
                    onDelete={handleDelete}
                    creatorVerification={creatorVerification}
                  />
                  <SimilarProjects projects={similarProjects} />
                </div>
              </aside>

            </div>
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
                  alt="Fullscreen preview"
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
    </>
  );
}

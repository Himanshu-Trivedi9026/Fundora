// pages/projects/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ProgressBar from "../../components/ProgressBar";
import { supabase } from "../../lib/supabaseClient";
import { isSaved, toggleSave } from "../../lib/saved";
import FloatingProjectChat from "../../components/FloatingProjectChat";

export default function ProjectDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [media, setMedia] = useState([]);
  const [team, setTeam] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(null);

  // Load user
  useEffect(() => {
    async function loadUser() {
      const user = (await supabase.auth.getUser()).data.user;
      setCurrentUser(user?.id || null);
    }
    loadUser();
  }, []);

  // Load project + media + team
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
      } catch (err) {
        console.error(err);
      }
    }

    loadData();
  }, [id]);
// REALTIME PROJECT FUNDING UPDATES
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

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center text-slate-200">
          Loading...
        </main>
        <Footer />
      </div>
    );
  }

  const isOwner = currentUser === project.owner_id;

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
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8 max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{project.title}</h1>
            <p className="text-slate-300 text-sm mt-1">{project.short}</p>
          </div>

          <div className="w-full md:w-64 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <ProgressBar pledged={project.pledged || 0} goal={project.goal} />
            <p className="text-xs text-slate-200 mt-1">
              ₹{project.pledged || 0} raised of ₹{project.goal}
            </p>
            <p className="text-xs text-slate-400">
              Deadline: {project.deadline}
            </p>
            {/* FUND BUTTON (only for non-owner) */}
{currentUser !== project.owner_id && (
  <button
    onClick={() => router.push(`/projects/${project.id}/fund`)}
    className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium"
  >
    Fund this project
  </button>
)}

            {isOwner && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => router.push(`/edit/${project.id}`)}
                  className="flex-1 px-3 py-1 rounded bg-slate-700 text-white text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 rounded bg-red-600 text-white text-sm"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">

          {/* LEFT */}
          <div className="space-y-6">

            {/* Overview */}
            <section className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Project Overview</h2>
              <p className="mt-2 text-sm text-slate-300 whitespace-pre-line">
                {project.description}
              </p>
            </section>

            {/* Prototype */}
            {project.prototypeUrl && (
              <section className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                <h2 className="text-sm font-semibold text-slate-100">Prototype</h2>
                <a
                  href={project.prototypeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 underline text-sm"
                >
                  Open prototype →
                </a>
              </section>
            )}

            {/* Media */}
            <section className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Media</h2>

              {/* Images */}
              <p className="text-[11px] text-slate-400 mt-2">Images</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {media.filter(m => m.type === "image").map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.name || "Project media"}
                    onClick={() => setPreview({ type: "image", url: img.url })}
                    aria-label="Preview image"
                    className="cursor-pointer w-full h-28 object-cover rounded-lg border border-slate-700"
                  />
                ))}
              </div>

              {/* Videos */}
              <p className="text-[11px] text-slate-400 mt-4">Videos</p>
              {media.filter(m => m.type === "video").map((vid) => (
                <video
                  key={vid.id}
                  src={vid.url}
                  controls
                  onClick={() => setPreview({ type: "video", url: vid.url })}
                  className="cursor-pointer w-full rounded-lg border border-slate-700"
                />
              ))}

              {/* Documents */}
              <p className="text-[11px] text-slate-400 mt-4">Documents</p>
              <ul className="space-y-1">
                {media.filter(m => m.type === "document").map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      className="text-cyan-300 underline text-xs"
                    >
                      Open document
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">

            {/* Creator */}
            <section className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Creator</h2>
              <p className="text-xs text-slate-300 mt-2">
                User ID: {project.owner_id}
              </p>
            </section>

            {/* Team */}
            <section className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Team Members</h2>

              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {team.map((t) => (
                  <li key={t.id} className="flex justify-between items-center">
                    <div>
                      <p>{t.name}</p>
                      <p className="text-slate-400">{t.role}</p>
                    </div>
                    {t.email && (
                      <a
                        href={`mailto:${t.email}`}
                        className="text-cyan-300 text-lg"
                        title="Send email"
                      >
                        📧
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* FULLSCREEN PREVIEW */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setPreview(null)}
          aria-label="Close preview"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(null); } }}
        >
          {preview.type === "image" ? (
            <img src={preview.url} className="max-w-full max-h-full" />
          ) : (
            <video src={preview.url} controls autoPlay className="max-w-full max-h-full" />
          )}
        </div>
      )}

      <FloatingProjectChat projectId={project.id} />
      <Footer />
    </div>
  );
}

// pages/edit/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import CategorySelector from "../../components/CategorySelector";
import TeamEditor from "../../components/TeamEditor";
import { supabase } from "../../lib/supabaseClient";
import { uploadFileToProject } from "../../lib/storage";

export default function EditProject() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);

  const [title, setTitle] = useState("");
  const [short, setShort] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [prototypeUrl, setPrototypeUrl] = useState("");
  const [categories, setCategories] = useState([]);

  const [media, setMedia] = useState([]);
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [team, setTeam] = useState([]);

  /* -------------------------------------------
    LOAD PROJECT + MEDIA + TEAM
  --------------------------------------------- */
  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("*")
          .eq("id", id)
          .single();

        if (!proj) return;

        const user = (await supabase.auth.getUser()).data.user;
        if (!user || user.id !== proj.owner_id) {
          alert("You are not authorized to edit this project");
          router.push("/");
          return;
        }

        const { data: mediaRows } = await supabase
          .from("media")
          .select("*")
          .eq("project_id", id);

        const { data: teamRows } = await supabase
          .from("team_members")
          .select("*")
          .eq("project_id", id);

        setProject(proj);
        setTitle(proj.title);
        setShort(proj.short);
        setDescription(proj.description);
        setGoal(proj.goal);
        setDeadline(proj.deadline?.split("T")[0] || "");
        setPrototypeUrl(proj.prototypeUrl || "");
        setCategories(proj.categories || []);
        setMedia(mediaRows || []);
        setTeam(teamRows || []);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, [id]);

  /* -------------------------------------------
    DELETE EXISTING MEDIA
  --------------------------------------------- */
  async function handleDeleteMedia(mediaId) {
    if (!confirm("Delete this media?")) return;

    await supabase.from("media").delete().eq("id", mediaId);
    setMedia((m) => m.filter((item) => item.id !== mediaId));
  }

  /* -------------------------------------------
    SAVE CHANGES
  --------------------------------------------- */
  async function handleSave() {
    try {
      setLoading(true);

      await supabase
        .from("projects")
        .update({
          title,
          short,
          description,
          goal: Number(goal),
          deadline,
          prototypeUrl,
          categories,
        })
        .eq("id", id);

      const newMediaRows = [];

      for (const file of newMediaFiles) {
        const uploaded = await uploadFileToProject(file, id);
        if (!uploaded) continue;

        newMediaRows.push({
          project_id: id,
          url: uploaded.url,
          type: file.type.startsWith("image")
            ? "image"
            : file.type.startsWith("video")
            ? "video"
            : "document",
        });
      }

      if (newMediaRows.length > 0) {
        await supabase.from("media").insert(newMediaRows);
      }

      await supabase.from("team_members").delete().eq("project_id", id);

      if (team.length > 0) {
        await supabase.from("team_members").insert(
          team.map((t) => ({
            project_id: id,
            name: t.name,
            role: t.role,
            email: t.email,
          }))
        );
      }

      alert("Project updated!");
      router.push(`/projects/${id}`);
    } catch (err) {
      console.error(err);
      alert("Error saving project");
    } finally {
      setLoading(false);
    }
  }

  if (!project) return <div className="p-6 text-white">Loading...</div>;

  /* -------------------------------------------
    UI
  --------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Edit Project</h1>

        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-6 space-y-6">

          <input className="input" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" aria-label="Project title" />
          <input className="input" value={short} onChange={(e)=>setShort(e.target.value)} placeholder="Short Description" aria-label="Short description" />
          <textarea className="input" rows="5" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Full Description" aria-label="Full description" />

          <div className="grid grid-cols-2 gap-4">
            <input className="input" type="number" value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="Goal ₹" aria-label="Funding goal in rupees" />
            <input className="input" type="date" value={deadline} onChange={(e)=>setDeadline(e.target.value)} aria-label="Campaign deadline" />
          </div>

          <input className="input" value={prototypeUrl} onChange={(e)=>setPrototypeUrl(e.target.value)} placeholder="Prototype URL" aria-label="Prototype URL" />

          <CategorySelector selected={categories} setSelected={setCategories} />

          {/* EXISTING MEDIA */}
          <div>
            <p className="text-sm text-slate-300 mb-2">Existing Media</p>

            <div className="grid grid-cols-2 gap-4">
              {media.map((m) => (
                <div key={m.id} className="relative">
                  {m.type === "image" ? (
                    <img src={m.url} alt={m.name || "Project media"} className="rounded-lg border border-slate-700" />
                  ) : (
                    <div className="p-3 bg-slate-800 rounded text-xs text-white">
                      {m.type.toUpperCase()}
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteMedia(m.id)}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Note: The first image will be used automatically as the project thumbnail.
            </p>
          </div>

          {/* UPLOAD NEW MEDIA */}
          <input
            type="file"
            multiple
            className="text-white"
            onChange={(e) => setNewMediaFiles([...e.target.files])}
          />

          <TeamEditor team={team} setTeam={setTeam} />

          <button className="btn-primary w-full" disabled={loading} onClick={handleSave}>
            {loading ? "Saving..." : "Save Changes"}
          </button>

        </div>
      </main>

      <Footer />
    </div>
  );
}

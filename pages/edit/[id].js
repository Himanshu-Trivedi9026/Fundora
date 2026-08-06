// pages/edit/[id].js
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import CategorySelector from "../../components/CategorySelector";
import TeamEditor from "../../components/TeamEditor";
import { supabase } from "../../lib/supabaseClient";
import { uploadFileToProject } from "../../lib/storage";

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

  const [thumbnail, setThumbnail] = useState("");
  const [newThumbnailFile, setNewThumbnailFile] = useState(null);

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
        setThumbnail(proj.thumbnail || "");
        setMedia(mediaRows || []);
        setTeam(teamRows || []);
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    }

    load();
  }, [id, router]);

  /* -------------------------------------------
    DELETE EXISTING MEDIA (row + storage object)
  --------------------------------------------- */
  async function handleDeleteMedia(mediaId, mediaUrl) {
    if (!confirm("Delete this media?")) return;

    const { error: rowError } = await supabase
      .from("media")
      .delete()
      .eq("id", mediaId);
    if (rowError) {
      alert("Failed to delete media.");
      return;
    }

    // Remove the storage object too, so the file doesn't orphan.
    const objectPath = deriveStoragePath(mediaUrl);
    if (objectPath) {
      await supabase.storage.from("projects").remove([objectPath]);
    }

    setMedia((m) => m.filter((item) => item.id !== mediaId));
  }

  /* -------------------------------------------
    SAVE CHANGES
  --------------------------------------------- */
  async function handleSave() {
    try {
      setLoading(true);

      const updateData = {
        title,
        short,
        description,
        goal: Number(goal),
        deadline,
        prototypeUrl,
        categories,
      };

      // If a new thumbnail was selected, upload it and persist the URL.
      if (newThumbnailFile) {
        const uploadedThumb = await uploadFileToProject(
          newThumbnailFile,
          id,
          "thumbnail",
        );
        if (uploadedThumb?.url) {
          // Remove the old thumbnail object from storage if it existed.
          if (thumbnail && thumbnail !== uploadedThumb.url) {
            const oldPath = deriveStoragePath(thumbnail);
            if (oldPath) {
              await supabase.storage
                .from(
                  oldPath.startsWith("project-thumbnails/")
                    ? "project-thumbnails"
                    : "projects",
                )
                .remove([oldPath]);
            }
          }
          updateData.thumbnail = uploadedThumb.url;
          setThumbnail(uploadedThumb.url);
        }
      }

      const { error: updateError } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", id);
      if (updateError) throw updateError;

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
          })),
        );
      }

      alert("Project updated!");
      router.push(`/projects/${id}`);
    } catch (err) {
      console.error("Failed to save project:", err);
      alert("Error saving project");
    } finally {
      setLoading(false);
    }
  }

  if (!project)
    return (
      <div className="p-6 text-white" role="status" aria-live="polite">
        Loading project...
      </div>
    );

  /* -------------------------------------------
    UI
  --------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Edit Project</h1>

        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-6 space-y-6">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Project title"
            autoComplete="off"
          />
          <input
            className="input"
            value={short}
            onChange={(e) => setShort(e.target.value)}
            placeholder="Short Description"
            aria-label="Short description"
            autoComplete="off"
          />
          <textarea
            className="input"
            rows="5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Full Description"
            aria-label="Full description"
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              className="input"
              type="number"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal ₹"
              aria-label="Funding goal in rupees"
              autoComplete="off"
            />
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              aria-label="Campaign deadline"
              autoComplete="off"
            />
          </div>

          <input
            className="input"
            value={prototypeUrl}
            onChange={(e) => setPrototypeUrl(e.target.value)}
            placeholder="Prototype URL"
            aria-label="Prototype URL"
            type="url"
            autoComplete="url"
          />

          <CategorySelector selected={categories} setSelected={setCategories} />

          {/* PROJECT THUMBNAIL */}
          <div>
            <h2 className="text-sm text-slate-300 mb-2">Project Thumbnail</h2>

            <div className="flex items-center gap-4">
              {newThumbnailFile ? (
                <Image
                  src={URL.createObjectURL(newThumbnailFile)}
                  alt="New thumbnail preview"
                  width={120}
                  height={80}
                  className="rounded-lg border border-slate-700 h-20 w-auto object-cover"
                />
              ) : thumbnail ? (
                <Image
                  src={thumbnail}
                  alt="Current project thumbnail"
                  width={120}
                  height={80}
                  className="rounded-lg border border-slate-700 h-20 w-auto object-cover"
                />
              ) : (
                <div className="w-32 h-20 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-xs text-slate-400">
                  No thumbnail
                </div>
              )}

              <label className="cursor-pointer text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded px-3 py-2 hover:bg-slate-700 transition">
                {newThumbnailFile
                  ? "Replace selected"
                  : thumbnail
                    ? "Replace thumbnail"
                    : "Select thumbnail"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setNewThumbnailFile(file);
                    e.target.value = "";
                  }}
                  aria-label="Choose a project thumbnail image"
                />
              </label>

              {newThumbnailFile && (
                <button
                  onClick={() => setNewThumbnailFile(null)}
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* EXISTING MEDIA */}
          <div>
            <h2 className="text-sm text-slate-300 mb-2">Existing Media</h2>

            <div className="grid grid-cols-2 gap-4">
              {media.map((m) => (
                <div key={m.id} className="relative">
                  {m.type === "image" ? (
                    <Image
                      src={m.url}
                      alt={m.name || "Project media"}
                      width={200}
                      height={150}
                      className="rounded-lg border border-slate-700 w-full h-auto"
                    />
                  ) : (
                    <div className="p-3 bg-slate-800 rounded text-xs text-white">
                      {m.type.toUpperCase()}
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteMedia(m.id, m.url)}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Tip: Set your project thumbnail above. Gallery images are shown
              separately.
            </p>
          </div>

          {/* UPLOAD NEW MEDIA */}
          <label className="text-sm text-slate-300 block mb-1">
            Upload New Media
          </label>
          <input
            type="file"
            multiple
            className="text-white"
            onChange={(e) => setNewMediaFiles([...e.target.files])}
            aria-label="Upload new media files"
          />

          <TeamEditor team={team} setTeam={setTeam} />

          <button
            className="btn-primary w-full"
            disabled={loading}
            onClick={handleSave}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

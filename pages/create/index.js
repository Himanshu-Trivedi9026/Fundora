import { useState, useMemo, useEffect } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import MediaUploader from "../../components/MediaUploader";
import TeamEditor from "../../components/TeamEditor";
import CategorySelector from "../../components/CategorySelector";
import CampaignAIGenerator from "../../components/CampaignAIGenerator"; // ✅ NEW
import { supabase } from "../../lib/supabaseClient";
import { uploadFileToProject } from "../../lib/storage";
import { createProject } from "../../lib/projects";

export default function CreateProject() {
  const [title, setTitle] = useState("");
  const [short, setShort] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [prototypeUrl, setPrototypeUrl] = useState("");

  const [categories, setCategories] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [team, setTeam] = useState([]);

  const [loading, setLoading] = useState(false);

  // Memoize thumbnail preview URL to prevent blob URL leak on re-render
  const thumbnailPreview = useMemo(
    () => (thumbnailFile ? URL.createObjectURL(thumbnailFile) : null),
    [thumbnailFile]
  );

  // Revoke blob URL on cleanup
  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  async function handleCreate() {
    try {
      setLoading(true);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        alert("Please login first");
        return;
      }

      /* 🔒 STEP 1: Thumbnail validation */
      if (!thumbnailFile) {
        alert("Please select a project thumbnail");
        return;
      }

      if (thumbnailFile.size > 10 * 1024 * 1024) {
        alert("Thumbnail should be less than 10MB");
        return;
      }

      /* 🔒 STEP 2: Create project FIRST */
      const project = await createProject({
        title,
        short,
        description,
        goal: Number(goal),
        deadline,
        prototypeUrl,
        owner_id: user.id,
        categories,
      });

      /* 🔒 STEP 3: Upload thumbnail */
      const uploadedThumb = await uploadFileToProject(
        thumbnailFile,
        project.id,
        "thumbnail"
      );

      /* 🔒 STEP 4: Save thumbnail URL */
      await supabase
        .from("projects")
        .update({ thumbnail: uploadedThumb.url })
        .eq("id", project.id);

      /* 🔒 STEP 5: Upload media */
      const mediaRows = [];

      for (const file of mediaFiles) {
        try {
          const uploaded = await uploadFileToProject(file, project.id);
          if (!uploaded?.url) continue;

          mediaRows.push({
            project_id: project.id,
            url: uploaded.url,
            type: file.type.startsWith("image")
              ? "image"
              : file.type.startsWith("video")
              ? "video"
              : "document",
          });
        } catch (err) {
          console.error("Media upload failed:", err);
        }
      }

      if (mediaRows.length > 0) {
        await supabase.from("media").insert(mediaRows);
      }

      /* 🔒 STEP 6: Insert team */
      if (team.length > 0) {
        await supabase.from("team_members").insert(
          team.map((t) => ({
            project_id: project.id,
            name: t.name,
            role: t.role,
          }))
        );
      }

      alert("Project created successfully!");
      window.location.href = `/projects/${project.id}`;
    } catch (err) {
      console.error(err);
      alert(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">
          Create Project
        </h1>

        <div className="space-y-6 bg-slate-900/70 p-6 rounded-xl border border-slate-700">

          {/* TITLE */}
          <input
            className="input"
            placeholder="Project Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* SHORT */}
          <input
            className="input"
            placeholder="Short Description"
            value={short}
            onChange={(e) => setShort(e.target.value)}
          />

          {/* ⭐ AI GENERATOR INSERTED HERE */}
          <CampaignAIGenerator setDescription={setDescription} />

          {/* DESCRIPTION */}
          <textarea
            className="input"
            placeholder="Full Description"
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              className="input"
              type="number"
              placeholder="Goal ₹"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />

            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <input
            className="input"
            placeholder="Prototype URL (optional)"
            value={prototypeUrl}
            onChange={(e) => setPrototypeUrl(e.target.value)}
          />

          <CategorySelector
            selected={categories}
            setSelected={setCategories}
          />

          {/* THUMBNAIL */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-200">
              Project Thumbnail (max 10MB)
            </p>

            <label className="block cursor-pointer bg-slate-800 border border-slate-700 rounded-lg p-4 text-white hover:bg-slate-700 transition">
              Select thumbnail image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setThumbnailFile(file);
                }}
              />
            </label>

            {thumbnailFile && (
              <img
                src={thumbnailPreview}
                className="max-w-xs rounded border"
                alt="Thumbnail preview"
              />
            )}
          </div>

          <MediaUploader
            mediaFiles={mediaFiles}
            setMediaFiles={setMediaFiles}
          />

          <TeamEditor team={team} setTeam={setTeam} />

          <button
            onClick={handleCreate}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>

        </div>
      </main>

      <Footer />
    </div>
  );
}

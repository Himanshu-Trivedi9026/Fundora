// pages/creator/edit.js
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function EditProfile() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) return (window.location.href = "/login");

    setUser(u);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .single();

    if (data) {
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setWebsite(data.website || "");
      setAvatarUrl(data.avatar_url || "");
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = `${user.id}-${Date.now()}`;

    // Upload to 'avatars' bucket
    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (error) return alert("Avatar upload failed.");

    // Get public URL
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

    setAvatarUrl(data.publicUrl);
  }

  async function handleSave() {
    setSaving(true);

    const updateData = {
      full_name: fullName,
      bio,
      website,
      avatar_url: avatarUrl,
    };

    await supabase.from("profiles").update(updateData).eq("id", user.id);

    alert("Profile updated!");

    // Refresh page AND Navbar avatar
    window.location.reload();

    setSaving(false);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto p-6 text-white">

        <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

        <div className="space-y-6 bg-slate-900 p-6 rounded-xl border border-slate-700">

          {/* Full Name */}
          <div>
            <label htmlFor="edit-name" className="text-sm text-slate-300">Full Name</label>
            <input
              id="edit-name"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="edit-bio" className="text-sm text-slate-300">Bio</label>
            <textarea
              id="edit-bio"
              className="input"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            ></textarea>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="edit-website" className="text-sm text-slate-300">Website</label>
            <input
              id="edit-website"
              className="input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Avatar Upload */}
          <div>
            <label htmlFor="edit-avatar" className="text-sm text-slate-300">Avatar</label>
            <input id="edit-avatar" type="file" onChange={uploadAvatar} className="mt-2" />

            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="Creator avatar"
                className="mt-3 w-24 h-24 rounded-full border border-slate-700 object-cover"
              />
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

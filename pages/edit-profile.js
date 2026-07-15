// pages/edit-profile.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useRouter } from "next/router";

export default function EditProfile() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");

  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRow) {
      setProfile(profileRow);
      setFullName(profileRow.full_name || "");
      setBio(profileRow.bio || "");
      setWebsite(profileRow.website || "");

      setTwitter(profileRow.twitter || "");
      setLinkedin(profileRow.linkedin || "");
      setGithub(profileRow.github || "");
      setInstagram(profileRow.instagram || "");
      setYoutube(profileRow.youtube || "");
    }
  }

  async function uploadImage(file, path) {
    if (!file) return null;

    const fileExt = file.name.split(".").pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: url } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return url.publicUrl;
  }

  async function updateProfile(e) {
    e.preventDefault();
    setLoading(true);

    const avatar_url = await uploadImage(avatarFile, "avatars");
    const banner_url = await uploadImage(bannerFile, "banners");

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        bio,
        website,

        twitter,
        linkedin,
        github,
        instagram,
        youtube,

        ...(avatar_url && { avatar_url }),
        ...(banner_url && { banner_url }),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(`/creator/${user.id}`);
  }

  if (!profile)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading profile...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <Navbar />

      <main className="max-w-3xl mx-auto w-full p-6 mt-10 bg-slate-800/40 rounded-xl border border-slate-700 shadow-xl">
        <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>

        <form onSubmit={updateProfile} className="space-y-6">

          {/* Avatar Upload */}
          <div>
            <label htmlFor="ep-avatar" className="block text-sm mb-1">Avatar</label>
            <input
              id="ep-avatar"
              type="file"
              onChange={(e) => setAvatarFile(e.target.files[0])}
              className="text-sm"
            />
          </div>

          {/* Banner Upload */}
          <div>
            <label htmlFor="ep-banner" className="block text-sm mb-1">Banner Image</label>
            <input
              id="ep-banner"
              type="file"
              onChange={(e) => setBannerFile(e.target.files[0])}
              className="text-sm"
            />
          </div>

          <div>
            <label htmlFor="ep-name" className="block">Full Name</label>
            <input
              id="ep-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="ep-bio" className="block">Bio</label>
            <textarea
              id="ep-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input w-full h-24"
            />
          </div>

          <div>
            <label htmlFor="ep-website" className="block">Website</label>
            <input
              id="ep-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Social Links */}
          <h2 className="text-xl font-semibold mt-6">Social Links</h2>

          <div>
            <label htmlFor="ep-twitter" className="block">Twitter URL</label>
            <input
              id="ep-twitter"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="ep-linkedin" className="block">LinkedIn URL</label>
            <input
              id="ep-linkedin"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="ep-github" className="block">GitHub URL</label>
            <input
              id="ep-github"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="ep-instagram" className="block">Instagram URL</label>
            <input
              id="ep-instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label htmlFor="ep-youtube" className="block">YouTube URL</label>
            <input
              id="ep-youtube"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="flex flex-wrap gap-3">
  <button
    type="submit"
    disabled={loading}
    className="bg-cyan-500 hover:bg-cyan-600 px-6 py-2 rounded-lg text-white"
  >
    {loading ? "Saving..." : "Save Changes"}
  </button>

</div>

        </form>
      </main>

      <Footer />
    </div>
  );
}

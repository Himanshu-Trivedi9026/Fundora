import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useToast } from "../components/ui/Toast";
import SEO from "../components/SEO";

/* ─── Animation Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

/* ─── Social platform config ─── */
const SOCIAL_PLATFORMS = [
  { key: "twitter", label: "Twitter", placeholder: "Twitter profile link", icon: "tag", color: "#1DA1F2" },
  { key: "linkedin", label: "LinkedIn", placeholder: "LinkedIn profile link", icon: "work", color: "#0A66C2" },
  { key: "github", label: "GitHub", placeholder: "GitHub profile link", icon: "code", color: "#f0f0f0" },
  { key: "instagram", label: "Instagram", placeholder: "Instagram profile link", icon: "photo_camera", color: "#E4405F" },
];

export default function EditProfile() {
  const router = useRouter();
  const { toast } = useToast();

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

  // Preview URLs for local display before upload
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const loadProfile = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => loadProfile());
  }, [loadProfile]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
      if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    };
  }, [avatarPreview, bannerPreview]);

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

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Avatar must be under 4MB");
      return;
    }
    setAvatarFile(file);
    if (avatarPreview && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Banner must be under 8MB");
      return;
    }
    setBannerFile(file);
    if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(URL.createObjectURL(file));
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
      toast.error("Failed to save profile. Please try again.");
      setLoading(false);
      return;
    }

    toast.success("Profile saved successfully!");
    setLoading(false);
    router.push(`/creator/${user.id}`);
  }

  /* ─── Loading state ─── */
  if (!profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dim">
        <div className="flex flex-col items-center gap-4" role="status" aria-label="Loading profile">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm font-inter">Loading profile...</p>
        </div>
      </div>
    );

  const currentAvatar = avatarPreview || profile.avatar_url || null;
  const currentBanner = bannerPreview || profile.banner_url || null;

  return (
    <>
      <SEO
        title="Profile Settings"
        description="Manage your Fundora profile. Update your public presence, social links, and account preferences."
        url="/edit-profile"
        noindex={true}
      />
      <div className="min-h-screen flex flex-col bg-surface-dim text-on-surface">
        <Navbar />

        <main className="flex-1 pt-28 pb-24 px-4 md:px-12 max-w-[1280px] mx-auto w-full">
          {/* ─── Header ─── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h1 className="font-geist text-3xl md:text-4xl font-bold text-on-surface mb-2">
              Profile Settings
            </h1>
            <p className="text-on-surface-variant text-base">
              Manage your public presence and account preferences.
            </p>
          </motion.div>

          <form onSubmit={updateProfile}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* ─── Sidebar Navigation ─── */}
              <motion.aside
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="lg:col-span-3 space-y-2"
              >
                {[
                  { icon: "person", label: "Profile Info", active: true },
                  { icon: "security", label: "Security", href: "/account" },
                  { icon: "notifications", label: "Notifications", href: "#" },
                  { icon: "wallet", label: "Connected Wallets", href: "#" },
                ].map((item) => (
                  <motion.a
                    key={item.label}
                    variants={fadeUp}
                    href={item.href || "#"}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                      item.active
                        ? "bg-primary-container text-on-primary-container"
                        : "hover:bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </motion.a>
                ))}
              </motion.aside>

              {/* ─── Main Form Canvas ─── */}
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="lg:col-span-9 rounded-2xl p-8 space-y-12"
                style={{
                  background: "rgba(27, 27, 30, 0.6)",
                  backdropFilter: "blur(24px) saturate(1.2)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.2)",
                  border: "1px solid rgba(73, 68, 84, 0.3)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {/* Top gradient accent line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                {/* ─── Profile Media Section ─── */}
                <motion.section variants={fadeUp}>
                  <h2 className="font-geist text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">image</span>
                    Profile Identity
                  </h2>

                  <div className="space-y-8">
                    {/* Banner Upload */}
                    <div className="relative group">
                      <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-3 px-1">
                        Banner Image
                      </label>
                      <div
                        onClick={() => bannerInputRef.current?.click()}
                        className="relative h-48 w-full rounded-xl border-2 border-dashed border-outline-variant/50 hover:border-primary/50 bg-surface-container-low transition-all overflow-hidden cursor-pointer flex flex-col items-center justify-center"
                      >
                        {/* Banner background preview */}
                        {currentBanner && (
                          <div className="absolute inset-0 z-0">
                            <Image
                              src={currentBanner}
                              alt="Banner preview"
                              fill
                              sizes="100vw"
                              className="object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                            />
                          </div>
                        )}

                        {/* Upload overlay */}
                        <div className="relative z-10 flex flex-col items-center bg-surface/60 backdrop-blur-md p-5 rounded-xl border border-white/10">
                          <span className="material-symbols-outlined text-primary text-[28px] mb-2" aria-hidden="true">cloud_upload</span>
                          <span className="font-geist text-sm font-medium text-on-surface">
                            {bannerFile ? "Click to replace banner" : "Click to upload banner"}
                          </span>
                          <span className="text-xs text-on-surface-variant mt-1">Recommended: 1500 x 500 px</span>
                        </div>

                        <input
                          ref={bannerInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerChange}
                          className="hidden"
                          aria-label="Upload banner image"
                        />
                      </div>
                    </div>

                    {/* Avatar Upload */}
                    <div className="flex items-end gap-6 -mt-16 relative z-20 pl-6">
                      <div className="relative group">
                        <div
                          onClick={() => avatarInputRef.current?.click()}
                          className="w-32 h-32 rounded-full border-4 border-surface-dim overflow-hidden shadow-2xl cursor-pointer"
                        >
                          {currentAvatar ? (
                            <Image
                              src={currentAvatar}
                              alt="Avatar preview"
                              width={128}
                              height={128}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-container-high">
                              <span className="material-symbols-outlined text-on-surface-variant text-[40px]" aria-hidden="true">person</span>
                            </div>
                          )}
                        </div>
                        {/* Hover overlay */}
                        <div
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-white text-[28px]" aria-hidden="true">photo_camera</span>
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                          aria-label="Upload avatar image"
                        />
                      </div>
                      <div className="pb-2">
                        <h3 className="text-on-surface font-geist font-semibold">Avatar</h3>
                        <p className="text-on-surface-variant text-sm">Update your profile picture</p>
                      </div>
                    </div>
                  </div>
                </motion.section>

                {/* ─── Personal Information ─── */}
                <motion.section variants={fadeUp} className="space-y-6">
                  <h2 className="font-geist text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">badge</span>
                    Personal Details
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <label htmlFor="ep-name" className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest px-1">
                        Full Name
                      </label>
                      <input
                        id="ep-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3.5 text-on-surface text-sm placeholder:text-outline/40 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-inter"
                      />
                    </div>

                    {/* Website */}
                    <div className="space-y-2">
                      <label htmlFor="ep-website" className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest px-1">
                        Website URL
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]" aria-hidden="true">
                          language
                        </span>
                        <input
                          id="ep-website"
                          type="url"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          autoComplete="url"
                          className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl pl-12 pr-4 py-3.5 text-on-surface text-sm placeholder:text-outline/40 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-inter"
                        />
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="md:col-span-2 space-y-2">
                      <div className="flex justify-between px-1">
                        <label htmlFor="ep-bio" className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest">
                          Bio
                        </label>
                        <span id="bio-counter" className={`text-xs ${bio.length > 200 ? "text-danger" : "text-on-surface-variant/60"}`}>
                          {bio.length} / 200
                        </span>
                      </div>
                      <textarea
                        id="ep-bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell the world about your work..."
                        rows={4}
                        maxLength={250}
                        aria-describedby="bio-counter"
                        autoComplete="off"
                        className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3.5 text-on-surface text-sm placeholder:text-outline/40 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1)] transition-all font-inter resize-none"
                      />
                    </div>
                  </div>
                </motion.section>

                {/* ─── Social Connectivity ─── */}
                <motion.section variants={fadeUp}>
                  <h2 className="font-geist text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">hub</span>
                    Social Connectivity
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SOCIAL_PLATFORMS.map(({ key, label, placeholder, icon }) => {
                      const socialState = { twitter, linkedin, github, instagram }[key];
                      const socialSetter = {
                        twitter: setTwitter,
                        linkedin: setLinkedin,
                        github: setGithub,
                        instagram: setInstagram,
                      }[key];

                      return (
                        <div
                          key={key}
                          className="group flex items-center gap-3 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/20 focus-within:border-primary/50 transition-all"
                        >
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest shrink-0">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]" aria-hidden="true">{icon}</span>
                          </div>
                          <input
                            type="text"
                            value={socialState}
                            onChange={(e) => socialSetter(e.target.value)}
                            placeholder={placeholder}
                            aria-label={label}
                            className="flex-grow bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-outline/40 font-inter"
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.section>

                {/* ─── Form Actions ─── */}
                <motion.div variants={fadeUp} className="pt-8 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl border border-outline-variant/50 text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors active:scale-95 font-geist text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-10 py-3 rounded-xl bg-primary text-on-primary font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed font-geist text-sm"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save Changes
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">done_all</span>
                      </>
                    )}
                  </button>
                </motion.div>

              </motion.div>
            </div>
          </form>
        </main>

        <Footer />
      </div>
    </>
  );
}

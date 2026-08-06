import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";
import ProfileActions from "../../components/creator/ProfileActions";
import ProfileHeader from "../../components/creator/ProfileHeader";
import DashboardLayout from "../../components/creator/DashboardLayout";
import SidebarAbout from "../../components/creator/SidebarAbout";
import SidebarConnect from "../../components/creator/SidebarConnect";
import StatsGrid from "../../components/creator/StatsGrid";
import ProjectTabs from "../../components/creator/ProjectTabs";
import AchievementsBento from "../../components/creator/AchievementsBento";
import VerificationCard from "../../components/security/VerificationCard";
import VerificationBadge from "../../components/security/VerificationBadge";

function cleanUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function CreatorProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const followTouchedRef = useRef(false);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || null);
    });
  }, []);

  const loadProfile = useCallback(
    async (userId) => {
      queueMicrotask(() => setLoading(true));
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        const { data: projectRows } = await supabase
          .from("projects")
          .select("*")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false });

        const { count: followersCount } = await supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("following_id", userId);

        const { count: followingCount } = await supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId);

        if (currentUserId && !followTouchedRef.current) {
          const { data } = await supabase
            .from("followers")
            .select("id")
            .eq("follower_id", currentUserId)
            .eq("following_id", userId)
            .maybeSingle();

          setIsFollowing(!!data);
        }

        // Fetch verification data (non-sensitive fields only)
        const { data: verificationRow } = await supabase
          .from("creator_verifications")
          .select(
            "verification_level, verification_status, trust_score, risk_score, email_verified, phone_verified, identity_verified, bank_verified, business_verified, selfie_verified",
          )
          .eq("user_id", userId)
          .maybeSingle();

        setVerification(verificationRow);

        setProfile({
          ...profileRow,
          followers_count: followersCount || 0,
          following_count: followingCount || 0,
        });

        setProjects(projectRows || []);
      } finally {
        queueMicrotask(() => setLoading(false));
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    if (id && currentUserId !== undefined) {
      loadProfile(id);
    }
  }, [id, currentUserId, loadProfile]);

  /* ---------------- FOLLOW ---------------- */
  async function followUser(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (currentUserId === id) return;

    followTouchedRef.current = true;

    setIsFollowing(true);
    setProfile((p) => ({
      ...p,
      followers_count: p.followers_count + 1,
    }));

    const { error } = await supabase.from("followers").insert({
      follower_id: currentUserId,
      following_id: id,
    });

    if (error) {
      followTouchedRef.current = false;
      setIsFollowing(false);
      setProfile((p) => ({
        ...p,
        followers_count: Math.max(0, p.followers_count - 1),
      }));
    }
  }

  /* ---------------- UNFOLLOW ---------------- */
  async function unfollowUser(e) {
    e.preventDefault();
    e.stopPropagation();

    followTouchedRef.current = true;

    setIsFollowing(false);
    setProfile((p) => ({
      ...p,
      followers_count: Math.max(0, p.followers_count - 1),
    }));

    const { error } = await supabase
      .from("followers")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", id);

    if (error) {
      followTouchedRef.current = false;
      setIsFollowing(true);
      setProfile((p) => ({
        ...p,
        followers_count: p.followers_count + 1,
      }));
    }
  }

  /* ─── DERIVED DATA ─── */
  const totalRaised = useMemo(
    () => projects.reduce((sum, p) => sum + (p.pledged || 0), 0),
    [projects],
  );

  const achievements = useMemo(() => {
    const list = [];
    if (!profile) return list;
    if (projects.length >= 1)
      list.push({
        icon: "rocket_launch",
        title: "First Launch",
        description: "Successfully launched their first project on Fundora.",
      });
    if (projects.length >= 5)
      list.push({
        icon: "emoji_events",
        title: "Impact Leader",
        description: "Launched 5+ projects, driving innovation forward.",
      });
    if (profile.followers_count >= 100)
      list.push({
        icon: "workspace_premium",
        title: "Top 1% Creator",
        description: "Recognized among the most followed creators on Fundora.",
      });
    if (profile.followers_count >= 50)
      list.push({
        icon: "favorite",
        title: "Community Favorite",
        description: "Beloved by 50+ backers and community members.",
      });
    if (totalRaised >= 10000)
      list.push({
        icon: "payments",
        title: "Legacy Milestone",
        description: "Raised over ₹10,000 across all projects.",
      });
    if (projects.some((p) => p.pledged >= p.goal && p.goal > 0))
      list.push({
        icon: "emoji_events",
        title: "Fully Funded",
        description: "Achieved 100% funding on at least one project.",
      });
    if (projects.length >= 3)
      list.push({
        icon: "public",
        title: "Global Architect",
        description: "Created 3+ projects impacting diverse communities.",
      });
    return list;
  }, [projects, profile, totalRaised]);

  /* ---------------- UI STATES ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <div
          className="flex-1 flex items-center justify-center"
          role="status"
          aria-label="Loading creator profile"
        >
          <span
            className="material-symbols-outlined animate-spin text-primary text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            progress_activity
          </span>
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-on-surface-variant font-inter text-lg">
            Profile not found.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const avatar =
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profile.full_name || "User",
    )}&background=0D8ABC&color=fff&size=256`;

  const banner =
    profile.banner_url ||
    "https://images.unsplash.com/photo-1503264116251-35a269479413";

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      {/* ── HERO ── */}
      <ProfileHeader
        banner={banner}
        avatar={avatar}
        fullName={profile.full_name}
        bio={profile.bio}
        verificationLevel={verification?.verification_level || 0}
      >
        <ProfileActions
          isOwner={currentUserId === profile.id}
          isFollowing={isFollowing}
          onEdit={() => {
            router.push("/edit-profile");
          }}
          onMessage={() => {
            router.push(`/dm/${profile.id}`);
          }}
          onFollow={followUser}
          onUnfollow={unfollowUser}
        />
      </ProfileHeader>

      {/* ── DASHBOARD ── */}
      <main className="flex-1 pb-20">
        <DashboardLayout
          sidebar={
            <>
              <SidebarAbout bio={profile.bio} achievements={achievements} />
              <SidebarConnect profile={profile} />
              {currentUserId === profile.id && verification && (
                <VerificationCard
                  verification={verification}
                  onNavigate={() => {
                    router.push("/creator/verification");
                  }}
                />
              )}
            </>
          }
        >
          <StatsGrid
            totalRaised={totalRaised}
            projectCount={projects.length}
            backersCount={profile.followers_count}
          />

          <ProjectTabs
            projects={projects}
            currentUserId={currentUserId}
            creatorName={profile.full_name}
          />

          {achievements.length > 0 && (
            <AchievementsBento achievements={achievements} />
          )}
        </DashboardLayout>
      </main>

      <Footer />
    </div>
  );
}

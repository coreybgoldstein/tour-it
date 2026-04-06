"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import ClipViewer from "@/components/ClipViewer";
function FlagBadge({ label }: { label: string | number }) {
  return (
    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.1)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff" }}>{label}</span>
    </div>
  );
}

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  handicapIndex: number | null;
  homeCourseId: string | null;
  uploadCount: number;
  bio: string | null;
};

type Upload = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  holeId: string;
  holeNumber?: number | null;
  seriesId?: string | null;
  createdAt: string;
  userId: string;
  likeCount?: number;
  commentCount?: number;
  shotType?: string | null;
  clubUsed?: string | null;
  windCondition?: string | null;
  strategyNote?: string | null;
  landingZoneNote?: string | null;
  whatCameraDoesntShow?: string | null;
  datePlayedAt?: string | null;
};

type CoursePlayed = {
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl?: string | null;
};

type HomeCourse = {
  id: string;
  name: string;
};

export default function PublicProfilePage() {
  const { userId } = useParams();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [coursesPlayed, setCoursesPlayed] = useState<CoursePlayed[]>([]);
  const [homeCourse, setHomeCourse] = useState<HomeCourse | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Current user state (for follow button)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Clip viewer
  const [selectedClip, setSelectedClip] = useState<Upload | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    async function load() {
      // Check if current user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setCurrentUserId(authUser.id);

        // If viewing own profile, redirect to /profile
        if (authUser.id === userId) {
          router.replace("/profile");
          return;
        }
      }

      // Fetch the profile being viewed
      const { data: profileData, error: profileError } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, handicapIndex, homeCourseId, uploadCount, bio")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Fetch uploads, followers, following in parallel
      const [
        { data: rawUploads },
        { count: followers },
        { count: following },
      ] = await Promise.all([
        supabase
          .from("Upload")
          .select("id, mediaUrl, mediaType, courseId, holeId, seriesId, createdAt, userId, likeCount, commentCount, shotType, clubUsed, windCondition, strategyNote, landingZoneNote, whatCameraDoesntShow, datePlayedAt")
          .eq("userId", userId)
          .order("createdAt", { ascending: false }),
        supabase
          .from("Follow")
          .select("*", { count: "exact", head: true })
          .eq("followingId", userId)
          .eq("status", "ACTIVE"),
        supabase
          .from("Follow")
          .select("*", { count: "exact", head: true })
          .eq("followerId", userId)
          .eq("status", "ACTIVE"),
      ]);

      // Resolve hole numbers
      let userUploads = rawUploads || [];
      if (userUploads.length > 0) {
        const holeIds = [...new Set(userUploads.map((u: any) => u.holeId).filter(Boolean))];
        if (holeIds.length > 0) {
          const { data: holes } = await supabase.from("Hole").select("id, holeNumber").in("id", holeIds);
          const holeMap = new Map(holes?.map((h: any) => [h.id, h.holeNumber]) || []);
          userUploads = userUploads.map((u: any) => ({ ...u, holeNumber: holeMap.get(u.holeId) || null }));
        }
      }

      setUploads(userUploads);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      // Check if current user follows this profile
      if (authUser) {
        const { data: followRecord } = await supabase
          .from("Follow")
          .select("id, status")
          .eq("followerId", authUser.id)
          .eq("followingId", userId)
          .single();

        if (followRecord && followRecord.status === "ACTIVE") {
          setIsFollowing(true);
        }
      }

      // Fetch courses played
      if (userUploads && userUploads.length > 0) {
        const uniqueCourseIds = [...new Set(userUploads.map((u: Upload) => u.courseId))];
        const { data: courses } = await supabase
          .from("Course")
          .select("id, name, city, state, logoUrl")
          .in("id", uniqueCourseIds);
        setCoursesPlayed(courses || []);
      }

      // Fetch home course
      if (profileData.homeCourseId) {
        const { data: hc } = await supabase
          .from("Course")
          .select("id, name")
          .eq("id", profileData.homeCourseId)
          .single();
        setHomeCourse(hc);
      }

      setLoading(false);
    }

    load();
  }, [userId, router]);

  async function handleFollow() {
    if (!currentUserId || !userId || followLoading) return;
    setFollowLoading(true);

    const supabase = createClient();

    if (isFollowing) {
      // Unfollow: delete or update status
      await supabase
        .from("Follow")
        .delete()
        .eq("followerId", currentUserId)
        .eq("followingId", userId);

      setIsFollowing(false);
      setFollowerCount(prev => Math.max(0, prev - 1));
    } else {
      // Follow: insert new record
      await supabase.from("Follow").insert({
        id: crypto.randomUUID(),
        followerId: currentUserId,
        followingId: userId,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      });

      setIsFollowing(true);
      setFollowerCount(prev => prev + 1);
    }

    setFollowLoading(false);
  }

  if (loading) {
    return (
      <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontFamily: "'Outfit', sans-serif" }}>Loading...</div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>User not found</h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>This profile doesn't exist or has been removed.</p>
        <button
          onClick={() => router.push("/")}
          style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
        >
          Go home
        </button>
      </main>
    );
  }

  const initials = profile.displayName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const selectedCourse = selectedClip ? coursesPlayed.find(c => c.id === selectedClip.courseId) : null;
  const selectedCourseName = selectedCourse?.name ?? null;
  const selectedCourseLogoUrl = selectedCourse?.logoUrl ?? null;

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", fontFamily: "'Outfit', sans-serif", color: "#fff", paddingBottom: "80px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .clip-thumb:active { opacity: 0.75; }
        .course-chip:hover { border-color: rgba(77,168,98,0.4); }
      `}</style>

      {/* Clip viewer */}
      {selectedClip && (
        <ClipViewer
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          courseName={selectedCourseName}
          courseLogoUrl={selectedCourseLogoUrl}
          uploader={profile ? { id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl } : null}
          currentUserId={currentUserId}
        />
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>@{profile.username}</div>
        <div style={{ width: 36 }} />
      </div>

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "16px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: profile.avatarUrl ? "transparent" : "#1a3320", border: "2px solid rgba(77,168,98,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 600, color: "rgba(255,255,255,0.6)", overflow: "hidden" }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials
          )}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 700, color: "#fff", textAlign: "center" }}>{profile.displayName}</div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "-6px" }}>@{profile.username}</div>

        {profile.bio && (
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 280, lineHeight: 1.5, marginTop: "4px" }}>
            {profile.bio}
          </div>
        )}

        {/* Follow button */}
        {currentUserId && currentUserId !== userId && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            style={{
              marginTop: "8px",
              padding: "10px 32px",
              borderRadius: "10px",
              border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none",
              background: isFollowing ? "rgba(255,255,255,0.06)" : "#2d7a42",
              fontFamily: "'Outfit', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              color: isFollowing ? "rgba(255,255,255,0.6)" : "#fff",
              cursor: "pointer",
              transition: "all 0.15s",
              opacity: followLoading ? 0.6 : 1,
            }}
          >
            {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        )}

        {/* Login prompt if not logged in */}
        {!currentUserId && (
          <button
            onClick={() => router.push("/login")}
            style={{
              marginTop: "8px",
              padding: "10px 32px",
              borderRadius: "10px",
              background: "#2d7a42",
              border: "none",
              fontFamily: "'Outfit', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Log in to follow
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "center", gap: "32px", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { num: uploads.length, label: "Clips" },
          { num: coursesPlayed.length, label: "Courses" },
          { num: followerCount, label: "Followers" },
          { num: followingCount, label: "Following" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>{s.num}</div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info pills */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {profile.handicapIndex !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "#4da862" }}>
            {profile.handicapIndex} hcp
          </div>
        )}
        {homeCourse && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
            {homeCourse.name}
          </div>
        )}
      </div>

      {/* Courses played — compact pills */}
      {coursesPlayed.length > 0 && (
        <div style={{ marginBottom: "16px", marginTop: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "0 20px", marginBottom: "8px" }}>Courses played</div>
          <div style={{ display: "flex", gap: "6px", padding: "0 20px", overflowX: "auto", paddingBottom: 2 }}>
            {coursesPlayed.map(c => (
              <button key={c.id} onClick={() => router.push(`/courses/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0, display: "block" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clips grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Clips</div>
        </div>
        {uploads.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>No clips yet</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>@{profile.username} hasn't uploaded any clips</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
            {uploads.map((upload, i) => (
              <div
                key={upload.id}
                className="clip-thumb"
                onClick={() => setSelectedClip(upload)}
                style={{
                  aspectRatio: "9/16",
                  borderRadius: "6px",
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                  background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)",
                  transition: "opacity 0.15s",
                }}
              >
                {upload.mediaType === "PHOTO" ? (
                  <img src={upload.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <video src={upload.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1, marginRight: 4 }}>
                    {coursesPlayed.find(c => c.id === upload.courseId)?.name || ""}
                  </div>
                  <FlagBadge label={upload.holeNumber ?? "·"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type UserProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  handicapIndex: number | null;
  homeCourseId: string | null;
  uploadCount: number;
};

type Upload = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  holeId: string;
  createdAt: string;
};

type CoursePlayed = {
  id: string;
  name: string;
  city: string;
  state: string;
};

type HomeCourse = {
  id: string;
  name: string;
};

type SavedCourse = {
  id: string;
  courseId: string;
  saveType: "PLAYED" | "BUCKET_LIST";
  course: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [coursesPlayed, setCoursesPlayed] = useState<CoursePlayed[]>([]);
  const [homeCourse, setHomeCourse] = useState<HomeCourse | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [coursesTab, setCoursesTab] = useState<"BUCKET_LIST" | "PLAYED" | "UPLOADED">("BUCKET_LIST");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editHandicap, setEditHandicap] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete / view state
  const [selectedClip, setSelectedClip] = useState<Upload | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login"); return; }

      const { data: profile } = await supabase.from("User").select("*").eq("id", authUser.id).single();
      if (!profile) { router.push("/login"); return; }
      setUser(profile);
      setEditHandicap(profile.handicapIndex?.toString() || "");

      const [{ data: userUploads }, { count: followers }, { count: following }] = await Promise.all([
        supabase.from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, createdAt").eq("userId", authUser.id).order("createdAt", { ascending: false }),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followingId", authUser.id).eq("status", "ACTIVE"),
        supabase.from("Follow").select("*", { count: "exact", head: true }).eq("followerId", authUser.id).eq("status", "ACTIVE"),
      ]);

      setUploads(userUploads || []);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (userUploads && userUploads.length > 0) {
        const uniqueCourseIds = [...new Set(userUploads.map((u: Upload) => u.courseId))];
        const { data: courses } = await supabase.from("Course").select("id, name, city, state").in("id", uniqueCourseIds);
        setCoursesPlayed(courses || []);
      }

      // Fetch saved courses
      const { data: saves } = await supabase
        .from("Save")
        .select("id, courseId, saveType")
        .eq("userId", authUser.id)
        .not("courseId", "is", null);

      if (saves && saves.length > 0) {
        const savedCourseIds = saves.map((s: any) => s.courseId);
        const { data: savedCoursesData } = await supabase
          .from("Course")
          .select("id, name, city, state")
          .in("id", savedCourseIds);

        const enrichedSaves: SavedCourse[] = saves.map((s: any) => ({
          ...s,
          course: savedCoursesData?.find((c: any) => c.id === s.courseId) || { id: s.courseId, name: "Unknown", city: "", state: "" },
        }));
        setSavedCourses(enrichedSaves);
      }

      if (profile.homeCourseId) {
        const { data: hc } = await supabase.from("Course").select("id, name").eq("id", profile.homeCourseId).single();
        setHomeCourse(hc);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      await supabase.from("User").update({ avatarUrl: publicUrl }).eq("id", user.id);
      setUser({ ...user, avatarUrl: publicUrl });
    }
    setUploadingAvatar(false);
  }

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const hcp = editHandicap ? parseFloat(editHandicap) : null;
    await supabase.from("User").update({ handicapIndex: hcp, updatedAt: new Date().toISOString() }).eq("id", user.id);
    setUser({ ...user, handicapIndex: hcp });
    setSaving(false);
    setShowEdit(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleDeleteClip() {
    if (!selectedClip || !user) return;
    setDeleting(true);

    try {
      const supabase = createClient();

      // Extract storage path from URL
      const url = selectedClip.mediaUrl;
      const bucket = selectedClip.mediaType === "VIDEO" ? "tour-it-videos" : "tour-it-photos";
      const bucketIndex = url.indexOf(`/${bucket}/`);
      if (bucketIndex !== -1) {
        const storagePath = url.substring(bucketIndex + bucket.length + 2);
        await supabase.storage.from(bucket).remove([storagePath]);
      }

      // Delete from DB
      await supabase.from("Upload").delete().eq("id", selectedClip.id);

      // Update local state
      setUploads(prev => prev.filter(u => u.id !== selectedClip.id));
      setSelectedClip(null);
      setConfirmDelete(false);
    } catch {
      // fail silently — clip may already be gone
    }

    setDeleting(false);
  }

  if (loading) {
    return (
      <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading...</div>
      </main>
    );
  }

  if (!user) return null;

  const initials = user.displayName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const selectedCourseName = selectedClip ? coursesPlayed.find(c => c.id === selectedClip.courseId)?.name : null;

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", fontFamily: "'Outfit', sans-serif", color: "#fff", paddingBottom: "80px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .clip-thumb:active { opacity: 0.75; }
        .course-chip:hover { border-color: rgba(77,168,98,0.4); }
      `}</style>

      {/* Clip viewer modal */}
      {selectedClip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 16px 12px", position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
            <button onClick={() => { setSelectedClip(null); setConfirmDelete(false); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            {selectedCourseName && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>{selectedCourseName}</div>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(220,100,100,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>

          {/* Media */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
            {selectedClip.mediaType === "VIDEO" ? (
              <video src={selectedClip.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} controls playsInline autoPlay muted />
            ) : (
              <img src={selectedClip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </div>

          {/* Confirm delete sheet */}
          {confirmDelete && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 20 }}>
              <div style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "28px 20px 40px" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>Delete this clip?</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
                  This can't be undone. The clip will be permanently removed.
                </div>
                <button
                  onClick={handleDeleteClip}
                  disabled={deleting}
                  style={{ width: "100%", background: "rgba(220,60,60,0.85)", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 10, opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "Deleting..." : "Yes, delete it"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Profile</div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "5px 12px", color: "rgba(255,255,255,0.45)", fontSize: "11px", cursor: "pointer" }}>
          Log out
        </button>
      </div>

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "24px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ position: "relative" }}>
          <div onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: "50%", background: user.avatarUrl ? "transparent" : "#1a3320", border: "2px solid rgba(77,168,98,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer", overflow: "hidden" }}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : uploadingAvatar ? <span style={{ fontSize: "12px" }}>...</span> : initials}
          </div>
          <div onClick={() => fileInputRef.current?.click()} style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 700, color: "#fff", textAlign: "center" }}>{user.displayName}</div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "-6px" }}>@{user.username}</div>
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
        {user.handicapIndex !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "#4da862" }}>
            {user.handicapIndex} hcp
          </div>
        )}
        {homeCourse && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
            {homeCourse.name}
          </div>
        )}
        {!user.handicapIndex && !homeCourse && (
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>Add your handicap and home course below</div>
        )}
      </div>

      {/* Edit profile */}
      <div style={{ padding: "12px 20px" }}>
        <button onClick={() => setShowEdit(!showEdit)} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
          {showEdit ? "Cancel" : "Edit profile"}
        </button>
        {showEdit && (
          <div style={{ marginTop: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Handicap index</label>
              <input type="number" step="0.1" min="-10" max="54" placeholder="e.g. 8.4" value={editHandicap} onChange={e => setEditHandicap(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "9px 12px", color: "#fff", fontSize: "13px", outline: "none" }} />
            </div>
            <button onClick={handleSaveProfile} style={{ padding: "10px", background: "#4da862", border: "none", borderRadius: "10px", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {/* My Courses — unified section */}
      {(savedCourses.length > 0 || coursesPlayed.length > 0) && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>My courses</div>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => setCoursesTab("BUCKET_LIST")}
                style={{ padding: "4px 8px", borderRadius: "99px", border: "none", fontSize: "9px", fontWeight: 600, cursor: "pointer", background: coursesTab === "BUCKET_LIST" ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.05)", color: coursesTab === "BUCKET_LIST" ? "#4da862" : "rgba(255,255,255,0.4)" }}
              >
                ⛳ Bucket List
              </button>
              <button
                onClick={() => setCoursesTab("PLAYED")}
                style={{ padding: "4px 8px", borderRadius: "99px", border: "none", fontSize: "9px", fontWeight: 600, cursor: "pointer", background: coursesTab === "PLAYED" ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.05)", color: coursesTab === "PLAYED" ? "#4da862" : "rgba(255,255,255,0.4)" }}
              >
                ✓ Played
              </button>
              <button
                onClick={() => setCoursesTab("UPLOADED")}
                style={{ padding: "4px 8px", borderRadius: "99px", border: "none", fontSize: "9px", fontWeight: 600, cursor: "pointer", background: coursesTab === "UPLOADED" ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.05)", color: coursesTab === "UPLOADED" ? "#4da862" : "rgba(255,255,255,0.4)" }}
              >
                📹 Uploaded
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", padding: "0 20px", overflowX: "auto" }}>
            {coursesTab === "BUCKET_LIST" && (
              savedCourses.filter(s => s.saveType === "BUCKET_LIST").length === 0 ? (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", padding: "12px 0" }}>No bucket list courses yet</div>
              ) : (
                savedCourses.filter(s => s.saveType === "BUCKET_LIST").map(s => (
                  <div key={s.id} className="course-chip" onClick={() => router.push(`/courses/${s.course.id}`)} style={{ minWidth: "110px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: "10px", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ height: 55, background: "linear-gradient(135deg,#1a3d4d,#2d5a7a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "20px" }}>⛳</span>
                    </div>
                    <div style={{ padding: "6px 8px", fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.course.name}</div>
                    <div style={{ padding: "0 8px 6px", fontSize: "8px", color: "rgba(255,255,255,0.35)" }}>{s.course.city}, {s.course.state}</div>
                  </div>
                ))
              )
            )}
            {coursesTab === "PLAYED" && (
              savedCourses.filter(s => s.saveType === "PLAYED").length === 0 ? (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", padding: "12px 0" }}>No played courses marked yet</div>
              ) : (
                savedCourses.filter(s => s.saveType === "PLAYED").map(s => (
                  <div key={s.id} className="course-chip" onClick={() => router.push(`/courses/${s.course.id}`)} style={{ minWidth: "110px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: "10px", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ height: 55, background: "linear-gradient(135deg,#1a4d22,#2d7a42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "20px" }}>✓</span>
                    </div>
                    <div style={{ padding: "6px 8px", fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.course.name}</div>
                    <div style={{ padding: "0 8px 6px", fontSize: "8px", color: "rgba(255,255,255,0.35)" }}>{s.course.city}, {s.course.state}</div>
                  </div>
                ))
              )
            )}
            {coursesTab === "UPLOADED" && (
              coursesPlayed.length === 0 ? (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", padding: "12px 0" }}>No uploads yet</div>
              ) : (
                coursesPlayed.map((c, i) => (
                  <div key={c.id} className="course-chip" onClick={() => router.push(`/courses/${c.id}`)} style={{ minWidth: "110px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", overflow: "hidden", cursor: "pointer", flexShrink: 0 }}>
                    <div style={{ height: 55, background: i % 2 === 0 ? "linear-gradient(135deg,#1a4d22,#2d7a42)" : "linear-gradient(135deg,#1e3a10,#4a7a25)" }} />
                    <div style={{ padding: "6px 8px", fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ padding: "0 8px 6px", fontSize: "8px", color: "rgba(255,255,255,0.35)" }}>{c.city}, {c.state}</div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Clips grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Your clips</div>
          {uploads.length > 0 && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif" }}>Tap to view or delete</div>}
        </div>
        {uploads.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>No clips yet</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginBottom: "16px" }}>Upload your first hole to get started</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#4da862", border: "none", borderRadius: "10px", padding: "10px 24px", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Upload a clip</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", padding: "0 20px" }}>
            {uploads.map((upload, i) => (
              <div
                key={upload.id}
                className="clip-thumb"
                onClick={() => setSelectedClip(upload)}
                style={{ aspectRatio: "9/16", borderRadius: "6px", overflow: "hidden", position: "relative", cursor: "pointer", background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)", transition: "opacity 0.15s" }}
              >
                {upload.mediaType === "PHOTO" ? (
                  <img src={upload.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <video src={upload.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: "5px", left: "5px", fontSize: "8px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                  {coursesPlayed.find(c => c.id === upload.courseId)?.name?.split(" ").slice(0, 2).join(" ") || ""}
                </div>
                {/* Delete indicator */}
                <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
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

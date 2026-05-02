"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressVideo } from "@/lib/compressVideo";
import { sendPushToUser } from "@/lib/sendPush";

type Course = { id: string; name: string; city: string; state: string; holeCount: number };
type TagUser = { id: string; username: string; displayName: string; avatarUrl: string | null };

const SHOT_TYPES = [
  { label: "Tee", value: "TEE_SHOT" },
  { label: "Approach", value: "APPROACH" },
  { label: "Chip", value: "CHIP" },
  { label: "Pitch", value: "PITCH" },
  { label: "Putt", value: "PUTT" },
  { label: "Bunker", value: "BUNKER" },
  { label: "Layup", value: "LAY_UP" },
  { label: "Full Hole", value: "FULL_HOLE" },
];

const WIND_OPTIONS = [
  { label: "Calm", value: "CALM" },
  { label: "Light", value: "LIGHT" },
  { label: "Moderate", value: "MODERATE" },
  { label: "Strong", value: "STRONG" },
  { label: "Into", value: "INTO" },
  { label: "Downwind", value: "DOWNWIND" },
  { label: "L→R", value: "LEFT_TO_RIGHT" },
  { label: "R→L", value: "RIGHT_TO_LEFT" },
];

type ClipStatus = "pending" | "compressing" | "uploading" | "done" | "error";

type BatchClip = {
  id: string;
  file: File;
  thumbnail: string;
  holeNumber: number | null;
  shotType: string;
  clubUsed: string;
  windCondition: string;
  strategyNote: string;
  showIntel: boolean;
  compressPct: number;
  compressStage: string;
  compressedFile: File | null;
  status: ClipStatus;
  errorMsg: string | null;
  taggedUsers: TagUser[];
};

const SKIP_MB = 30;
const MAX_FILE_MB = 500;

// Draw first frame of a video file to a canvas → return data URL
async function generateThumbnail(file: File): Promise<string> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(0.5, video.duration * 0.1);
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 120;
        canvas.height = 180;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(video, 0, 0, 120, 180);
        cleanup();
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } catch {
        cleanup();
        resolve("");
      }
    });

    video.addEventListener("error", () => { cleanup(); resolve(""); });
  });
}

export default function BatchUpload({ initialFiles, onBack }: { initialFiles: File[]; onBack: () => void }) {
  const router = useRouter();
  const [clips, setClips] = useState<BatchClip[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [dupeCount, setDupeCount] = useState(0);

  // Tag search state — one active clip at a time
  const [tagClipId, setTagClipId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagResults, setTagResults] = useState<TagUser[]>([]);
  const tagDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const courseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize clips, generate thumbnails, kick off compression
  useEffect(() => {
    // Filter out non-media files and deduplicate by name+size
    const seen = new Set<string>();
    const valid = initialFiles.filter(f => {
      if (!f.type.startsWith("video/") && !f.type.startsWith("image/")) return false;
      if (f.size > MAX_FILE_MB * 1024 * 1024) return false;
      const key = `${f.name}:${f.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const removed = initialFiles.length - valid.length;
    if (removed > 0) setDupeCount(removed);

    const initial: BatchClip[] = valid.map(file => ({
      id: crypto.randomUUID(),
      file,
      thumbnail: "",
      holeNumber: null,
      shotType: "TEE_SHOT",
      clubUsed: "",
      windCondition: "",
      strategyNote: "",
      showIntel: false,
      compressPct: 0,
      compressStage: "",
      compressedFile: null,
      status: (file.type.startsWith("video/") && file.size >= SKIP_MB * 1024 * 1024) ? "compressing" : "pending",
      errorMsg: null,
      taggedUsers: [],
    }));
    setClips(initial);

    initial.forEach(clip => {
      // Generate static thumbnail for videos
      if (clip.file.type.startsWith("video/")) {
        generateThumbnail(clip.file).then(thumb => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, thumbnail: thumb } : c));
        });
      } else {
        // Photo: use object URL directly
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, thumbnail: URL.createObjectURL(clip.file) } : c));
      }

      // Start compression for large videos
      if (clip.file.type.startsWith("video/") && clip.file.size >= SKIP_MB * 1024 * 1024) {
        compressVideo(clip.file, (stage, pct) => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, compressStage: stage, compressPct: pct } : c));
        }).then(compressed => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, compressedFile: compressed, status: "pending" } : c));
        }).catch(() => {
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "pending" } : c));
        });
      }
    });
  }, []);

  // Course search
  const searchCourses = useCallback((q: string) => {
    if (courseDebounce.current) clearTimeout(courseDebounce.current);
    if (!q.trim()) { setCourseResults([]); setCourseLoading(false); return; }
    setCourseLoading(true);
    courseDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, holeCount")
        .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
        .order("uploadCount", { ascending: false })
        .limit(20);
      setCourseResults(data || []);
      setCourseLoading(false);
    }, 280);
  }, []);

  useEffect(() => { searchCourses(courseSearch); }, [courseSearch, searchCourses]);

  // Tag user search
  useEffect(() => {
    if (tagDebounce.current) clearTimeout(tagDebounce.current);
    if (!tagInput.trim()) { setTagResults([]); return; }
    tagDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const activeClip = clips.find(c => c.id === tagClipId);
      const taggedIds = new Set(activeClip?.taggedUsers.map(u => u.id) || []);
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl")
        .ilike("username", `%${tagInput.trim()}%`)
        .limit(6);
      setTagResults((data || []).filter((u: TagUser) => !taggedIds.has(u.id)));
    }, 280);
  }, [tagInput, tagClipId, clips]);

  function updateClip(id: string, patch: Partial<BatchClip>) {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  function addTag(clipId: string, user: TagUser) {
    setClips(prev => prev.map(c =>
      c.id === clipId ? { ...c, taggedUsers: [...c.taggedUsers, user] } : c
    ));
    setTagInput("");
    setTagResults([]);
  }

  function removeTag(clipId: string, userId: string) {
    setClips(prev => prev.map(c =>
      c.id === clipId ? { ...c, taggedUsers: c.taggedUsers.filter(u => u.id !== userId) } : c
    ));
  }

  async function uploadAll() {
    if (!selectedCourse) return;
    const assignedClips = clips.filter(c => c.holeNumber !== null);
    if (assignedClips.length === 0) return;

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const { data: taggerProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
    const taggerName = taggerProfile?.displayName || taggerProfile?.username || "Someone";

    let done = 0;

    for (const clip of assignedClips) {
      setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "uploading" } : c));

      try {
        // Use compressed file if ready, otherwise upload original
        const fileToUpload = clip.compressedFile || clip.file;
        const isVideo = clip.file.type.startsWith("video/");

        let mediaUrl = "";
        let cloudflareVideoId: string | null = null;

        if (isVideo) {
          const cfRes = await fetch("/api/cloudflare-stream/direct-upload", { method: "POST" });
          if (!cfRes.ok) throw new Error("Could not start Cloudflare upload");
          const { uploadUrl, uid } = await cfRes.json();
          const formData = new FormData();
          formData.append("file", fileToUpload);
          const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
          if (!uploadRes.ok) throw new Error("Cloudflare upload failed");
          cloudflareVideoId = uid;
        } else {
          const ext = fileToUpload.name.split(".").pop();
          const filePath = `${user.id}/${selectedCourse.id}/${clip.holeNumber}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("tour-it-photos")
            .upload(filePath, fileToUpload, { cacheControl: "3600", upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(filePath);
          mediaUrl = publicUrl;
        }

        // Find or create Hole row
        let holeId: string | null = null;
        const { data: holeData } = await supabase
          .from("Hole").select("id")
          .eq("courseId", selectedCourse.id)
          .eq("holeNumber", clip.holeNumber!)
          .maybeSingle();

        if (holeData?.id) {
          holeId = holeData.id;
        } else {
          const newHoleId = crypto.randomUUID();
          const now = new Date().toISOString();
          await supabase.from("Hole").insert({
            id: newHoleId, courseId: selectedCourse.id, holeNumber: clip.holeNumber,
            par: 0, uploadCount: 0, createdAt: now, updatedAt: now,
          });
          holeId = newHoleId;
        }

        const uploadId = crypto.randomUUID();
        const now = new Date().toISOString();

        await supabase.from("Upload").insert({
          id: uploadId, userId: user.id, courseId: selectedCourse.id, holeId,
          mediaType: isVideo ? "VIDEO" : "PHOTO", mediaUrl, cloudflareVideoId,
          teeBoxId: null, shotType: clip.shotType, yardageOverlay: null,
          clubUsed: clip.clubUsed.trim() || null,
          windCondition: clip.windCondition || null,
          strategyNote: clip.strategyNote.trim() || null,
          landingZoneNote: null, whatCameraDoesntShow: null, handicapRange: null,
          datePlayedAt: new Date(clip.file.lastModified).toISOString(),
          rankScore: 0, tripId: null, tripPublic: true,
          moderationStatus: "APPROVED", likeCount: 0, commentCount: 0,
          viewCount: 0, saveCount: 0, createdAt: now, updatedAt: now,
        });

        // Auto-link to round
        const roundDate = new Date(clip.file.lastModified).toISOString().split("T")[0];
        const { data: existingRound } = await supabase.from("Round").select("id").eq("userId", user.id).eq("courseId", selectedCourse.id).eq("date", roundDate).single();
        if (existingRound) {
          await supabase.from("Upload").update({ roundId: existingRound.id }).eq("id", uploadId);
        } else {
          const newRoundId = crypto.randomUUID();
          await supabase.from("Round").insert({ id: newRoundId, userId: user.id, courseId: selectedCourse.id, date: roundDate, createdAt: now, updatedAt: now });
          await supabase.from("Upload").update({ roundId: newRoundId }).eq("id", uploadId);
        }

        // Increment counters
        const { data: cRow } = await supabase.from("Course").select("uploadCount").eq("id", selectedCourse.id).single();
        await supabase.from("Course").update({ uploadCount: (cRow?.uploadCount || 0) + 1 }).eq("id", selectedCourse.id);
        const { data: uRow } = await supabase.from("User").select("uploadCount").eq("id", user.id).single();
        await supabase.from("User").update({ uploadCount: (uRow?.uploadCount || 0) + 1 }).eq("id", user.id);
        let isFirstForHole = false;
        if (holeId) {
          const { data: hRow } = await supabase.from("Hole").select("uploadCount").eq("id", holeId).single();
          await supabase.from("Hole").update({ uploadCount: (hRow?.uploadCount || 0) + 1 }).eq("id", holeId);
          isFirstForHole = (hRow?.uploadCount || 0) === 0;
        }

        // Award points (fire-and-forget — don't block the upload flow)
        const awardFetch = (action: string, refId = uploadId) => fetch("/api/points/award", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, referenceId: refId }),
        }).catch(() => {});
        awardFetch("upload_clip");
        if ((cRow?.uploadCount || 0) === 0) awardFetch("upload_first_for_course");
        if (isFirstForHole) awardFetch("upload_first_for_hole");
        // Intel awards
        const hasClub  = !!clip.clubUsed.trim();
        const hasWind  = !!clip.windCondition;
        const hasNote  = clip.strategyNote.trim().length >= 30;
        if (hasClub) awardFetch("add_club_to_clip");
        if (hasWind) awardFetch("add_wind_to_clip");
        if (hasNote) awardFetch("add_strategy_note");
        if (hasClub && hasWind && hasNote) awardFetch("intel_complete_bonus");

        // Tags + notifications
        if (clip.taggedUsers.length > 0) {
          const notifNow = new Date().toISOString();
          await Promise.all([
            supabase.from("UploadTag").insert(
              clip.taggedUsers.map(u => ({
                id: crypto.randomUUID(), uploadId, userId: u.id, createdAt: notifNow,
              }))
            ),
            supabase.from("Notification").insert(
              clip.taggedUsers.map(u => ({
                id: crypto.randomUUID(),
                userId: u.id,
                type: "clip_tag",
                title: `${taggerName} tagged you in a clip`,
                body: `${selectedCourse.name} · Hole ${clip.holeNumber}`,
                linkUrl: `/courses/${selectedCourse.id}`,
                referenceId: uploadId,
                read: false,
                createdAt: notifNow,
                updatedAt: notifNow,
              }))
            ),
          ]);
          clip.taggedUsers.forEach(u => sendPushToUser(u.id, `${taggerName} tagged you in a clip`, `${selectedCourse.name} · Hole ${clip.holeNumber}`, `/courses/${selectedCourse.id}`));
        }

        done++;
        setDoneCount(done);
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "done" } : c));
      } catch (err: any) {
        setClips(prev => prev.map(c => c.id === clip.id ? { ...c, status: "error", errorMsg: err?.message || "Upload failed" } : c));
      }
    }

    // Notify followers once after all clips done (fire-and-forget)
    ;(async () => {
      const { data: followers } = await supabase.from("Follow").select("followerId").eq("followingId", user.id).eq("status", "ACTIVE");
      if (!followers?.length) return;
      const uploaderName = taggerName;
      const clipCount = done;
      const courseLink = `/courses/${selectedCourse.id}`;
      const body = `${uploaderName} posted ${clipCount} clip${clipCount > 1 ? "s" : ""} at ${selectedCourse.name}`;
      const now = new Date().toISOString();
      await supabase.from("Notification").insert(
        followers.map((f: { followerId: string }) => ({
          id: crypto.randomUUID(),
          userId: f.followerId,
          type: "new_clip",
          title: "New clips",
          body,
          linkUrl: courseLink,
          read: false,
          createdAt: now,
          updatedAt: now,
        }))
      );
      followers.forEach((f: { followerId: string }) => sendPushToUser(f.followerId, "New clips", body, courseLink));
    })();

    setUploading(false);
    setAllDone(true);
  }

  const assignedCount = clips.filter(c => c.holeNumber !== null).length;
  const compressingCount = clips.filter(c => c.status === "compressing").length;

  if (allDone) {
    return (
      <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          {doneCount} clip{doneCount !== 1 ? "s" : ""} uploaded
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
          All done. They'll appear on the course page shortly.
        </div>
        <button
          onClick={() => router.push(`/courses/${selectedCourse?.id}`)}
          style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", marginBottom: 12 }}
        >
          View course
        </button>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
        >
          Upload more
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", paddingBottom: 120 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@400;500;600&display=swap');
        .batch-hole-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); cursor: pointer; flex-shrink: 0; }
        .batch-hole-btn.active { background: rgba(77,168,98,0.2); border-color: rgba(77,168,98,0.6); color: #4da862; }
        .batch-hole-btn:disabled { opacity: 0.35; cursor: default; }
        .batch-shot-btn { padding: 5px 11px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .batch-shot-btn.active { background: rgba(77,168,98,0.2); border-color: rgba(77,168,98,0.6); color: #4da862; }
        .batch-shot-btn:disabled { opacity: 0.35; cursor: default; }
        .shot-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .shot-row::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "52px 20px 16px", borderBottom: "1px solid rgba(77,168,98,0.1)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>
            {clips.length} clips selected
          </h1>
          {compressingCount > 0 && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.7)", marginTop: 2 }}>
              Compressing {compressingCount} in background…
            </div>
          )}
        </div>
      </div>

      {/* Duplicate removal notice */}
      {dupeCount > 0 && (
        <div style={{ margin: "10px 20px 0", padding: "8px 12px", background: "rgba(255,190,50,0.08)", border: "1px solid rgba(255,190,50,0.2)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,190,50,0.9)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{dupeCount} duplicate{dupeCount > 1 ? "s" : ""} removed</span>
          <button onClick={() => setDupeCount(0)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,190,50,0.6)", fontSize: 14, padding: "0 0 0 8px" }}>✕</button>
        </div>
      )}

      {/* Course selector */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {selectedCourse ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Course</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{selectedCourse.name}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[selectedCourse.city, selectedCourse.state].filter(Boolean).join(", ")}</div>
            </div>
            <button onClick={() => { setSelectedCourse(null); setCourseSearch(""); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              Change
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Which course?</div>
            <input
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              placeholder="Search by name, city, or state…"
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(77,168,98,0.3)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }}
            />
            {courseLoading && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>Searching…</div>}
            {courseResults.map(c => (
              <button key={c.id} onClick={() => { setSelectedCourse(c); setCourseSearch(""); setCourseResults([]); }}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", marginTop: 6, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clip cards */}
      <div style={{ padding: "12px 20px" }}>
        {clips.map((clip, idx) => (
          <div key={clip.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 12, padding: "14px 14px 12px" }}>

              {/* Thumbnail */}
              <div style={{ width: 72, height: 108, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#0a1e10", position: "relative" }}>
                {clip.thumbnail ? (
                  <img src={clip.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={`Clip ${idx + 1}`} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.3)", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
                {/* Status overlay */}
                {clip.status === "done" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(45,122,66,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                {clip.status === "uploading" && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
                {/* Clip number badge */}
                {clip.status !== "done" && clip.status !== "uploading" && (
                  <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.6)", borderRadius: 5, padding: "2px 6px" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{idx + 1}</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* File size + compression status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {(clip.file.size / 1048576).toFixed(0)} MB
                  </span>
                  {clip.status === "compressing" && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.8)" }}>
                      {clip.compressPct > 0 ? `Compressing ${clip.compressPct}%` : "Compressing…"}
                    </span>
                  )}
                  {clip.status === "error" && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#e05c5c" }}>Failed</span>
                  )}
                </div>

                {/* Hole picker */}
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>Hole</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      className={`batch-hole-btn${clip.holeNumber === n ? " active" : ""}`}
                      onClick={() => updateClip(clip.id, { holeNumber: n })}
                      disabled={clip.status === "uploading" || clip.status === "done"}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* Shot type */}
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>Shot type</div>
                <div className="shot-row">
                  {SHOT_TYPES.map(s => (
                    <button
                      key={s.value}
                      className={`batch-shot-btn${clip.shotType === s.value ? " active" : ""}`}
                      onClick={() => updateClip(clip.id, { shotType: s.value })}
                      disabled={clip.status === "uploading" || clip.status === "done"}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Intel fields */}
            {clip.status !== "done" && (
              <div style={{ padding: "0 14px 10px" }}>
                {clip.showIntel ? (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(77,168,98,0.7)" }}>Intel +pts</span>
                      <button onClick={() => updateClip(clip.id, { showIntel: false })} style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: 0 }}>Done</button>
                    </div>
                    <input
                      value={clip.clubUsed}
                      onChange={e => updateClip(clip.id, { clubUsed: e.target.value })}
                      placeholder="Club used (e.g. 7 iron)"
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", outline: "none", boxSizing: "border-box", marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                      {WIND_OPTIONS.map(w => (
                        <button key={w.value} onClick={() => updateClip(clip.id, { windCondition: clip.windCondition === w.value ? "" : w.value })}
                          style={{ padding: "4px 9px", borderRadius: 99, border: `1px solid ${clip.windCondition === w.value ? "rgba(77,168,98,0.6)" : "rgba(255,255,255,0.1)"}`, background: clip.windCondition === w.value ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.04)", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: clip.windCondition === w.value ? "#4da862" : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                          {w.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={clip.strategyNote}
                      onChange={e => updateClip(clip.id, { strategyNote: e.target.value })}
                      placeholder="Strategy note (30+ chars for bonus)"
                      rows={2}
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", outline: "none", boxSizing: "border-box", resize: "none" }}
                    />
                    {clip.strategyNote.trim().length > 0 && clip.strategyNote.trim().length < 30 && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                        {30 - clip.strategyNote.trim().length} more chars for +5 pts
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => updateClip(clip.id, { showIntel: true })}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "6px 0 0" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.5)" }}>Add intel (+20 pts)</span>
                  </button>
                )}
              </div>
            )}

            {/* Compression progress bar */}
            {clip.status === "compressing" && (
              <div style={{ padding: "0 14px 4px" }}>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${clip.compressPct || 6}%`, background: "#4da862", borderRadius: 99, transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}

            {/* Tagging section */}
            {clip.status !== "done" && (
              <div style={{ padding: "8px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Tagged users */}
                {clip.taggedUsers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {clip.taggedUsers.map(u => (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "3px 8px 3px 5px" }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          }
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862" }}>@{u.username}</span>
                        <button onClick={() => removeTag(clip.id, u.id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", marginLeft: 1 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tag input (expanded) */}
                {tagClipId === clip.id ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        autoFocus
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        placeholder="Search username…"
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 8, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", outline: "none" }}
                      />
                      <button onClick={() => { setTagClipId(null); setTagInput(""); setTagResults([]); }}
                        style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "0 4px" }}>
                        Done
                      </button>
                    </div>
                    {tagResults.length > 0 && (
                      <div style={{ marginTop: 6, background: "rgba(0,0,0,0.3)", borderRadius: 8, overflow: "hidden" }}>
                        {tagResults.map(u => (
                          <button key={u.id} onClick={() => addTag(clip.id, u)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {u.avatarUrl
                                ? <img src={u.avatarUrl} alt={u.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              }
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                              {u.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{u.displayName}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setTagClipId(clip.id); setTagInput(""); setTagResults([]); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.6)" }}>Tag a player</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky footer */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px 36px", background: "linear-gradient(to top, rgba(7,16,10,0.98) 0%, rgba(7,16,10,0.7) 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {!selectedCourse && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 10 }}>
            Select a course to continue
          </div>
        )}
        {selectedCourse && assignedCount < clips.length && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 10 }}>
            {clips.length - assignedCount} clip{clips.length - assignedCount !== 1 ? "s" : ""} still need a hole number
          </div>
        )}
        {compressingCount > 0 && !uploading && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(77,168,98,0.7)", textAlign: "center", marginBottom: 8 }}>
            {compressingCount} clip{compressingCount !== 1 ? "s" : ""} still compressing — you can upload now, they'll wait their turn
          </div>
        )}
        <button
          onClick={uploadAll}
          disabled={!selectedCourse || assignedCount === 0 || uploading}
          style={{
            width: "100%",
            background: !selectedCourse || assignedCount === 0 ? "rgba(77,168,98,0.15)" : "#2d7a42",
            border: "none", borderRadius: 14, padding: "16px",
            fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600,
            color: !selectedCourse || assignedCount === 0 ? "rgba(255,255,255,0.25)" : "#fff",
            cursor: !selectedCourse || assignedCount === 0 || uploading ? "not-allowed" : "pointer",
            boxShadow: selectedCourse && assignedCount > 0 ? "0 2px 16px rgba(45,122,66,0.4)" : "none",
          }}
        >
          {uploading
            ? `Uploading ${doneCount + 1} of ${assignedCount}…`
            : assignedCount === 0
            ? "Assign holes to upload"
            : `Upload ${assignedCount} clip${assignedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

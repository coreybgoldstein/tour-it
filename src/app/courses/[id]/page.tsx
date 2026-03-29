"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";
import { useSave } from "@/hooks/useSave";
import { GolfBallBadge } from "@/components/GolfBallBadge";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  holeCount: number;
  isPublic: boolean;
  uploadCount: number;
  description: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
};

type Clip = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  shotType: string | null;
  clubUsed: string | null;
  strategyNote: string | null;
  landingZoneNote: string | null;
  whatCameraDoesntShow: string | null;
  windCondition: string | null;
  datePlayedAt: string | null;
  rankScore: number;
  holeId: string | null;
  courseId: string;
  likeCount: number;
  holeNumber?: number;
  seriesId?: string | null;
  courseName?: string;
  isForeign?: boolean;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

const COURSE_HEROES: Record<string, { gradient: string; description: string; designer?: string; year?: number }> = {
  "kiawah": {
    gradient: "linear-gradient(160deg, #1a4a2e 0%, #0d3320 30%, #082818 60%, #041a10 100%)",
    description: "Pete Dye's coastal masterpiece on a barrier island. 10 holes within view of the Atlantic. Host of the 1991 Ryder Cup and 2021 PGA Championship.",
    designer: "Pete Dye",
    year: 1991,
  },
  "bethpage": {
    gradient: "linear-gradient(160deg, #162e12 0%, #0e2010 40%, #071508 100%)",
    description: "A public golf mecca on Long Island. The Black Course is one of the most demanding tracks in America — host of two US Opens.",
    designer: "A.W. Tillinghast",
    year: 1936,
  },
  "pebble": {
    gradient: "linear-gradient(160deg, #0a2a3a 0%, #0d3020 40%, #071510 100%)",
    description: "Arguably the finest meeting of land and sea in golf. Eight holes border the Pacific on the Monterey Peninsula.",
    designer: "Jack Neville",
    year: 1919,
  },
  "default": {
    gradient: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 50%, #071208 100%)",
    description: "",
  },
};

function getCourseHero(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("kiawah")) return COURSE_HEROES["kiawah"];
  if (lower.includes("bethpage")) return COURSE_HEROES["bethpage"];
  if (lower.includes("pebble")) return COURSE_HEROES["pebble"];
  return COURSE_HEROES["default"];
}

function FeedCard({ clip, isActive, onTapHole, onTapCourse }: {
  clip: Clip; isActive: boolean; onTapHole: () => void; onTapCourse: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
const { liked, likeCount, toggleLike } = useLike({
  uploadId: clip.id,
  initialLikeCount: clip.likeCount || 0,
});

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#07100a", flexShrink: 0 }}>
      {clip.mediaType === "VIDEO" ? (
        <video ref={videoRef} src={clip.mediaUrl} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.92) 100%)", pointerEvents: "none" }} />

      {clip.isForeign && (
        <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(180,145,60,0.85)", borderRadius: 99, padding: "5px 14px", fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#fff" }}>
            From {clip.courseName}
          </div>
        </div>
      )}

      {clip.mediaType === "VIDEO" && (
        <button onClick={() => setMuted(m => !m)} style={{ position: "absolute", bottom: 170, left: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}>
          {muted
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          }
        </button>
      )}

      {/* Right panel — smaller, centered icons */}
      <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", zIndex: 5 }}>
        <button onClick={toggleLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: `1.5px solid ${liked ? "rgba(77,168,98,0.7)" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <span style={{ fontSize: 9, color: liked ? "#4da862" : "rgba(255,255,255,0.55)", fontFamily: "'Outfit', sans-serif" }}>{likeCount}</span>
        </button>

        {clip.isForeign ? (
          <button onClick={onTapCourse} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M2 10 L12 3 L22 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="10" width="16" height="11" rx="1" stroke="white" strokeWidth="1.8" fill="none"/><rect x="6" y="13" width="3" height="3" rx="0.5" stroke="white" strokeWidth="1.4" fill="none"/><rect x="15" y="13" width="3" height="3" rx="0.5" stroke="white" strokeWidth="1.4" fill="none"/><path d="M10 21 L10 17 Q12 15.5 14 17 L14 21" stroke="white" strokeWidth="1.4" fill="none" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: "'Outfit', sans-serif" }}>Course</span>
          </button>
        ) : (
          <button onClick={onTapHole} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><line x1="12" y1="3" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M12 3 L20 7 L12 11 Z" fill="white"/><ellipse cx="12" cy="21" rx="4" ry="1.2" stroke="white" strokeWidth="1.5" fill="none"/></svg>
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: "'Outfit', sans-serif" }}>Hole</span>
          </button>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 16px 70px", zIndex: 5, pointerEvents: "none" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4, lineHeight: 1.2 }}>
          {clip.isForeign ? clip.courseName : clip.holeNumber ? `Hole ${clip.holeNumber}` : "Course clip"}
        </div>
        {clip.strategyNote && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.5 }}>
            {clip.strategyNote}
          </div>
        )}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {clip.shotType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "2px 9px" }}>{SHOT_LABEL[clip.shotType] || clip.shotType}</span>}
          {clip.clubUsed && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "2px 9px" }}>{clip.clubUsed}</span>}
        </div>
      </div>
    </div>
  );
}

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseClips, setCourseClips] = useState<Clip[]>([]);
  const [feedClips, setFeedClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [holes, setHoles] = useState<{ holeNumber: number; par: number; handicapRank: number }[]>([]);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeSuccess, setContributeSuccess] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { saved, saveType, toggleSave, showPicker, setShowPicker } = useSave({ courseId: id as string });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber, par, handicapRank").eq("courseId", id).order("holeNumber", { ascending: true });
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });
      if (holesData) setHoles(holesData.map((h: any) => ({ holeNumber: h.holeNumber, par: h.par || 4, handicapRank: h.handicapRank || h.holeNumber })));

      const { data: uploads } = await supabase
        .from("Upload").select("*").eq("courseId", id).order("rankScore", { ascending: false });

      const clips: Clip[] = (uploads || []).map((u: any) => ({
        ...u,
        holeNumber: u.holeId ? holeMap[u.holeId] : undefined,
        courseName: courseData?.name,
        isForeign: false,
        likeCount: u.likeCount || 0,
      }));

      setCourseClips(clips);

      let feed = [...clips];
      const { data: otherUploads } = await supabase
        .from("Upload").select("*").neq("courseId", id).order("rankScore", { ascending: false }).limit(20);

      if (otherUploads && otherUploads.length > 0) {
        const otherCourseIds = [...new Set(otherUploads.map((u: any) => u.courseId))];
        const { data: otherCourses } = await supabase.from("Course").select("id, name").in("id", otherCourseIds);
        const foreign: Clip[] = otherUploads.map((u: any) => ({
          ...u,
          courseName: otherCourses?.find((c: any) => c.id === u.courseId)?.name || "Unknown",
          isForeign: true,
          likeCount: u.likeCount || 0,
        }));
        feed = [...clips, ...foreign];
      }

      setFeedClips(feed);
      setLoading(false);
    }

    loadData();
  }, [id]);

  useEffect(() => {
    if (feedOpen && feedRef.current) {
      feedRef.current.scrollTop = feedStartIndex * window.innerHeight;
      setActiveIndex(feedStartIndex);
    }
  }, [feedOpen, feedStartIndex]);

  const openContribute = useCallback(() => {
    if (!course) return;
    setEditDescription(course.description || "");
    setCoverFile(null);
    setCoverPreview(null);
    setLogoFile(null);
    setLogoPreview(null);
    setContributeSuccess(false);
    setContributeOpen(true);
  }, [course]);

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleContributeSubmit = async () => {
    setContributeError(null);

    if (!user) {
      setContributeError("You need to be logged in to submit updates. Sign in and try again.");
      return;
    }

    const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
    if (coverFile && coverFile.size > MAX_BYTES) {
      setContributeError(`Cover photo is too large (${(coverFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB and try again.`);
      return;
    }
    if (logoFile && logoFile.size > MAX_BYTES) {
      setContributeError(`Logo file is too large (${(logoFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB and try again.`);
      return;
    }

    setContributing(true);
    const supabase = createClient();
    const updates: Record<string, string> = {};

    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `covers/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, coverFile, { upsert: true });
      if (upErr) {
        setContributing(false);
        setContributeError(`Cover photo upload failed: ${upErr.message}`);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      updates.coverImageUrl = publicUrl;
    }

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `logos/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, logoFile, { upsert: true });
      if (upErr) {
        setContributing(false);
        setContributeError(`Logo upload failed: ${upErr.message}`);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      updates.logoUrl = publicUrl;
    }

    if (editDescription.trim()) updates.description = editDescription.trim();

    if (Object.keys(updates).length > 0) {
      const { error: dbErr } = await supabase.from("Course").update(updates).eq("id", id as string);
      if (dbErr) {
        setContributing(false);
        setContributeError(`Failed to save: ${dbErr.message}`);
        return;
      }
      setCourse(prev => prev ? { ...prev, ...updates } : prev);
      if (updates.coverImageUrl) setCoverPreview(null);
    }

    setContributing(false);
    setContributeSuccess(true);
  };

  const handleFeedScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = feedRef.current;
      if (!el) return;
      setActiveIndex(Math.round(el.scrollTop / window.innerHeight));
    }, 50);
  }, []);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (!course) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", cursor: "pointer" }}>Back to Search</button>
      </main>
    );
  }

  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  const hero = getCourseHero(course.name);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .feed-modal { position: fixed; inset: 0; z-index: 100; background: #000; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed-modal::-webkit-scrollbar { display: none; }
        .feed-snap { scroll-snap-align: start; scroll-snap-stop: always; }
        .clip-thumb { position: relative; aspect-ratio: 9/16; border-radius: 10px; overflow: hidden; background: #0d2318; cursor: pointer; transition: opacity 0.15s; }
        .clip-thumb:hover { opacity: 0.85; }
        .clip-thumb video, .clip-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", width: "100%", height: 300 }}>
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : courseClips.find(c => c.mediaType === "PHOTO") ? (
          <img src={courseClips.find(c => c.mediaType === "PHOTO")!.mediaUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: hero.gradient }} />
        )}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,16,10,1) 0%, rgba(7,16,10,0.5) 45%, rgba(0,0,0,0.15) 100%)" }} />

        {/* Top left: back button + course logo badge */}
        <div style={{ position: "absolute", top: 52, left: 16, display: "flex", alignItems: "center", gap: 8, zIndex: 10 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          {/* Course logo */}
          <div style={{ width: 68, height: 42, borderRadius: 10, background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {course.logoUrl ? (
              <img
                src={course.logoUrl}
                alt={course.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
              />
            ) : null}
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", display: course.logoUrl ? "none" : "inline" }}>{abbr}</span>
          </div>
        </div>


        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 18px", zIndex: 10 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {[course.city, course.state].filter(s => s?.trim()).join(", ")}
            {course.city || course.state ? " · " : ""}{course.isPublic ? "Public" : "Private"}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 12, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {course.name}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "4px 12px" }}>
              {course.holeCount || 18} holes
            </span>
            {hero.year && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "4px 12px" }}>
                Est. {hero.year}
              </span>
            )}
            {(course.description || hero.description) && (
              <button
                onClick={() => setAboutOpen(true)}
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                About
              </button>
            )}
          </div>
        </div>
      </div>

{/* Action bar */}
<div style={{ padding: "14px 20px 16px", display: "flex", gap: 8, position: "relative" }}>
  <button
    onClick={() => router.push(`/courses/${id}/holes`)}
    style={{ flex: 1, background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M12 2 L19 6 L12 10 Z" fill="white"/><ellipse cx="12" cy="21" rx="3.5" ry="1" stroke="white" strokeWidth="1.5" fill="none"/></svg>
    Holes
  </button>
  <button
    onClick={() => setScorecardOpen(true)}
    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>
    Scorecard
  </button>
  <button
    onClick={() => setShowPicker(!showPicker)}
    style={{ background: saved ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${saved ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "#4da862" : "none"} stroke={saved ? "#4da862" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
  </button>
  <button
    onClick={() => router.push(`/upload?courseId=${id}`)}
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  </button>
  <button
    onClick={openContribute}
    title="Suggest a cover photo or edit course info"
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  </button>

  {/* Save picker dropdown */}
  {showPicker && (
    <div style={{ position: "absolute", top: "100%", right: 60, marginTop: 4, background: "rgba(13,35,24,0.98)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 12, padding: 6, zIndex: 50, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <button
        onClick={() => toggleSave("PLAYED")}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "PLAYED" ? "rgba(77,168,98,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 16 }}>✓</span>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "PLAYED" ? "#4da862" : "#fff" }}>Played</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I've played this course</div>
        </div>
      </button>
      <button
        onClick={() => toggleSave("BUCKET_LIST")}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "BUCKET_LIST" ? "rgba(77,168,98,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", marginTop: 2 }}
      >
        <span style={{ fontSize: 16 }}>⛳</span>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "BUCKET_LIST" ? "#4da862" : "#fff" }}>Bucket List</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I want to play this</div>
        </div>
      </button>
    </div>
  )}
</div>

      {/* 3-column vertical clip grid */}
      <div style={{ padding: "0 16px 100px" }}>
        {courseClips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 24 }}>Be the first to scout {course.name}</div>
            <button
              onClick={() => router.push(`/upload?courseId=${id}`)}
              style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
            >
              Upload a clip
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>
              Scouting clips
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {courseClips.map((clip, i) => (
                <div key={clip.id} className="clip-thumb" onClick={() => { setFeedStartIndex(i); setFeedOpen(true); }}>
                  {clip.mediaType === "VIDEO" ? (
                    <video src={clip.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.1; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />
                  {clip.mediaType === "VIDEO" && (
                    <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                  {(clip.holeNumber || clip.seriesId) && (
                    <div style={{ position: "absolute", bottom: 5, right: 5 }}>
                      <GolfBallBadge
                        label={(!clip.holeNumber || clip.seriesId) ? "+" : clip.holeNumber}
                        isGold={!clip.holeNumber || !!clip.seriesId}
                        id={clip.id}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

{/* Contribute link */}

{/* About modal */}
      {aboutOpen && (
        <div onClick={() => setAboutOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 24px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{course.name}</div>
            {(hero.designer || hero.year) && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                {hero.designer ? `Designed by ${hero.designer}` : ""}{hero.designer && hero.year ? " · " : ""}{hero.year ? `Est. ${hero.year}` : ""}
              </div>
            )}
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              {course.description || hero.description}
            </p>
            <button onClick={() => setAboutOpen(false)} style={{ marginTop: 24, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Scorecard modal */}
      {scorecardOpen && (
        <div onClick={() => setScorecardOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Scorecard</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>{course.name}</div>

            {[{ label: "Front 9", start: 0, end: 9 }, { label: "Back 9", start: 9, end: 18 }].map(({ label, start, end }) => {
              const nine = holes.slice(start, end);
              if (nine.length === 0) return null;
              const total = nine.reduce((s, h) => s + h.par, 0);
              return (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{label}</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {/* Hole row */}
                    <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ width: 44, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Hole</div>
                      {nine.map(h => (
                        <div key={h.holeNumber} style={{ flex: 1, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{h.holeNumber}</div>
                      ))}
                      <div style={{ width: 36, padding: "8px 6px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Out</div>
                    </div>
                    {/* Par row */}
                    <div style={{ display: "flex" }}>
                      <div style={{ width: 44, padding: "9px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Par</div>
                      {nine.map(h => (
                        <div key={h.holeNumber} style={{ flex: 1, padding: "9px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: h.par === 3 ? "#6bcf7f" : h.par === 5 ? "#f0c55a" : "#fff" }}>{h.par}</div>
                      ))}
                      <div style={{ width: 36, padding: "9px 6px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862", flexShrink: 0 }}>{total}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total */}
            {holes.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "rgba(77,168,98,0.1)", borderRadius: 12, border: "1px solid rgba(77,168,98,0.2)", marginTop: 4 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Par</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#4da862" }}>{holes.reduce((s, h) => s + h.par, 0)}</span>
              </div>
            )}

            <button onClick={() => setScorecardOpen(false)} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Contribute modal */}
      {contributeOpen && (
        <div onClick={() => setContributeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Contribute</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Help keep {course.name} accurate and beautiful</div>

            {contributeSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: "#4da862", marginBottom: 6 }}>Thanks for contributing!</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Your updates are live.</div>
                <button onClick={() => setContributeOpen(false)} style={{ marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                {/* Cover photo */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Cover Photo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: "100%", height: 140, borderRadius: 12, border: "1.5px dashed rgba(77,168,98,0.4)", background: "rgba(77,168,98,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                      {coverPreview ? (
                        <img src={coverPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : course.coverImageUrl ? (
                        <img src={course.coverImageUrl} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(77,168,98,0.7)" }}>Tap to upload a beauty shot</div>
                        </div>
                      )}
                      {coverPreview && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 99 }}>Change</span></div>}
                    </div>
                    <input type="file" accept="image/*" onChange={handleCoverPick} style={{ display: "none" }} />
                  </label>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Description</div>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Add a short description of what makes this course special..."
                    rows={3}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", resize: "none", outline: "none" }}
                  />
                </div>

                {/* Course Logo upload */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Logo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: 120, height: 72, borderRadius: 12, border: "1.5px dashed rgba(77,168,98,0.4)", background: "rgba(77,168,98,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} />
                      ) : course.logoUrl ? (
                        <img src={course.logoUrl} alt="current logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, opacity: 0.5 }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoPick} style={{ display: "none" }} />
                  </label>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>Tap the square to upload a logo image</div>
                </div>

                {contributeError && (
                  <div style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)", lineHeight: 1.5 }}>
                    {contributeError}
                  </div>
                )}
                <button onClick={handleContributeSubmit} disabled={contributing} style={{ width: "100%", background: contributing ? "rgba(45,122,66,0.5)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: contributing ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}>
                  {contributing ? "Saving..." : "Submit Updates"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

{/* Full-screen feed modal */}
      {feedOpen && (
        <div className="feed-modal" ref={feedRef} onScroll={handleFeedScroll}>
          <button onClick={() => setFeedOpen(false)} style={{ position: "fixed", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 110 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          {feedClips.map((clip, i) => (
            <div key={clip.id} className="feed-snap">
              <FeedCard
                clip={clip}
                isActive={i === activeIndex}
                onTapHole={() => { setFeedOpen(false); if (clip.holeNumber) router.push(`/courses/${id}/holes/${clip.holeNumber}`); else router.push(`/courses/${id}/holes`); }}
                onTapCourse={() => { setFeedOpen(false); router.push(`/courses/${clip.courseId}`); }}
              />
            </div>
          ))}
        </div>
            )}
      <BottomNav />
    </main>
  );
}

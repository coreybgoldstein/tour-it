"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  courseName?: string;
  isForeign?: boolean;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

// Course-specific hero configs — add real photos here as you get them
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

// Full-screen feed card
function FeedCard({ clip, isActive, onTapHole, onTapCourse }: {
  clip: Clip; isActive: boolean; onTapHole: () => void; onTapCourse: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.likeCount || 0);

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

            <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", zIndex: 5 }}>
        <button onClick={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
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
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber").eq("courseId", id);
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });

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

      // Build feed: course clips + discovery fill
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

      {/* Hero — full-width course image */}
      <div style={{ position: "relative", width: "100%", height: 300 }}>
        {/* Course image — use coverImageUrl if available, else gradient */}
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: hero.gradient }} />
        )}

        {/* Texture overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

        {/* Dark gradient for text legibility */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,16,10,1) 0%, rgba(7,16,10,0.5) 45%, rgba(0,0,0,0.15) 100%)" }} />

        {/* Back button */}
        <button onClick={() => router.back()} style={{ position: "absolute", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        {/* Course abbr badge */}
        <div style={{ position: "absolute", top: 52, right: 16, width: 42, height: 42, borderRadius: 10, background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", zIndex: 10 }}>
          {abbr}
        </div>

        {/* Course info */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 18px", zIndex: 10 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {course.city}, {course.state} · {course.isPublic ? "Public" : "Private"}
            {hero.designer ? ` · ${hero.designer}` : ""}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 8 }}>
            {course.name}
          </div>

          {/* Description — show hero description for known courses */}
          {(course.description || hero.description) && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 10, maxWidth: 340 }}>
              {course.description || hero.description}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "3px 10px" }}>
              {course.holeCount || 18} holes
            </span>
            
            {hero.year && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "3px 10px" }}>
                Est. {hero.year}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: "14px 20px 16px", display: "flex", gap: 8 }}>
        <button
          onClick={() => router.push(`/courses/${id}/holes`)}
          style={{ flex: 1, background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="12" y1="2" x2="12" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M12 2 L19 6 L12 10 Z" fill="white"/><ellipse cx="12" cy="21" rx="3.5" ry="1" stroke="white" strokeWidth="1.5" fill="none"/></svg>
          Browse by hole
        </button>
        <button
          onClick={() => router.push(`/upload?courseId=${id}`)}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload
        </button>
      </div>

      {/* 3-column vertical clip grid — course clips only */}
      <div style={{ padding: "0 16px 100px" }}>
        {courseClips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 24 }}>Be the first to scout {course.name}</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              Upload a clip
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>
              Scouting clips
            </div>
            {/* 3-column grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {courseClips.map((clip, i) => (
                <div key={clip.id} className="clip-thumb" onClick={() => { setFeedStartIndex(i); setFeedOpen(true); }}>
                  {clip.mediaType === "VIDEO" ? (
                    <video src={clip.mediaUrl} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}

                  {/* Dark gradient */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />

                  {/* Play icon for videos */}
                  {clip.mediaType === "VIDEO" && (
                    <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}

                  {/* Hole number only */}
                  <div style={{ position: "absolute", bottom: 5, left: 6, right: 6 }}>
                    {clip.holeNumber && (
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 700, color: "#fff", background: "rgba(77,168,98,0.9)", borderRadius: 99, padding: "1px 6px" }}>
                        Hole {clip.holeNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "rgba(7,16,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { label: "Home", path: "/", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "Search", path: "/search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z" },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
          </button>
        ))}
        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>
        <button onClick={() => router.push("/saved")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Saved</span>
        </button>
        <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
        </button>
      </nav>

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
    </main>
  );
}

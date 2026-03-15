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
  websiteUrl: string | null;
};

type Upload = {
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
};

type DiscoveryClip = Upload & {
  holeNumber?: number;
  courseName?: string;
  courseCity?: string;
  courseState?: string;
  isForeign?: boolean;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [clips, setClips] = useState<DiscoveryClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCourseHeader, setShowCourseHeader] = useState(true);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    const loadData = async () => {
      // Load course
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      // Load holes for this course to get hole numbers
      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber").eq("courseId", id);
      const holeMap: Record<string, number> = {};
      holesData?.forEach(h => { holeMap[h.id] = h.holeNumber; });

      // Load uploads for this course
      const { data: courseUploads } = await supabase
        .from("Upload")
        .select("*")
        .eq("courseId", id)
        .order("rankScore", { ascending: false });

      const courseClips: DiscoveryClip[] = (courseUploads || []).map(u => ({
        ...u,
        holeNumber: u.holeId ? holeMap[u.holeId] : undefined,
        courseName: courseData?.name,
        courseCity: courseData?.city,
        courseState: courseData?.state,
        isForeign: false,
      }));

      // If fewer than 5 clips, load discovery clips from other courses
      let allClips = [...courseClips];
      if (courseClips.length < 10) {
        const { data: otherUploads } = await supabase
          .from("Upload")
          .select("*, Course:courseId(id, name, city, state)")
          .neq("courseId", id)
          .order("rankScore", { ascending: false })
          .limit(20);

        const foreignClips: DiscoveryClip[] = (otherUploads || []).map((u: any) => ({
          ...u,
          courseName: u.Course?.name,
          courseCity: u.Course?.city,
          courseState: u.Course?.state,
          isForeign: true,
        }));
        allClips = [...courseClips, ...foreignClips];
      }

      setClips(allClips);
      setLoading(false);
    };

    loadData();
  }, [id]);

  // Pause all videos except active
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([clipId, videoEl]) => {
      if (!videoEl) return;
      const clipIndex = clips.findIndex(c => c.id === clipId);
      if (clipIndex === activeIndex) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
    setIntelOpen(false);
    // Hide course header after first clip
    if (activeIndex > 0) setShowCourseHeader(false);
  }, [activeIndex, clips]);

  // Touch swipe up/down
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50 && activeIndex < clips.length - 1) {
      setActiveIndex(prev => prev + 1);
    } else if (delta < -50 && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

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

  // No clips state
  if (clips.length === 0) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>{course.name}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 28 }}>Be the first to scout {course.name}</p>
          <button onClick={() => router.push("/upload")} style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Upload a clip</button>
        </div>
      </main>
    );
  }

  const activeClip = clips[activeIndex];
  const hasIntel = activeClip && (activeClip.strategyNote || activeClip.landingZoneNote || activeClip.whatCameraDoesntShow);
  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();

  return (
    <main style={{ height: "100dvh", background: "#000", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .video-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .photo-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

        .gradient-top { position: absolute; top: 0; left: 0; right: 0; height: 200px; background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%); z-index: 10; pointer-events: none; }
        .gradient-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 380px; background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%); z-index: 10; pointer-events: none; }

        .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: flex-start; justify-content: space-between; padding: 52px 20px 16px; z-index: 20; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; }

        .course-header { background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 12px 14px; margin: 0 20px; }
        .course-header-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .course-abbr { width: 36px; height: 36px; border-radius: 9px; background: rgba(77,168,98,0.2); border: 1px solid rgba(77,168,98,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #4da862; flex-shrink: 0; }
        .course-header-name { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 900; color: #fff; }
        .course-header-loc { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 1px; }
        .course-stats-row { display: flex; gap: 8px; }
        .stat-chip { background: rgba(255,255,255,0.08); border-radius: 99px; padding: 4px 10px; font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.5); }
        .stat-chip span { color: rgba(255,255,255,0.8); font-weight: 600; }
        .browse-holes-btn { width: 100%; background: rgba(77,168,98,0.15); border: 1px solid rgba(77,168,98,0.3); border-radius: 10px; padding: 9px; margin-top: 10px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600; color: #4da862; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }

        .right-actions { position: absolute; right: 16px; bottom: 220px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 20; }
        .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .action-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; }
        .action-label { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(255,255,255,0.6); }

        .swipe-hint { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 20; display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0.4; }

        .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 20px 36px; z-index: 20; }
        .hole-line { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; }

        .foreign-banner { background: rgba(180,145,60,0.15); border: 1px solid rgba(180,145,60,0.3); border-radius: 10px; padding: 8px 12px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
        .foreign-banner-text { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(210,175,80,0.9); }
        .foreign-banner-btn { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(210,175,80,0.9); background: rgba(180,145,60,0.2); border: 1px solid rgba(180,145,60,0.3); border-radius: 99px; padding: 3px 10px; cursor: pointer; }

        .tags-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .tag { background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); border-radius: 99px; padding: 4px 11px; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.8); }
        .tag.green { border-color: rgba(77,168,98,0.4); color: #4da862; background: rgba(77,168,98,0.15); }

        .intel-toggle-btn { width: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 8px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); }
        .intel-panel { background: rgba(0,0,0,0.6); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px; margin-bottom: 8px; }
        .intel-row { margin-bottom: 12px; }
        .intel-row:last-child { margin-bottom: 0; }
        .intel-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px; }
        .intel-value { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5; }

        .progress-dots { display: flex; gap: 4px; justify-content: center; margin-bottom: 12px; }
        .progress-dot { height: 3px; border-radius: 99px; background: rgba(255,255,255,0.3); transition: all 0.3s; }
        .progress-dot.active { background: #fff; }
      `}</style>

      {/* Media layer */}
      <div
        style={{ position: "relative", width: "100%", height: "100dvh", background: "#000" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeClip.mediaType === "PHOTO" ? (
          <img src={activeClip.mediaUrl} className="photo-el" alt="clip" />
        ) : (
          <video
            ref={el => { videoRefs.current[activeClip.id] = el; }}
            key={activeClip.id}
            src={activeClip.mediaUrl}
            className="video-el"
            autoPlay
            playsInline
            loop
            muted={muted}
          />
        )}

        <div className="gradient-top" />
        <div className="gradient-bottom" />

        {/* Top bar */}
        <div className="top-bar">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginRight: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="back-btn" onClick={() => router.back()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="mute-btn" onClick={() => setMuted(!muted)}>
                {muted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                )}
              </button>
            </div>

            {/* Course header — shows on first clip */}
            {showCourseHeader && (
              <div className="course-header">
                <div className="course-header-top">
                  <div className="course-abbr">{abbr}</div>
                  <div>
                    <div className="course-header-name">{course.name}</div>
                    <div className="course-header-loc">{course.city}, {course.state} · {course.isPublic ? "Public" : "Private"}</div>
                  </div>
                </div>
                <div className="course-stats-row">
                  <div className="stat-chip"><span>{course.holeCount || 18}</span> holes</div>
                  <div className="stat-chip"><span>{clips.filter(c => !c.isForeign).length}</span> clips</div>
                </div>
                <button className="browse-holes-btn" onClick={() => router.push(`/courses/${id}/holes`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  Browse hole by hole
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress dots */}
        {clips.length > 1 && (
          <div style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 20 }}>
            {clips.slice(0, Math.min(clips.length, 12)).map((_, i) => (
              <div key={i} className={`progress-dot ${i === activeIndex ? "active" : ""}`} style={{ width: i === activeIndex ? 20 : 6 }} />
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="right-actions">
          <button className="action-btn" onClick={() => router.push("/upload")}>
            <div className="action-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <span className="action-label">Upload</span>
          </button>
          {activeClip.holeNumber && (
            <button className="action-btn" onClick={() => router.push(`/courses/${id}/holes/${activeClip.holeNumber}`)}>
              <div className="action-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </div>
              <span className="action-label">Hole {activeClip.holeNumber}</span>
            </button>
          )}
        </div>

        {/* Swipe up hint */}
        {activeIndex === 0 && clips.length > 1 && (
          <div className="swipe-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.4)", writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: 1 }}>SWIPE</span>
          </div>
        )}

        {/* Bottom info */}
        <div className="bottom-info">

          {/* Foreign course banner */}
          {activeClip.isForeign && (
            <div className="foreign-banner">
              <span className="foreign-banner-text">📍 {activeClip.courseName}</span>
              <button className="foreign-banner-btn" onClick={() => router.push(`/courses/${activeClip.courseId}`)}>
                View course →
              </button>
            </div>
          )}

          <div className="hole-line">
            {activeClip.isForeign
              ? `${activeClip.courseName} · ${activeClip.courseCity}, ${activeClip.courseState}`
              : `${course.name} · Hole ${activeClip.holeNumber || "?"}`
            }
          </div>

          <div className="tags-row">
            {activeClip.shotType && <span className="tag green">{SHOT_LABEL[activeClip.shotType] || activeClip.shotType}</span>}
            {activeClip.clubUsed && <span className="tag">{activeClip.clubUsed}</span>}
            {activeClip.windCondition && <span className="tag">{activeClip.windCondition}</span>}
            {activeClip.datePlayedAt && <span className="tag">{new Date(activeClip.datePlayedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
          </div>

          {hasIntel && (
            <>
              <button className="intel-toggle-btn" onClick={() => setIntelOpen(!intelOpen)}>
                <span>{intelOpen ? "Hide intel" : "View intel"}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {intelOpen ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                </svg>
              </button>
              {intelOpen && (
                <div className="intel-panel">
                  {activeClip.strategyNote && (
                    <div className="intel-row">
                      <div className="intel-label">Strategy</div>
                      <div className="intel-value">{activeClip.strategyNote}</div>
                    </div>
                  )}
                  {activeClip.landingZoneNote && (
                    <div className="intel-row">
                      <div className="intel-label">Landing Zone</div>
                      <div className="intel-value">{activeClip.landingZoneNote}</div>
                    </div>
                  )}
                  {activeClip.whatCameraDoesntShow && (
                    <div className="intel-row">
                      <div className="intel-label">What Camera Doesn't Show</div>
                      <div className="intel-value">{activeClip.whatCameraDoesntShow}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLike } from "@/hooks/useLike";
import UserAvatarButton from "@/components/UserAvatarButton";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
};

type Hole = {
  id: string;
  holeNumber: number;
  par: number;
  handicap: number | null;
  uploadCount: number;
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
  userId: string;
  createdAt: string;
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
};

type Series = {
  seriesId: string;
  shots: Upload[];
  username: string;
  avatarUrl: string | null;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole", RECOVERY: "Recovery",
};

// Horizontal swipe player for a series
function SeriesPlayer({ series, onClose }: { series: Series; onClose: () => void }) {
  const [shotIndex, setShotIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeShot = series.shots[shotIndex];

  useEffect(() => {
    // Play active, pause others
    series.shots.forEach((shot, i) => {
      const el = videoRefs.current[shot.id];
      if (!el) return;
      if (i === shotIndex) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        el.pause();
        el.currentTime = 0;
      }
    });
  }, [shotIndex, series.shots]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50 && shotIndex < series.shots.length - 1) {
      setShotIndex(prev => prev + 1);
    } else if (delta < -50 && shotIndex > 0) {
      setShotIndex(prev => prev - 1);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200 }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Render all shots, show only active */}
      {series.shots.map((shot, i) => (
        <div key={shot.id} style={{ position: "absolute", inset: 0, opacity: i === shotIndex ? 1 : 0, transition: "opacity 0.2s", pointerEvents: i === shotIndex ? "auto" : "none" }}>
          {shot.mediaType === "VIDEO" ? (
            <video
              ref={el => { videoRefs.current[shot.id] = el; }}
              src={shot.mediaUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loop
              playsInline
              muted={muted}
            />
          ) : (
            <img src={shot.mediaUrl} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      ))}

      {/* Gradients */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none", zIndex: 5 }} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "52px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        {/* Series title */}
        <div style={{ background: "rgba(180,145,60,0.2)", border: "1px solid rgba(180,145,60,0.4)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e" }}>Play a Hole With Me</span>
        </div>

        <button onClick={() => setMuted(m => !m)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {muted
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          }
        </button>
      </div>

      {/* Shot progress dots */}
      <div style={{ position: "absolute", top: 110, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 10 }}>
        {series.shots.map((_, i) => (
          <div
            key={i}
            onClick={() => setShotIndex(i)}
            style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#c8a96e" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 24 : 8, transition: "all 0.3s", cursor: "pointer" }}
          />
        ))}
      </div>

      {/* Yardage overlay */}
      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", zIndex: 10 }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{activeShot.yardageOverlay} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>yds</span></div>
          </div>
        </div>
      )}

      {/* Left/right nav arrows */}
      {shotIndex > 0 && (
        <button onClick={() => setShotIndex(i => i - 1)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {shotIndex < series.shots.length - 1 && (
        <button onClick={() => setShotIndex(i => i + 1)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {/* Bottom shot info */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 40px", zIndex: 10 }}>
        {/* Uploader */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {series.avatarUrl
              ? <img src={series.avatarUrl} alt={series.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>@{series.username}</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>· Shot {shotIndex + 1} of {series.shots.length}</span>
        </div>

        {/* Shot type + club */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {activeShot?.shotType && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e", background: "rgba(180,145,60,0.15)", border: "1px solid rgba(180,145,60,0.3)", borderRadius: 99, padding: "3px 10px" }}>
              {SHOT_LABEL[activeShot.shotType] || activeShot.shotType}
            </span>
          )}
          {activeShot?.clubUsed && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "3px 10px" }}>
              {activeShot.clubUsed}
            </span>
          )}
        </div>

        {/* Strategy note */}
        {activeShot?.strategyNote && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
            {activeShot.strategyNote}
          </div>
        )}

        {/* Swipe hint */}
        {shotIndex === 0 && series.shots.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, opacity: 0.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>SWIPE FOR NEXT SHOT</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HolePage() {
  const { id, number } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    if (!id || !number) return;
    const supabase = createClient();

    Promise.all([
      supabase.from("Course").select("id, name, city, state").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).eq("holeNumber", Number(number)).single(),
    ]).then(async ([courseRes, holeRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holeRes.data) setHole(holeRes.data);

      if (holeRes.data?.id) {
        const { data: uploadsData } = await supabase
          .from("Upload")
          .select("*")
          .eq("holeId", holeRes.data.id)
          .order("rankScore", { ascending: false });

        if (uploadsData) {
          // Separate series from single clips
          const singleClips = uploadsData.filter((u: Upload) => !u.seriesId);
          const seriesClips = uploadsData.filter((u: Upload) => u.seriesId);

          setUploads(singleClips);

          // Group series clips by seriesId
          const seriesMap: Record<string, Upload[]> = {};
          seriesClips.forEach((clip: Upload) => {
            if (!clip.seriesId) return;
            if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
            seriesMap[clip.seriesId].push(clip);
          });

          // Sort each series by seriesOrder
          const seriesGroups = Object.entries(seriesMap).map(([seriesId, shots]) => ({
            seriesId,
            shots: shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0)),
            username: "golfer",
            avatarUrl: null,
          }));

          // Fetch usernames for series
          if (seriesGroups.length > 0) {
            const userIds = [...new Set(seriesGroups.map(s => s.shots[0]?.userId).filter(Boolean))];
            const { data: users } = await supabase.from("User").select("id, username, avatarUrl").in("id", userIds);
            const enriched = seriesGroups.map(sg => ({
              ...sg,
              username: users?.find((u: any) => u.id === sg.shots[0]?.userId)?.username || "golfer",
              avatarUrl: users?.find((u: any) => u.id === sg.shots[0]?.userId)?.avatarUrl || null,
            }));
            setSeries(enriched);
          }
        }
      }

      setLoading(false);
    });
  }, [id, number]);

  // Manage video playback for single clips
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([clipId, videoEl]) => {
      if (!videoEl) return;
      const clipIndex = uploads.findIndex(u => u.id === clipId);
      if (clipIndex === activeIndex) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
    setIntelOpen(false);
  }, [activeIndex, uploads]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50 && activeIndex < uploads.length - 1) {
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

  const holeNum = Number(number);
  const par = hole?.par || 4;
  const hasContent = uploads.length > 0 || series.length > 0;

  if (!hasContent) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap'); *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>{course?.name} — Hole {holeNum}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
          </div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 28 }}>Be the first to upload intel<br/>for {course?.name} — Hole {holeNum}</p>
          <button onClick={() => router.push(`/upload?courseId=${id}`)} style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Upload a clip</button>
        </div>
      </main>
    );
  }

  const activeUpload = uploads[activeIndex];
  const hasIntel = activeUpload && (activeUpload.strategyNote || activeUpload.landingZoneNote || activeUpload.whatCameraDoesntShow);

  return (
    <>
      {/* Series player modal */}
      {activeSeries && (
        <SeriesPlayer series={activeSeries} onClose={() => setActiveSeries(null)} />
      )}

      <main style={{ height: "100dvh", background: "#000", overflow: "hidden", position: "relative" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .video-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .photo-el { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .gradient-top { position: absolute; top: 0; left: 0; right: 0; height: 160px; background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%); z-index: 10; pointer-events: none; }
          .gradient-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 320px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%); z-index: 10; pointer-events: none; }
          .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 52px 20px 16px; z-index: 20; }
          .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .hole-badge { background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.12); border-radius: 99px; padding: 6px 14px; text-align: center; }
          .hole-badge-num { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 900; color: #fff; line-height: 1; }
          .hole-badge-par { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 1px; }
          .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.35); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; }
          .right-actions { position: absolute; right: 16px; bottom: 200px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 20; }
          .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
          .action-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; }
          .action-label { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(255,255,255,0.6); }
          .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 20px 36px; z-index: 20; }
          .course-line { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
          .tags-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
          .tag { background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); border-radius: 99px; padding: 4px 11px; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.8); }
          .tag.green { border-color: rgba(77,168,98,0.4); color: #4da862; background: rgba(77,168,98,0.15); }
          .intel-toggle-btn { width: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 8px; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); }
          .intel-panel { background: rgba(0,0,0,0.6); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px; margin-bottom: 8px; }
          .intel-row { margin-bottom: 12px; }
          .intel-row:last-child { margin-bottom: 0; }
          .intel-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px; }
          .intel-value { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5; }
          .series-card { background: linear-gradient(135deg, rgba(180,145,60,0.15), rgba(180,145,60,0.05)); border: 1px solid rgba(180,145,60,0.35); border-radius: 14px; padding: 14px; cursor: pointer; transition: all 0.15s; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
          .series-card:active { opacity: 0.8; }
        `}</style>

        {/* Show series cards or single clip feed */}
        {uploads.length > 0 ? (
          <div
            style={{ position: "relative", width: "100%", height: "100dvh", background: "#000" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {activeUpload.mediaType === "PHOTO" ? (
              <img src={activeUpload.mediaUrl} className="photo-el" alt="clip" />
            ) : (
              <video
                ref={el => { videoRefs.current[activeUpload.id] = el; }}
                key={activeUpload.id}
                src={activeUpload.mediaUrl}
                className="video-el"
                autoPlay
                playsInline
                loop
                muted={muted}
              />
            )}

            {/* Yardage overlay for single clips */}
            {activeUpload.yardageOverlay && (
              <div style={{ position: "absolute", top: "45%", left: 16, zIndex: 15 }}>
                <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px" }}>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeUpload.yardageOverlay} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>yds</span></div>
                </div>
              </div>
            )}

            <div className="gradient-top" />
            <div className="gradient-bottom" />

            {/* Top bar */}
            <div className="top-bar">
              <button className="back-btn" onClick={() => router.back()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="hole-badge">
                <div className="hole-badge-num">{holeNum}</div>
                <div className="hole-badge-par">Par {par}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="mute-btn" onClick={() => setMuted(!muted)}>
                  {muted
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  }
                </button>
                <UserAvatarButton />
              </div>
            </div>

            {/* Clip counter dots */}
            {uploads.length > 1 && (
              <div style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 20 }}>
                {uploads.map((_, i) => (
                  <div key={i} style={{ height: 3, borderRadius: 99, background: i === activeIndex ? "#fff" : "rgba(255,255,255,0.3)", width: i === activeIndex ? 20 : 6, transition: "all 0.3s" }} />
                ))}
              </div>
            )}

            {/* Right actions */}
            <div className="right-actions">
              <button className="action-btn" onClick={() => router.push(`/upload?courseId=${id}`)}>
                <div className="action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <span className="action-label">Upload</span>
              </button>
              <button className="action-btn" onClick={() => router.push(`/courses/${id}`)}>
                <div className="action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <span className="action-label">Course</span>
              </button>
            </div>

            {activeIndex === 0 && uploads.length > 1 && (
              <div style={{ position: "absolute", bottom: 180, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.5 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>SWIPE UP</span>
              </div>
            )}

            {/* Bottom info */}
            <div className="bottom-info">
              <div className="course-line">{course?.name} · Hole {holeNum} · {uploads.length} clip{uploads.length !== 1 ? "s" : ""}</div>

              {/* Series cards inline above clip info */}
              {series.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {series.map(s => (
                    <div key={s.seriesId} className="series-card" onClick={() => setActiveSeries(s)}>
                      <div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#c8a96e", marginBottom: 2 }}>🏌️ Play a Hole With Me</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{s.username} · {s.shots.length} shots</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(180,145,60,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  ))}
                </div>
              )}

              <div className="tags-row">
                {activeUpload.shotType && <span className="tag green">{SHOT_LABEL[activeUpload.shotType] || activeUpload.shotType}</span>}
                {activeUpload.clubUsed && <span className="tag">{activeUpload.clubUsed}</span>}
                {activeUpload.windCondition && <span className="tag">{activeUpload.windCondition}</span>}
                {activeUpload.datePlayedAt && <span className="tag">{new Date(activeUpload.datePlayedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
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
                      {activeUpload.strategyNote && <div className="intel-row"><div className="intel-label">Strategy</div><div className="intel-value">{activeUpload.strategyNote}</div></div>}
                      {activeUpload.landingZoneNote && <div className="intel-row"><div className="intel-label">Landing Zone</div><div className="intel-value">{activeUpload.landingZoneNote}</div></div>}
                      {activeUpload.whatCameraDoesntShow && <div className="intel-row"><div className="intel-label">What Camera Doesn't Show</div><div className="intel-value">{activeUpload.whatCameraDoesntShow}</div></div>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* Only series, no single clips — show series cards on dark bg */
          <div style={{ minHeight: "100dvh", background: "#07100a", padding: "80px 20px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>{course?.name}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Hole {holeNum} · Par {par}</div>
              </div>
            </div>
            {series.map(s => (
              <div key={s.seriesId} className="series-card" onClick={() => setActiveSeries(s)}>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#c8a96e", marginBottom: 3 }}>🏌️ Play a Hole With Me</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{s.username} · {s.shots.length} shots</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(180,145,60,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

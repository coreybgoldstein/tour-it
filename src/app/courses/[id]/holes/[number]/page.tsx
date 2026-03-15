"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

export default function HolePage() {
  const { id, number } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [intelOpen, setIntelOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !number) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("Course").select("id, name, city, state").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).eq("holeNumber", Number(number)).single(),
      supabase.from("Hole").select("id").eq("courseId", id).eq("holeNumber", Number(number)).single().then(({ data: holeRow }) =>
        supabase.from("Upload").select("*").eq("holeId", holeRow?.id || "").order("rankScore", { ascending: false })
      ),
    ]).then(([courseRes, holeRes, uploadsRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holeRes.data) setHole(holeRes.data);
      if (uploadsRes.data) setUploads(uploadsRes.data);
      setLoading(false);
    });
  }, [id, number]);

  // Reset intel panel when switching clips
  useEffect(() => {
    setIntelOpen(false);
  }, [activeIndex]);

  const activeUpload = uploads[activeIndex];
  const hasIntel = activeUpload && (activeUpload.strategyNote || activeUpload.landingZoneNote || activeUpload.whatCameraDoesntShow);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  const holeNum = Number(number);
  const par = hole?.par || 4;

  // Empty state
  if (uploads.length === 0) {
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
          <button onClick={() => router.push("/upload")} style={{ background: "#2d7a42", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            Upload a clip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ height: "100dvh", background: "#000", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .video-container {
          position: relative; width: 100%; height: 100dvh;
          background: #000; overflow: hidden;
        }

        .video-el {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover;
        }

        .photo-el {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover;
        }

        /* Dark gradient overlays */
        .gradient-top {
          position: absolute; top: 0; left: 0; right: 0; height: 160px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
          z-index: 10; pointer-events: none;
        }
        .gradient-bottom {
          position: absolute; bottom: 0; left: 0; right: 0; height: 320px;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%);
          z-index: 10; pointer-events: none;
        }

        /* Top bar */
        .top-bar {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 52px 20px 16px; z-index: 20;
        }
        .back-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(0,0,0,0.35); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .hole-badge {
          background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 99px;
          padding: 6px 14px; text-align: center;
        }
        .hole-badge-num { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 900; color: #fff; line-height: 1; }
        .hole-badge-par { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 1px; }
        .mute-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(0,0,0,0.35); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }

        /* Clip counter dots */
        .dots {
          position: absolute; top: 48px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 4px; z-index: 20;
        }
        .dot {
          height: 3px; border-radius: 99px;
          background: rgba(255,255,255,0.3); transition: all 0.3s ease;
        }
        .dot.active { background: #fff; }

        /* Right side actions */
        .right-actions {
          position: absolute; right: 16px; bottom: 200px;
          display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 20;
        }
        .action-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          background: none; border: none; cursor: pointer;
        }
        .action-icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
        }
        .action-label { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(255,255,255,0.6); }

        /* Bottom info */
        .bottom-info {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 0 20px 32px; z-index: 20;
        }
        .course-line { font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; }

        .tags-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .tag {
          background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15); border-radius: 99px;
          padding: 4px 11px; font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.8);
        }
        .tag.green { border-color: rgba(77,168,98,0.4); color: #4da862; background: rgba(77,168,98,0.15); }

        /* Intel panel */
        .intel-toggle-btn {
          width: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
          padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; margin-bottom: 8px;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6);
        }
        .intel-panel {
          background: rgba(0,0,0,0.6); backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
          padding: 14px; margin-bottom: 8px;
        }
        .intel-row { margin-bottom: 12px; }
        .intel-row:last-child { margin-bottom: 0; }
        .intel-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px; }
        .intel-value { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5; }

        /* Nav arrows */
        .prev-btn, .next-btn {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 40px; height: 60px;
          background: none; border: none; cursor: pointer; z-index: 20;
          display: flex; align-items: center; justify-content: center;
        }
        .prev-btn { left: 0; }
        .next-btn { right: 0; }

        /* Upload fab */
        .upload-fab {
          position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%);
          background: #2d7a42; border: none; border-radius: 99px;
          padding: 11px 22px; display: flex; align-items: center; gap: 8px;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; color: #fff;
          cursor: pointer; box-shadow: 0 4px 20px rgba(45,122,66,0.5); z-index: 30;
          white-space: nowrap;
        }
      `}</style>

      <div className="video-container" ref={containerRef}>

        {/* Media */}
        {activeUpload.mediaType === "PHOTO" ? (
          <img src={activeUpload.mediaUrl} className="photo-el" alt="clip" />
        ) : (
          <video
            ref={videoRef}
            key={activeUpload.id}
            src={activeUpload.mediaUrl}
            className="video-el"
            autoPlay
            playsInline
            loop
            muted={muted}
          />
        )}

        {/* Gradients */}
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
          <button className="mute-btn" onClick={() => setMuted(!muted)}>
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            )}
          </button>
        </div>

        {/* Clip counter dots */}
        {uploads.length > 1 && (
          <div className="dots">
            {uploads.map((_, i) => (
              <div key={i} className={`dot ${i === activeIndex ? "active" : ""}`} style={{ width: i === activeIndex ? 20 : 6 }} />
            ))}
          </div>
        )}

        {/* Prev / Next tap zones */}
        {activeIndex > 0 && (
          <button className="prev-btn" onClick={() => setActiveIndex(activeIndex - 1)} />
        )}
        {activeIndex < uploads.length - 1 && (
          <button className="next-btn" onClick={() => setActiveIndex(activeIndex + 1)} />
        )}

        {/* Right actions */}
        <div className="right-actions">
          <button className="action-btn" onClick={() => router.push("/upload")}>
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

        {/* Bottom info */}
        <div className="bottom-info">
          <div className="course-line">{course?.name} · Hole {holeNum} · {uploads.length} clip{uploads.length !== 1 ? "s" : ""}</div>

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
                  {activeUpload.strategyNote && (
                    <div className="intel-row">
                      <div className="intel-label">Strategy</div>
                      <div className="intel-value">{activeUpload.strategyNote}</div>
                    </div>
                  )}
                  {activeUpload.landingZoneNote && (
                    <div className="intel-row">
                      <div className="intel-label">Landing Zone</div>
                      <div className="intel-value">{activeUpload.landingZoneNote}</div>
                    </div>
                  )}
                  {activeUpload.whatCameraDoesntShow && (
                    <div className="intel-row">
                      <div className="intel-label">What Camera Doesn't Show</div>
                      <div className="intel-value">{activeUpload.whatCameraDoesntShow}</div>
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

"use client";

import { useState, useEffect } from "react";
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
  datePlayed: string | null;
  rankScore: number;
  createdAt: string;
};

export default function HolePage() {
  const { id, number } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUpload, setExpandedUpload] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !number) return;
    const supabase = createClient();

    Promise.all([
      supabase.from("Course").select("id, name, city, state").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).eq("holeNumber", Number(number)).single(),
      supabase.from("Upload").select("*").eq("courseId", id).eq("holeNumber", Number(number)).order("rankScore", { ascending: false }),
    ]).then(([courseRes, holeRes, uploadsRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holeRes.data) setHole(holeRes.data);
      if (uploadsRes.data) setUploads(uploadsRes.data);
      setLoading(false);
    });
  }, [id, number]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  const holeNum = Number(number);
  const par = hole?.par || 4;

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; position: sticky; top: 0; background: #07100a; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .header-title { font-family: "'Outfit', sans-serif"; font-size: 15px; font-weight: 600; color: #fff; }

        .hero { padding: 24px 24px 20px; display: flex; align-items: flex-end; gap: 16px; }
        .hole-num-big { font-family: 'Playfair Display', serif; font-size: 72px; font-weight: 900; color: #fff; line-height: 1; }
        .hero-info { padding-bottom: 8px; }
        .hero-course { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
        .hero-par { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.7); }

        .section-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1px; text-transform: uppercase; padding: 0 24px; margin-bottom: 12px; margin-top: 24px; }

        .empty-clips { margin: 0 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px 20px; text-align: center; }
        .empty-clips p { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(255,255,255,0.25); line-height: 1.6; }

        .clip-card { margin: 0 24px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        .clip-thumb { width: 100%; height: 180px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; }
        .play-btn { width: 48px; height: 48px; border-radius: 50%; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }
        .clip-meta { padding: 12px 14px; }
        .clip-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .clip-tag { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 99px; padding: 3px 10px; font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.5); }
        .clip-tag.green { background: rgba(77,168,98,0.1); border-color: rgba(77,168,98,0.2); color: rgba(77,168,98,0.8); }
        .intel-toggle { width: 100%; background: none; border: none; border-top: 1px solid rgba(255,255,255,0.05); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(255,255,255,0.35); }
        .intel-section { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.05); }
        .intel-row { margin-bottom: 10px; }
        .intel-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 3px; }
        .intel-value { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.5; }

        .upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 20px 24px 0; background: #2d7a42; border: none; border-radius: 14px; padding: 14px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; width: calc(100% - 48px); }

        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(7,16,10,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-around; padding: 8px 0 20px; z-index: 50; }
        .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; padding: 4px 16px; }
        .nav-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.3); }
        .upload-nav { width: 48px; height: 48px; border-radius: 50%; background: #2d7a42; display: flex; align-items: center; justify-content: center; margin-top: -20px; box-shadow: 0 4px 20px rgba(45,122,66,0.5); border: none; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div className="header">
        <button className="back-btn" onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="header-title">{course?.name} — Hole {holeNum}</span>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="hole-num-big">{holeNum}</div>
        <div className="hero-info">
          <div className="hero-course">{course?.city}, {course?.state}</div>
          <div className="hero-par">Par {par}</div>
        </div>
      </div>

      {/* Clips */}
      <p className="section-label">Clips ({uploads.length})</p>

      {uploads.length === 0 ? (
        <div className="empty-clips">
          <p>No clips yet for this hole.<br/>Be the first to upload your intel.</p>
        </div>
      ) : (
        uploads.map(upload => (
          <div key={upload.id} className="clip-card">
            <div className="clip-thumb" onClick={() => window.open(upload.mediaUrl, "_blank")}>
              <div className="play-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              {upload.mediaType === "PHOTO" && (
                <img src={upload.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>

            <div className="clip-meta">
              <div className="clip-tags">
                {upload.shotType && <span className="clip-tag green">{upload.shotType}</span>}
                {upload.clubUsed && <span className="clip-tag">{upload.clubUsed}</span>}
                {upload.windCondition && <span className="clip-tag">{upload.windCondition}</span>}
                {upload.datePlayed && <span className="clip-tag">{new Date(upload.datePlayed).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
              </div>
            </div>

            {(upload.strategyNote || upload.landingZoneNote || upload.whatCameraDoesntShow) && (
              <>
                <button className="intel-toggle" onClick={() => setExpandedUpload(expandedUpload === upload.id ? null : upload.id)}>
                  <span>View intel</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {expandedUpload === upload.id ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
                  </svg>
                </button>

                {expandedUpload === upload.id && (
                  <div className="intel-section">
                    {upload.strategyNote && (
                      <div className="intel-row">
                        <div className="intel-label">Strategy</div>
                        <div className="intel-value">{upload.strategyNote}</div>
                      </div>
                    )}
                    {upload.landingZoneNote && (
                      <div className="intel-row">
                        <div className="intel-label">Landing Zone</div>
                        <div className="intel-value">{upload.landingZoneNote}</div>
                      </div>
                    )}
                    {upload.whatCameraDoesntShow && (
                      <div className="intel-row">
                        <div className="intel-label">What Camera Doesn't Show</div>
                        <div className="intel-value">{upload.whatCameraDoesntShow}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))
      )}

      <button className="upload-btn" onClick={() => router.push("/upload")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload a clip for this hole
      </button>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => router.push("/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span className="nav-label">Home</span>
        </button>
        <button className="nav-btn" onClick={() => router.push("/search")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="nav-label">Search</span>
        </button>
        <button className="upload-nav" onClick={() => router.push("/upload")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button className="nav-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span className="nav-label">Saved</span>
        </button>
        <button className="nav-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
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

type Hole = {
  id: string;
  holeNumber: number;
  par: number;
  handicap: number | null;
  uploadCount: number;
};

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"holes" | "info">("holes");

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    Promise.all([
      supabase.from("Course").select("*").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).order("holeNumber"),
    ]).then(([courseRes, holesRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holesRes.data) setHoles(holesRes.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (!course) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');`}</style>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Course not found</p>
          <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", cursor: "pointer" }}>Back to Search</button>
        </div>
      </main>
    );
  }

  const abbr = course.name.split(" ").filter(w => w.length > 2).map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const frontNine = holes.length > 0 ? holes.slice(0, 9) : Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, holeNumber: i + 1, par: 4, handicap: null, uploadCount: 0 }));
  const backNine = holes.length > 0 ? holes.slice(9, 18) : Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, holeNumber: i + 10, par: 4, handicap: null, uploadCount: 0 }));

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; position: sticky; top: 0; background: #07100a; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .header-title { fontFamily: "'Outfit', sans-serif"; font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .hero { padding: 24px 20px 20px; }
        .course-logo { width: 56px; height: 56px; border-radius: 14px; background: rgba(77,168,98,0.15); border: 1px solid rgba(77,168,98,0.3); display: flex; align-items: center; justify-content: center; font-family: "'Outfit', sans-serif"; font-size: 14px; font-weight: 700; color: #4da862; letter-spacing: 0.5px; margin-bottom: 14px; }
        .course-title { font-family: "'Playfair Display', serif"; font-size: 24px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 6px; }
        .course-location { font-family: "'Outfit', sans-serif"; font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.4); margin-bottom: 16px; }
        .course-stats { display: flex; gap: 12px; }
        .stat-pill { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 99px; padding: 6px 14px; font-family: "'Outfit', sans-serif"; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5); }
        .stat-pill span { color: rgba(255,255,255,0.8); font-weight: 600; }

        .tabs { display: flex; gap: 0; padding: 0 20px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
        .tab { padding: 12px 20px; font-family: "'Outfit', sans-serif"; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.35); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s; }
        .tab.active { color: #4da862; border-bottom-color: #4da862; }

        .nine-label { font-family: "'Outfit', sans-serif"; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1px; text-transform: uppercase; padding: 0 20px; margin-bottom: 10px; }
        .holes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0 20px; margin-bottom: 20px; }
        .hole-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px; cursor: pointer; transition: all 0.15s; text-align: left; }
        .hole-card:hover { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.2); }
        .hole-number { font-family: "'Playfair Display', serif"; font-size: 20px; font-weight: 900; color: #fff; line-height: 1; margin-bottom: 4px; }
        .hole-par { font-family: "'Outfit', sans-serif"; font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .hole-clips { font-family: "'Outfit', sans-serif"; font-size: 11px; font-weight: 500; color: rgba(77,168,98,0.7); }

        .upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 8px 20px 24px; background: #2d7a42; border: none; border-radius: 14px; padding: 14px; font-family: "'Outfit', sans-serif"; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; width: calc(100% - 40px); }

        .info-section { padding: 0 20px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: "'Outfit', sans-serif"; font-size: 14px; }
        .info-label { color: rgba(255,255,255,0.35); font-weight: 400; }
        .info-value { color: rgba(255,255,255,0.8); font-weight: 500; }

        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(7,16,10,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-around; padding: 8px 0 20px; z-index: 50; }
        .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; padding: 4px 16px; }
        .nav-label { font-family: "'Outfit', sans-serif"; font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.3); }
        .nav-btn.active .nav-label { color: #4da862; }
        .upload-nav { width: 48px; height: 48px; border-radius: 50%; background: #2d7a42; display: flex; align-items: center; justify-content: center; margin-top: -20px; box-shadow: 0 4px 20px rgba(45,122,66,0.5); border: none; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div className="header">
        <button className="back-btn" onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="header-title">{course.name}</span>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="course-logo">{abbr}</div>
        <h1 className="course-title">{course.name}</h1>
        <p className="course-location">{course.city}, {course.state} · {course.isPublic ? "Public" : "Private"}</p>
        <div className="course-stats">
          <div className="stat-pill"><span>{course.holeCount || 18}</span> holes</div>
          <div className="stat-pill"><span>{course.uploadCount || 0}</span> clips</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === "holes" ? "active" : ""}`} onClick={() => setActiveTab("holes")}>Holes</button>
        <button className={`tab ${activeTab === "info" ? "active" : ""}`} onClick={() => setActiveTab("info")}>Course Info</button>
      </div>

      {activeTab === "holes" && (
        <>
          <p className="nine-label">Front Nine</p>
          <div className="holes-grid">
            {frontNine.map(hole => (
              <button key={hole.id} className="hole-card" onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}>
                <div className="hole-number">{hole.holeNumber}</div>
                <div className="hole-par">Par {hole.par || 4}</div>
                <div className="hole-clips">{hole.uploadCount || 0} clips</div>
              </button>
            ))}
          </div>

          <p className="nine-label">Back Nine</p>
          <div className="holes-grid">
            {backNine.map(hole => (
              <button key={hole.id} className="hole-card" onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}>
                <div className="hole-number">{hole.holeNumber}</div>
                <div className="hole-par">Par {hole.par || 4}</div>
                <div className="hole-clips">{hole.uploadCount || 0} clips</div>
              </button>
            ))}
          </div>

          <button className="upload-btn" onClick={() => router.push("/upload")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload a clip for this course
          </button>
        </>
      )}

      {activeTab === "info" && (
        <div className="info-section">
          <div className="info-row">
            <span className="info-label">Location</span>
            <span className="info-value">{course.city}, {course.state}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Type</span>
            <span className="info-value">{course.isPublic ? "Public" : "Private"}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Holes</span>
            <span className="info-value">{course.holeCount || 18}</span>
          </div>
          {course.websiteUrl && (
            <div className="info-row">
              <span className="info-label">Website</span>
              <span className="info-value" style={{ color: "#4da862" }}>{course.websiteUrl}</span>
            </div>
          )}
          {course.description && (
            <div style={{ paddingTop: 16, fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              {course.description}
            </div>
          )}
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => router.push("/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span className="nav-label">Home</span>
        </button>
        <button className="nav-btn active" onClick={() => router.push("/search")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="nav-label" style={{ color: "#4da862" }}>Search</span>
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

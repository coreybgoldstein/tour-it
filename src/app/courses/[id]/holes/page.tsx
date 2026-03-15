"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
};

type Hole = {
  id: string;
  holeNumber: number;
  par: number;
  handicap: number | null;
  uploadCount: number;
};

export default function HolesOverviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("Course").select("id, name, city, state, holeCount").eq("id", id).single(),
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
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  const frontNine = holes.filter(h => h.holeNumber <= 9);
  const backNine = holes.filter(h => h.holeNumber >= 10);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 40 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; position: sticky; top: 0; background: #07100a; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .page { max-width: 480px; margin: 0 auto; padding: 24px 20px; }
        .course-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 4px; }
        .course-loc { font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 28px; }
        .nine-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 12px; }
        .holes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 28px; }
        .hole-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 12px; cursor: pointer; transition: all 0.15s; text-align: left; }
        .hole-card:hover { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.25); transform: translateY(-1px); }
        .hole-card.has-clips { border-color: rgba(77,168,98,0.2); }
        .hole-number { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; color: #fff; line-height: 1; margin-bottom: 4px; }
        .hole-par { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
        .hole-clips { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500; }
        .hole-clips.has { color: #4da862; }
        .hole-clips.none { color: rgba(255,255,255,0.2); }
        .upload-btn { width: 100%; background: #2d7a42; border: none; border-radius: 14px; padding: 14px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; }
      `}</style>

      <div className="header">
        <button className="back-btn" onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {course?.name}
        </span>
      </div>

      <div className="page">
        <h1 className="course-name">{course?.name}</h1>
        <p className="course-loc">{course?.city}, {course?.state} · {course?.holeCount || 18} holes</p>

        <p className="nine-label">Front Nine</p>
        <div className="holes-grid">
          {frontNine.map(hole => (
            <button key={hole.id} className={`hole-card ${hole.uploadCount > 0 ? "has-clips" : ""}`} onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}>
              <div className="hole-number">{hole.holeNumber}</div>
              <div className="hole-par">Par {hole.par || 4}</div>
              <div className={`hole-clips ${hole.uploadCount > 0 ? "has" : "none"}`}>
                {hole.uploadCount > 0 ? `${hole.uploadCount} clip${hole.uploadCount !== 1 ? "s" : ""}` : "No clips"}
              </div>
            </button>
          ))}
        </div>

        <p className="nine-label">Back Nine</p>
        <div className="holes-grid">
          {backNine.map(hole => (
            <button key={hole.id} className={`hole-card ${hole.uploadCount > 0 ? "has-clips" : ""}`} onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}>
              <div className="hole-number">{hole.holeNumber}</div>
              <div className="hole-par">Par {hole.par || 4}</div>
              <div className={`hole-clips ${hole.uploadCount > 0 ? "has" : "none"}`}>
                {hole.uploadCount > 0 ? `${hole.uploadCount} clip${hole.uploadCount !== 1 ? "s" : ""}` : "No clips"}
              </div>
            </button>
          ))}
        </div>

        <button className="upload-btn" onClick={() => router.push("/upload")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload a clip for this course
        </button>
      </div>
    </main>
  );
}

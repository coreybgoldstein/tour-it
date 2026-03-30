"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

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

type MultiCount = { shotType: string; count: number; group?: string };

export default function HolesOverviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [multiCounts, setMultiCounts] = useState<MultiCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("Course").select("id, name, city, state, holeCount").eq("id", id).single(),
      supabase.from("Hole").select("*").eq("courseId", id).order("holeNumber"),
      supabase.from("Upload").select("shotType, yardageOverlay")
        .eq("courseId", id)
        .in("shotType", ["FRONT_NINE", "BACK_NINE", "FULL_ROUND", "THREE_HOLE"]),
    ]).then(([courseRes, holesRes, multiRes]) => {
      if (courseRes.data) setCourse(courseRes.data);
      if (holesRes.data) setHoles(holesRes.data);
      if (multiRes.data) {
        const counts: Record<string, number> = {};
        const groupCounts: Record<string, number> = {};
        multiRes.data.forEach((u: any) => {
          if (u.shotType === "THREE_HOLE" && u.yardageOverlay) {
            groupCounts[u.yardageOverlay] = (groupCounts[u.yardageOverlay] || 0) + 1;
          } else if (u.shotType) {
            counts[u.shotType] = (counts[u.shotType] || 0) + 1;
          }
        });
        const result: MultiCount[] = [
          { shotType: "FRONT_NINE", count: counts["FRONT_NINE"] || 0 },
          { shotType: "BACK_NINE", count: counts["BACK_NINE"] || 0 },
          { shotType: "FULL_ROUND", count: counts["FULL_ROUND"] || 0 },
          ...["1–3","4–6","7–9","10–12","13–15","16–18"].map(g => ({ shotType: "THREE_HOLE", group: g, count: groupCounts[g] || 0 })),
        ];
        setMultiCounts(result);
      }
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
  const abbr = course?.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "";

  return (
    <main style={{ height: "100dvh", background: "#07100a", overflow: "hidden auto", fontFamily: "'Outfit', sans-serif", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .hole-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 8px 8px 7px; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%; }
        .hole-card:hover { background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.25); }
        .hole-card:active { background: rgba(77,168,98,0.1); }
        .hole-card.has-clips { border-color: rgba(77,168,98,0.22); }
      `}</style>

      {/* Sticky header with back + course name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "52px 16px 10px", position: "sticky", top: 0, background: "#07100a", zIndex: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => router.back()}
          style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course?.name}</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{course?.city}, {course?.state} · {course?.holeCount || 18} holes</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 14px 0" }}>

        {/* Front Nine */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>
          Front Nine
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
          {frontNine.map(hole => (
            <button
              key={hole.id}
              className={`hole-card ${hole.uploadCount > 0 ? "has-clips" : ""}`}
              onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                  {hole.holeNumber}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  P{hole.par || 4}
                </div>
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: hole.uploadCount > 0 ? "#4da862" : "rgba(255,255,255,0.18)" }}>
                {hole.uploadCount > 0 ? `${hole.uploadCount} clip${hole.uploadCount !== 1 ? "s" : ""}` : "—"}
              </div>
            </button>
          ))}
        </div>

        {/* Back Nine */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>
          Back Nine
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
          {backNine.map(hole => (
            <button
              key={hole.id}
              className={`hole-card ${hole.uploadCount > 0 ? "has-clips" : ""}`}
              onClick={() => router.push(`/courses/${id}/holes/${hole.holeNumber}`)}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                  {hole.holeNumber}
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  P{hole.par || 4}
                </div>
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: hole.uploadCount > 0 ? "#4da862" : "rgba(255,255,255,0.18)" }}>
                {hole.uploadCount > 0 ? `${hole.uploadCount} clip${hole.uploadCount !== 1 ? "s" : ""}` : "—"}
              </div>
            </button>
          ))}
        </div>

        {/* Multi-hole content */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6, marginTop: 2 }}>
          Multi-Hole
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 6 }}>
          {[
            { label: "Front 9", sub: "1–9", key: "front-9", shotType: "FRONT_NINE" },
            { label: "Back 9", sub: "10–18", key: "back-9", shotType: "BACK_NINE" },
            { label: "Full 18", sub: "Round", key: "full-18", shotType: "FULL_ROUND" },
          ].map(({ label, sub, key, shotType }) => {
            const count = multiCounts.find(m => m.shotType === shotType)?.count || 0;
            return (
              <button key={key} className={`hole-card ${count > 0 ? "has-clips" : ""}`} onClick={() => router.push(`/courses/${id}/holes/${key}`)}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{label}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{sub}</div>
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: count > 0 ? "#4da862" : "rgba(255,255,255,0.18)" }}>
                  {count > 0 ? `${count} clip${count !== 1 ? "s" : ""}` : "—"}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14 }}>
          {["1–3","4–6","7–9","10–12","13–15","16–18"].map(g => {
            const count = multiCounts.find(m => m.shotType === "THREE_HOLE" && m.group === g)?.count || 0;
            const key = `3-hole-${g.replace("–", "-")}`;
            return (
              <button key={g} className={`hole-card ${count > 0 ? "has-clips" : ""}`} onClick={() => router.push(`/courses/${id}/holes/${key}`)}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{g}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>3-hole</div>
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: count > 0 ? "#4da862" : "rgba(255,255,255,0.18)" }}>
                  {count > 0 ? `${count} clip${count !== 1 ? "s" : ""}` : "—"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Upload CTA — passes courseId */}
        <button
          onClick={() => router.push(`/upload?courseId=${id}`)}
          style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 2px 12px rgba(45,122,66,0.3)", marginBottom: 80 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload a clip for this course
        </button>
      </div>
      <BottomNav />
    </main>
  );
}

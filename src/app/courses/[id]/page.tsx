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

function ClipCard({ clip, courseId, router }: { clip: Upload; courseId: string; router: any }) {
  const [intelOpen, setIntelOpen] = useState(false);
  const hasIntel = clip.strategyNote || clip.landingZoneNote || clip.whatCameraDoesntShow;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>

      {/* Media */}
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0d2318", cursor: "pointer" }}
        onClick={() => clip.isForeign
          ? router.push(`/courses/${clip.courseId}/holes`)
          : clip.holeNumber
            ? router.push(`/courses/${courseId}/holes/${clip.holeNumber}`)
            : router.push(`/courses/${courseId}/holes`)
        }
      >
        {clip.mediaType === "VIDEO" ? (
          <video
            src={clip.mediaUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={clip.mediaUrl}
            alt="clip"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />

        {/* Play icon for videos */}
        {clip.mediaType === "VIDEO" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        )}

        {/* Hole badge */}
        {!clip.isForeign && clip.holeNumber && (
          <div style={{ position: "absolute", bottom: 8, left: 10 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(77,168,98,0.85)", borderRadius: 99, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Hole {clip.holeNumber}
            </span>
          </div>
        )}

        {/* Foreign badge */}
        {clip.isForeign && (
          <div style={{ position: "absolute", bottom: 8, left: 10, right: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(210,175,80,0.9)" }}>
              {clip.courseName}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(210,175,80,0.9)", background: "rgba(180,145,60,0.2)", border: "1px solid rgba(180,145,60,0.3)", borderRadius: 99, padding: "2px 8px", cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); router.push(`/courses/${clip.courseId}`); }}
            >
              View course →
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>

        {/* Tags */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {clip.shotType && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "2px 9px" }}>
              {SHOT_LABEL[clip.shotType] || clip.shotType}
            </span>
          )}
          {clip.clubUsed && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "2px 9px" }}>
              {clip.clubUsed}
            </span>
          )}
          {clip.datePlayedAt && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "2px 9px" }}>
              {new Date(clip.datePlayedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>

        {/* Strategy note preview */}
        {clip.strategyNote && !intelOpen && (
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: "italic", color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 8 }}>
            &ldquo;{clip.strategyNote}&rdquo;
          </p>
        )}

        {/* Intel toggle */}
        {hasIntel && (
          <>
            <button
              onClick={() => setIntelOpen(!intelOpen)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}
            >
              <span>{intelOpen ? "Hide intel" : "View full intel"}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {intelOpen ? <path d="m18 15-6-6-6 6"/> : <path d="m6 9 6 6 6-6"/>}
              </svg>
            </button>

            {intelOpen && (
              <div style={{ marginTop: 8, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {clip.strategyNote && (
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Strategy</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{clip.strategyNote}</div>
                  </div>
                )}
                {clip.landingZoneNote && (
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Landing zone</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{clip.landingZoneNote}</div>
                  </div>
                )}
                {clip.whatCameraDoesntShow && (
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>What camera doesn&apos;t show</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{clip.whatCameraDoesntShow}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [clips, setClips] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber").eq("courseId", id);
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });

      const { data: courseUploads } = await supabase
        .from("Upload")
        .select("*")
        .eq("courseId", id)
        .order("rankScore", { ascending: false });

      const courseClips: Upload[] = (courseUploads || []).map((u: any) => ({
        ...u,
        holeNumber: u.holeId ? holeMap[u.holeId] : undefined,
        courseName: courseData?.name,
        isForeign: false,
      }));

      let allClips = [...courseClips];

      // Auto-fill with discovery clips if fewer than 5
      if (courseClips.length < 5) {
        const { data: otherUploads } = await supabase
          .from("Upload")
          .select("*")
          .neq("courseId", id)
          .order("rankScore", { ascending: false })
          .limit(15);

        const otherCourseIds = [...new Set((otherUploads || []).map((u: any) => u.courseId))];
        const { data: otherCourses } = await supabase
          .from("Course")
          .select("id, name, city, state")
          .in("id", otherCourseIds);

        const foreignClips: Upload[] = (otherUploads || []).map((u: any) => ({
          ...u,
          courseName: otherCourses?.find((c: any) => c.id === u.courseId)?.name,
          courseCity: otherCourses?.find((c: any) => c.id === u.courseId)?.city,
          courseState: otherCourses?.find((c: any) => c.id === u.courseId)?.state,
          isForeign: true,
        }));
        allClips = [...courseClips, ...foreignClips];
      }

      setClips(allClips);
      setLoading(false);
    }

    loadData();
  }, [id]);

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

  const courseClipCount = clips.filter(c => !c.isForeign).length;
  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", width: "100%", height: 260 }}>
        {/* Green gradient hero — replace with real course photo when available */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 50%, #071208 100%)" }} />
        {/* Subtle texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(77,168,98,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Gradient overlay for text */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,16,10,1) 0%, rgba(7,16,10,0.4) 50%, rgba(0,0,0,0.2) 100%)" }} />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        {/* Course abbr badge */}
        <div style={{ position: "absolute", top: 52, right: 16, width: 42, height: 42, borderRadius: 10, background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", zIndex: 10 }}>
          {abbr}
        </div>

        {/* Course info at bottom of hero */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 20px", zIndex: 10 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {course.city}, {course.state} · {course.isPublic ? "Public" : "Private"}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 10 }}>
            {course.name}
          </div>
          {/* Stats pills */}
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "3px 10px" }}>
              {course.holeCount || 18} holes
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 99, padding: "3px 10px" }}>
              {courseClipCount} clips
            </span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: "14px 20px 6px", display: "flex", gap: 8 }}>
        {/* Browse by hole — primary CTA */}
        <button
          onClick={() => router.push(`/courses/${id}/holes`)}
          style={{ flex: 1, background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="20"/>
            <path d="M12 2 L19 6 L12 10 Z" fill="white" stroke="none"/>
            <ellipse cx="12" cy="21" rx="3.5" ry="1" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          Browse by hole
        </button>

        {/* Upload */}
        <button
          onClick={() => router.push("/upload")}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
      </div>

      {/* Description if exists */}
      {course.description && (
        <div style={{ padding: "8px 20px 0", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          {course.description}
        </div>
      )}

      {/* Clips feed */}
      <div style={{ padding: "16px 20px 100px" }}>

        {/* Section label */}
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
          {courseClipCount > 0 ? "Scouting clips" : "Discovery — courses you might like"}
        </div>

        {clips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No clips yet</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: 24 }}>Be the first to scout {course.name}</div>
            <button
              onClick={() => router.push("/upload")}
              style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
            >
              Upload a clip
            </button>
          </div>
        ) : (
          <>
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} courseId={id as string} router={router} />
            ))}

            {/* Discovery divider if foreign clips exist */}
            {clips.some(c => c.isForeign) && courseClipCount < 5 && (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  More courses to explore
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "rgba(7,16,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { label: "Home", path: "/", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "Search", path: "/search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z" },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
          </button>
        ))}

        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>

        <button onClick={() => router.push("/saved")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Saved</span>
        </button>

        <button onClick={() => router.push("/profile")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
        </button>
      </nav>
    </main>
  );
}

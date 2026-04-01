"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CourseRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  holeCount: number;
  isVerified: boolean;
  uploadCount: number;
  holes: { id: string; holeNumber: number; par: number | null; handicapRank: number | null }[];
};

function completeness(c: CourseRow) {
  const issues: string[] = [];
  if (!c.city || c.city.trim() === "") issues.push("city");
  if (!c.state || c.state.trim() === "") issues.push("state");
  const missingPar = c.holes.filter(h => !h.par).length;
  if (missingPar > 0) issues.push(`${missingPar} hole${missingPar > 1 ? "s" : ""} missing par`);
  const missingHcap = c.holes.filter(h => !h.handicapRank).length;
  if (missingHcap > 0) issues.push(`${missingHcap} missing handicap`);
  if (c.holes.length < c.holeCount) issues.push(`only ${c.holes.length}/${c.holeCount} holes created`);
  return issues;
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "incomplete">("incomplete");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", data.user.id).single();
      if (!profile?.isAdmin) { setUnauthorized(true); setLoading(false); return; }

      const { data: rows } = await supabase
        .from("Course")
        .select("id, name, city, state, country, holeCount, isVerified, uploadCount, holes:Hole(id, holeNumber, par, handicapRank)")
        .order("name", { ascending: true });

      setCourses((rows as CourseRow[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = courses.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.state?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "incomplete") return completeness(c).length > 0;
    return true;
  });

  const totalIncomplete = courses.filter(c => completeness(c).length > 0).length;

  if (loading) return (
    <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</div>
    </div>
  );

  if (unauthorized) return (
    <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "#ef4444", fontSize: 14 }}>Not authorized.</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "52px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>Course Editor</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{courses.length} courses · {totalIncomplete} incomplete</div>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search courses…"
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}
          />
          <button
            onClick={() => setFilter(f => f === "all" ? "incomplete" : "all")}
            style={{ background: filter === "incomplete" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${filter === "incomplete" ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: filter === "incomplete" ? "#ef4444" : "rgba(255,255,255,0.6)", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {filter === "incomplete" ? "Incomplete only" : "All courses"}
          </button>
        </div>
      </div>

      {/* Course list */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            {filter === "incomplete" ? "All courses look complete!" : "No courses found."}
          </div>
        )}
        {filtered.map(course => {
          const issues = completeness(course);
          const hasIssues = issues.length > 0;
          return (
            <button
              key={course.id}
              onClick={() => router.push(`/admin/courses/${course.id}`)}
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${hasIssues ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
            >
              {/* Status dot */}
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: hasIssues ? "#ef4444" : "#4da862", flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {course.city && course.state ? `${course.city}, ${course.state}` : <span style={{ color: "#ef4444" }}>Missing location</span>}
                  {" · "}{course.holes.length}/{course.holeCount} holes · {course.uploadCount} clips
                </div>
                {hasIssues && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {issues.map(issue => (
                      <span key={issue} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#ef4444" }}>{issue}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {course.isVerified && (
                  <div style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#4da862" }}>Verified</div>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

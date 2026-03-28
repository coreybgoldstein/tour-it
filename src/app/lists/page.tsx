"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type SavedCourse = {
  id: string;
  courseId: string;
  saveType: "PLAYED" | "BUCKET_LIST";
  course: {
    id: string;
    name: string;
    city: string;
    state: string;
    uploadCount: number;
  };
};

export default function ListsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"BUCKET_LIST" | "PLAYED">("BUCKET_LIST");
  const [saves, setSaves] = useState<SavedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: savesData } = await supabase
        .from("Save")
        .select("id, courseId, saveType")
        .eq("userId", user.id)
        .not("courseId", "is", null);

      if (savesData && savesData.length > 0) {
        const courseIds = savesData.map((s: any) => s.courseId);
        const { data: coursesData } = await supabase
          .from("Course")
          .select("id, name, city, state, uploadCount")
          .in("id", courseIds);

        setSaves(savesData.map((s: any) => ({
          ...s,
          course: coursesData?.find((c: any) => c.id === s.courseId) || { id: s.courseId, name: "Unknown", city: "", state: "", uploadCount: 0 },
        })));
      }

      setLoading(false);
    }

    load();
  }, [router]);

  const bucketList = saves.filter(s => s.saveType === "BUCKET_LIST");
  const played = saves.filter(s => s.saveType === "PLAYED");
  const current = tab === "BUCKET_LIST" ? bucketList : played;

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .course-card { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
        .course-card:active { background: rgba(255,255,255,0.03); }
        .course-card:last-child { border-bottom: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "56px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 4 }}>My Lists</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          {bucketList.length} bucket list · {played.length} played
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "12px 20px", gap: 8 }}>
        <button
          onClick={() => setTab("BUCKET_LIST")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === "BUCKET_LIST" ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.05)",
            color: tab === "BUCKET_LIST" ? "#4da862" : "rgba(255,255,255,0.45)",
          }}
        >
          ⛳ Bucket List {bucketList.length > 0 && <span style={{ fontSize: 11, fontWeight: 400 }}>({bucketList.length})</span>}
        </button>
        <button
          onClick={() => setTab("PLAYED")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === "PLAYED" ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.05)",
            color: tab === "PLAYED" ? "#4da862" : "rgba(255,255,255,0.45)",
          }}
        >
          ✓ Played {played.length > 0 && <span style={{ fontSize: 11, fontWeight: 400 }}>({played.length})</span>}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Loading...</div>
      ) : current.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{tab === "BUCKET_LIST" ? "⛳" : "🏌️"}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
            {tab === "BUCKET_LIST" ? "No bucket list courses yet" : "No courses marked as played"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 28 }}>
            {tab === "BUCKET_LIST"
              ? "Find a course you want to play and save it to your bucket list."
              : "Mark courses you've played while browsing them."}
          </div>
          <button
            onClick={() => router.push("/search")}
            style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
          >
            Browse courses
          </button>
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {current.map(s => (
            <div key={s.id} className="course-card" onClick={() => router.push(`/courses/${s.course.id}`)}>
              {/* Course logo placeholder */}
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: tab === "BUCKET_LIST" ? "linear-gradient(135deg,#1a3d4d,#2d5a7a)" : "linear-gradient(135deg,#1a4d22,#2d7a42)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(255,255,255,0.08)",
                fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)",
              }}>
                {s.course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase()}
              </div>

              {/* Course info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.course.name}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {s.course.city}, {s.course.state}
                  {s.course.uploadCount > 0 && (
                    <span style={{ color: "#4da862", marginLeft: 8 }}>{s.course.uploadCount} clips</span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function AddCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [courseType, setCourseType] = useState<"PUBLIC" | "PRIVATE" | "SEMI_PRIVATE" | "">("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim() || !city.trim() || !state) {
      setError("Course name, city, and state are required.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: dbErr } = await supabase.from("CourseRequest").insert({
      id: crypto.randomUUID(),
      userId: user.id,
      name: name.trim(),
      city: city.trim(),
      state,
      courseType: courseType || null,
      websiteUrl: websiteUrl.trim() || null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    });

    if (dbErr) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600,
    color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 6, display: "block",
  };

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", paddingBottom: 100, color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "56px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Add a Course</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Can't find a course? Request it here.</div>
        </div>
      </div>

      {done ? (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Request submitted</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 28, lineHeight: 1.5 }}>We'll review and add the course shortly. You'll be able to upload clips once it's live.</div>
          <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            Back to Search
          </button>
        </div>
      ) : (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Course Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Augusta National Golf Club" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>City *</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Augusta" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>State *</label>
              <select value={state} onChange={e => setState(e.target.value)} style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}>
                <option value="">State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Course Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["PUBLIC", "SEMI_PRIVATE", "PRIVATE"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCourseType(courseType === t ? "" : t)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${courseType === t ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`, background: courseType === t ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.03)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: courseType === t ? "#4da862" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
                >
                  {t === "SEMI_PRIVATE" ? "Semi" : t === "PUBLIC" ? "Public" : "Private"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Website (optional)</label>
            <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any details that might help us find the course..."
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#f87171" }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: "14px", borderRadius: 12, background: loading ? "rgba(45,122,66,0.4)" : "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TEE_COLORS = ["BLACK", "BLUE", "WHITE", "GOLD", "RED", "GREEN"] as const;
type TeeColor = typeof TEE_COLORS[number];

const TEE_HEX: Record<TeeColor, string> = {
  BLACK: "#1a1a1a",
  BLUE: "#2563eb",
  WHITE: "#e5e7eb",
  GOLD: "#d97706",
  RED: "#dc2626",
  GREEN: "#16a34a",
};

type TeeBox = {
  id: string;
  color: TeeColor;
  yardage: number;
  rating: number | null;
  slope: number | null;
};

type Hole = {
  id: string;
  holeNumber: number;
  par: number | null;
  handicapRank: number | null;
  description: string | null;
  teeBoxes: TeeBox[];
};

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  phone: string | null;
  description: string | null;
  holeCount: number;
  isVerified: boolean;
  isPublic: boolean;
  holes: Hole[];
};

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", width: "100%" }}
      />
    </div>
  );
}

function SaveBtn({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{ background: saved ? "rgba(77,168,98,0.2)" : "#2d7a42", border: `1px solid ${saved ? "rgba(77,168,98,0.4)" : "transparent"}`, borderRadius: 8, padding: "8px 18px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saved ? "#4da862" : "#fff", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
    >
      {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
    </button>
  );
}

export default function AdminCourseEditPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    name: "", city: "", state: "", country: "", latitude: "", longitude: "",
    websiteUrl: "", phone: "", description: "", holeCount: "18",
    isVerified: false, isPublic: true,
  });
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseSaved, setCourseSaved] = useState(false);
  const [courseError, setCourseError] = useState("");

  // Per-hole state
  const [holeFormsMap, setHoleFormsMap] = useState<Record<string, {
    par: string; handicapRank: string; description: string;
    teeBoxes: { color: TeeColor; yardage: string; rating: string; slope: string }[];
  }>>({});
  const [holeSaving, setHoleSaving] = useState<Record<string, boolean>>({});
  const [holeSaved, setHoleSaved] = useState<Record<string, boolean>>({});
  const [holeError, setHoleError] = useState<Record<string, string>>({});

  // New hole form
  const [addingHole, setAddingHole] = useState(false);
  const [newHoleNum, setNewHoleNum] = useState("");
  const [newHolePar, setNewHolePar] = useState("4");
  const [newHoleCreating, setNewHoleCreating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", data.user.id).single();
      if (!profile?.isAdmin) { setUnauthorized(true); setLoading(false); return; }

      const { data: row } = await supabase
        .from("Course")
        .select(`id, name, city, state, country, latitude, longitude, websiteUrl, phone, description, holeCount, isVerified, isPublic,
          holes:Hole(id, holeNumber, par, handicapRank, description, teeBoxes:TeeBox(id, color, yardage, rating, slope))`)
        .eq("id", courseId)
        .single();

      if (!row) { setLoading(false); return; }
      const c = row as Course;
      c.holes = c.holes.sort((a, b) => a.holeNumber - b.holeNumber);
      setCourse(c);
      setCourseForm({
        name: c.name || "",
        city: c.city || "",
        state: c.state || "",
        country: c.country || "US",
        latitude: c.latitude?.toString() || "",
        longitude: c.longitude?.toString() || "",
        websiteUrl: c.websiteUrl || "",
        phone: c.phone || "",
        description: c.description || "",
        holeCount: c.holeCount?.toString() || "18",
        isVerified: c.isVerified,
        isPublic: c.isPublic,
      });

      const map: typeof holeFormsMap = {};
      for (const h of c.holes) {
        map[h.id] = {
          par: h.par?.toString() || "",
          handicapRank: h.handicapRank?.toString() || "",
          description: h.description || "",
          teeBoxes: h.teeBoxes.map(tb => ({
            color: tb.color,
            yardage: tb.yardage?.toString() || "",
            rating: tb.rating?.toString() || "",
            slope: tb.slope?.toString() || "",
          })),
        };
      }
      setHoleFormsMap(map);
      setLoading(false);
    });
  }, [courseId]);

  const saveCourse = async () => {
    setCourseSaving(true); setCourseError(""); setCourseSaved(false);
    const supabase = createClient();
    const { error } = await supabase.from("Course").update({
      name: courseForm.name,
      city: courseForm.city,
      state: courseForm.state,
      country: courseForm.country,
      latitude: courseForm.latitude ? parseFloat(courseForm.latitude) : null,
      longitude: courseForm.longitude ? parseFloat(courseForm.longitude) : null,
      websiteUrl: courseForm.websiteUrl || null,
      phone: courseForm.phone || null,
      description: courseForm.description || null,
      holeCount: parseInt(courseForm.holeCount) || 18,
      isVerified: courseForm.isVerified,
      isPublic: courseForm.isPublic,
    }).eq("id", courseId);
    setCourseSaving(false);
    if (error) { setCourseError(error.message); return; }
    setCourseSaved(true);
    setTimeout(() => setCourseSaved(false), 3000);
  };

  const saveHole = async (holeId: string) => {
    const form = holeFormsMap[holeId];
    if (!form) return;
    setHoleSaving(p => ({ ...p, [holeId]: true }));
    setHoleError(p => ({ ...p, [holeId]: "" }));
    setHoleSaved(p => ({ ...p, [holeId]: false }));
    const supabase = createClient();

    const { error: holeErr } = await supabase.from("Hole").update({
      par: form.par ? parseInt(form.par) : null,
      handicapRank: form.handicapRank ? parseInt(form.handicapRank) : null,
      description: form.description || null,
    }).eq("id", holeId);

    if (holeErr) {
      setHoleSaving(p => ({ ...p, [holeId]: false }));
      setHoleError(p => ({ ...p, [holeId]: holeErr.message }));
      return;
    }

    // Upsert each tee box
    for (const tb of form.teeBoxes) {
      if (!tb.yardage) continue;
      await supabase.from("TeeBox").upsert({
        courseId,
        holeId,
        color: tb.color,
        yardage: parseInt(tb.yardage),
        rating: tb.rating ? parseFloat(tb.rating) : null,
        slope: tb.slope ? parseInt(tb.slope) : null,
      }, { onConflict: "holeId,color" });
    }

    // Remove tee boxes where yardage was cleared
    const hole = course?.holes.find(h => h.id === holeId);
    if (hole) {
      for (const existing of hole.teeBoxes) {
        const inForm = form.teeBoxes.find(tb => tb.color === existing.color);
        if (!inForm || !inForm.yardage) {
          await supabase.from("TeeBox").delete().eq("id", existing.id);
        }
      }
    }

    setHoleSaving(p => ({ ...p, [holeId]: false }));
    setHoleSaved(p => ({ ...p, [holeId]: true }));
    setTimeout(() => setHoleSaved(p => ({ ...p, [holeId]: false })), 3000);
  };

  const updateHoleField = (holeId: string, field: string, value: string) => {
    setHoleFormsMap(p => ({ ...p, [holeId]: { ...p[holeId], [field]: value } }));
  };

  const updateTeebox = (holeId: string, color: TeeColor, field: string, value: string) => {
    setHoleFormsMap(p => {
      const existing = p[holeId].teeBoxes.find(tb => tb.color === color);
      if (existing) {
        return { ...p, [holeId]: { ...p[holeId], teeBoxes: p[holeId].teeBoxes.map(tb => tb.color === color ? { ...tb, [field]: value } : tb) } };
      }
      return { ...p, [holeId]: { ...p[holeId], teeBoxes: [...p[holeId].teeBoxes, { color, yardage: "", rating: "", slope: "", [field]: value }] } };
    });
  };

  const createHole = async () => {
    if (!newHoleNum || !newHolePar) return;
    setNewHoleCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("Hole").insert({
      courseId,
      holeNumber: parseInt(newHoleNum),
      par: parseInt(newHolePar),
    }).select("id, holeNumber, par, handicapRank, description, teeBoxes:TeeBox(id, color, yardage, rating, slope)").single();

    if (!error && data) {
      const newHole = data as Hole;
      setCourse(c => c ? { ...c, holes: [...c.holes, newHole].sort((a, b) => a.holeNumber - b.holeNumber) } : c);
      setHoleFormsMap(p => ({ ...p, [newHole.id]: { par: newHolePar, handicapRank: "", description: "", teeBoxes: [] } }));
      setNewHoleNum(""); setNewHolePar("4"); setAddingHole(false);
    }
    setNewHoleCreating(false);
  };

  const deleteHole = async (holeId: string) => {
    if (!confirm("Delete this hole and all its tee box data?")) return;
    const supabase = createClient();
    await supabase.from("Hole").delete().eq("id", holeId);
    setCourse(c => c ? { ...c, holes: c.holes.filter(h => h.id !== holeId) } : c);
    setHoleFormsMap(p => { const next = { ...p }; delete next[holeId]; return next; });
  };

  if (loading) return (
    <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</div>
    </div>
  );

  if (unauthorized || !course) return (
    <div style={{ minHeight: "100svh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", color: "#ef4444", fontSize: 14 }}>{unauthorized ? "Not authorized." : "Course not found."}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: "52px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, background: "#07100a", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/admin/courses")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{course.holes.length} holes · {course.holeCount} expected</div>
          </div>
          <a href={`/courses/${courseId}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4da862", textDecoration: "none", whiteSpace: "nowrap" }}>View →</a>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Course Info ── */}
        <section style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Course Info</div>

          <Field label="Name" value={courseForm.name} onChange={v => setCourseForm(p => ({ ...p, name: v }))} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="City" value={courseForm.city} onChange={v => setCourseForm(p => ({ ...p, city: v }))} placeholder="e.g. Boca Raton" />
            <Field label="State" value={courseForm.state} onChange={v => setCourseForm(p => ({ ...p, state: v }))} placeholder="e.g. FL" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Country" value={courseForm.country} onChange={v => setCourseForm(p => ({ ...p, country: v }))} />
            <Field label="Hole Count" value={courseForm.holeCount} onChange={v => setCourseForm(p => ({ ...p, holeCount: v }))} type="number" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Latitude" value={courseForm.latitude} onChange={v => setCourseForm(p => ({ ...p, latitude: v }))} type="number" placeholder="26.3683" />
            <Field label="Longitude" value={courseForm.longitude} onChange={v => setCourseForm(p => ({ ...p, longitude: v }))} type="number" placeholder="-80.1289" />
          </div>

          <Field label="Website" value={courseForm.websiteUrl} onChange={v => setCourseForm(p => ({ ...p, websiteUrl: v }))} placeholder="https://…" />
          <Field label="Phone" value={courseForm.phone} onChange={v => setCourseForm(p => ({ ...p, phone: v }))} placeholder="(555) 555-5555" />

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</label>
            <textarea
              value={courseForm.description}
              onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="A brief description of the course…"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", resize: "vertical", width: "100%" }}
            />
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", gap: 10 }}>
            {[{ key: "isVerified" as const, label: "Verified" }, { key: "isPublic" as const, label: "Public" }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCourseForm(p => ({ ...p, [key]: !p[key] }))}
                style={{ background: courseForm[key] ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${courseForm[key] ? "rgba(77,168,98,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: courseForm[key] ? "#4da862" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
              >
                {courseForm[key] ? "✓ " : ""}{label}
              </button>
            ))}
          </div>

          {courseError && <div style={{ fontSize: 12, color: "#ef4444" }}>{courseError}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SaveBtn onClick={saveCourse} saving={courseSaving} saved={courseSaved} />
          </div>
        </section>

        {/* ── Scorecard / Holes ── */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>Scorecard</div>
            <button
              onClick={() => setAddingHole(a => !a)}
              style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer" }}
            >
              + Add Hole
            </button>
          </div>

          {addingHole && (
            <div style={{ background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, padding: 14, marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Hole #</label>
                <input type="number" value={newHoleNum} onChange={e => setNewHoleNum(e.target.value)} min="1" max="18"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Par</label>
                <select value={newHolePar} onChange={e => setNewHolePar(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}>
                  {[3, 4, 5].map(p => <option key={p} value={p} style={{ background: "#07100a" }}>{p}</option>)}
                </select>
              </div>
              <button onClick={createHole} disabled={newHoleCreating || !newHoleNum}
                style={{ background: "#2d7a42", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: newHoleCreating || !newHoleNum ? 0.5 : 1 }}>
                {newHoleCreating ? "…" : "Create"}
              </button>
              <button onClick={() => setAddingHole(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>✕</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {course.holes.map(hole => {
              const form = holeFormsMap[hole.id];
              if (!form) return null;
              return (
                <div key={hole.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
                  {/* Hole header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 4, padding: "3px 8px", fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 700 }}>
                      {hole.holeNumber}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                      {form.par ? `Par ${form.par}` : <span style={{ color: "#ef4444" }}>No par set</span>}
                      {form.handicapRank ? ` · Hdcp ${form.handicapRank}` : ""}
                    </div>
                    <button onClick={() => deleteHole(hole.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(239,68,68,0.4)", cursor: "pointer", fontSize: 12, padding: 0 }}>Delete</button>
                  </div>

                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Par + Handicap */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Par</label>
                        <select value={form.par} onChange={e => updateHoleField(hole.id, "par", e.target.value)}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}>
                          <option value="" style={{ background: "#07100a" }}>—</option>
                          {[3, 4, 5].map(p => <option key={p} value={p} style={{ background: "#07100a" }}>{p}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Handicap Rank</label>
                        <select value={form.handicapRank} onChange={e => updateHoleField(hole.id, "handicapRank", e.target.value)}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}>
                          <option value="" style={{ background: "#07100a" }}>—</option>
                          {Array.from({ length: 18 }, (_, i) => i + 1).map(n => <option key={n} value={n} style={{ background: "#07100a" }}>{n}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Tee Boxes */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Tee Boxes (yardage)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {TEE_COLORS.map(color => {
                          const tb = form.teeBoxes.find(t => t.color === color);
                          return (
                            <div key={color} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px", gap: 6, alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEE_HEX[color], border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "capitalize" }}>{color.charAt(0) + color.slice(1).toLowerCase()}</span>
                              </div>
                              <input type="number" placeholder="yds" value={tb?.yardage || ""}
                                onChange={e => updateTeebox(hole.id, color, "yardage", e.target.value)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                              <input type="number" placeholder="rating" step="0.1" value={tb?.rating || ""}
                                onChange={e => updateTeebox(hole.id, color, "rating", e.target.value)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                              <input type="number" placeholder="slope" value={tb?.slope || ""}
                                onChange={e => updateTeebox(hole.id, color, "slope", e.target.value)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                            </div>
                          );
                        })}
                        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px", gap: 6 }}>
                          <div />
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", paddingLeft: 2 }}>Yardage</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", paddingLeft: 2 }}>Rating</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", paddingLeft: 2 }}>Slope</div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes / Description</label>
                      <textarea value={form.description} onChange={e => updateHoleField(hole.id, "description", e.target.value)}
                        rows={2} placeholder="Any notes about this hole…"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none", resize: "vertical", width: "100%" }} />
                    </div>

                    {holeError[hole.id] && <div style={{ fontSize: 12, color: "#ef4444" }}>{holeError[hole.id]}</div>}

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <SaveBtn onClick={() => saveHole(hole.id)} saving={!!holeSaving[hole.id]} saved={!!holeSaved[hole.id]} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

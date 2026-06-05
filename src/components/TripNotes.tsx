"use client";

// Trip Notes — collaborative knowledge layer on a GolfTrip. Every
// trip member can add categorized notes (best clubhouses, food spots,
// weather observations, logistics tips, etc.). When the trip is
// eventually publicized, these notes carry over as the rich content
// for the new TripItinerary.
//
// Renders inline on /trips/[id]. State + CRUD are self-contained.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SectionAddButton } from "@/components/SectionAddButton";

type Note = {
  id: string;
  tripId: string;
  userId: string;
  category: string;
  subject: string | null;
  body: string;
  createdAt: string;
  user?: { displayName: string; username: string; avatarUrl: string | null };
};

const CATEGORIES: Array<{ id: string; label: string; emoji: string; description: string }> = [
  { id: "clubhouse",  label: "Clubhouse",     emoji: "🏛️", description: "Bar, pro shop, halfway house — what's worth knowing" },
  { id: "food",       label: "Food + drink",  emoji: "🍔", description: "Restaurants, bars, must-eats near the courses" },
  { id: "weather",    label: "Weather",       emoji: "🌤️", description: "Wind patterns, rain windows, what to expect" },
  { id: "course",     label: "Course tip",    emoji: "⛳", description: "Tee box choice, signature hole, local rules" },
  { id: "logistics",  label: "Logistics",     emoji: "🚗", description: "Parking, transfers, time between stops" },
  { id: "tip",        label: "General tip",   emoji: "💡", description: "Anything else future golfers should know" },
  { id: "other",      label: "Other",         emoji: "📝", description: "Doesn't fit anywhere else" },
];

export default function TripNotes({ tripId, currentUserId, canEdit }: { tripId: string; currentUserId: string | null; canEdit: boolean }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [category, setCategory] = useState<string>("food");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("GolfTripNote")
      .select("id, tripId, userId, category, subject, body, createdAt, user:User!GolfTripNote_userId_fkey(displayName, username, avatarUrl)")
      .eq("tripId", tripId)
      .order("createdAt", { ascending: false });
    setNotes((data ?? []) as unknown as Note[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function handleSave() {
    if (!currentUserId) { setError("Sign in to add notes."); return; }
    if (!body.trim()) { setError("Add some content for the note."); return; }
    setError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error: insErr } = await supabase.from("GolfTripNote").insert({
        id,
        tripId,
        userId: currentUserId,
        category,
        subject: subject.trim() || null,
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
      });
      if (insErr) throw insErr;
      setAddOpen(false);
      setSubject("");
      setBody("");
      setCategory("food");
      await fetchNotes();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    const supabase = createClient();
    await supabase.from("GolfTripNote").delete().eq("id", noteId);
    setConfirmDeleteId(null);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  const grouped = CATEGORIES.map((c) => ({ ...c, items: notes.filter((n) => n.category === c.id) }))
    .filter((g) => g.items.length > 0);
  const totalNotes = notes.length;

  return (
    <>
      <div style={{ marginTop: 24, marginBottom: 8, padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Trip Notes{totalNotes > 0 && <span className="count">{totalNotes}</span>}</div>
          {canEdit && (
            <SectionAddButton onClick={() => setAddOpen(true)} label="Add note" />
          )}
        </div>

        {loading && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", padding: "16px 0" }}>Loading notes…</div>
        )}

        {!loading && totalNotes === 0 && (
          <div style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              No notes yet. {canEdit ? "Drop the first one — best food, best clubhouse, weather pattern, anything future golfers would want to know." : "Trip members haven't added any notes yet."}
            </div>
          </div>
        )}

        {grouped.map((g) => {
          const expanded = expandedCategory === g.id;
          const visible = expanded ? g.items : g.items.slice(0, 1);
          return (
            <div key={g.id} style={{ marginBottom: 10, background: "rgba(10,28,18,0.5)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{g.emoji}</span>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4da862" }}>{g.label}</div>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>· {g.items.length}</span>
                </div>
                {g.items.length > 1 && (
                  <button
                    onClick={() => setExpandedCategory(expanded ? null : g.id)}
                    style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    {expanded ? "Show less" : `Show all ${g.items.length}`}
                  </button>
                )}
              </div>
              {visible.map((n) => (
                <div key={n.id} style={{ paddingTop: 8, paddingBottom: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {n.subject && (
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{n.subject}</div>
                  )}
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      @{n.user?.username ?? "—"} · {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    {n.userId === currentUserId && (
                      confirmDeleteId === n.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Cancel</button>
                          <button onClick={() => handleDelete(n.id)} style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 6, padding: "3px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(220,100,100,0.9)", cursor: "pointer" }}>Delete</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(n.id)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif", fontSize: 10.5, cursor: "pointer" }}>Delete</button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {addOpen && (
        <>
          <div onClick={() => !saving && setAddOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201, background: "#0d2318", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "16px 20px calc(28px + env(safe-area-inset-bottom))", maxHeight: "88dvh", overflowY: "auto", borderTop: "1px solid rgba(77,168,98,0.3)" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99, margin: "0 auto 14px" }} />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.75)", marginBottom: 3 }}>New note</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Tell the group</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.45)", marginTop: 4, lineHeight: 1.45 }}>
                Add tips, observations, or recommendations. Other trip members (and future golfers if the trip goes public) will see this.
              </div>
            </div>

            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {CATEGORIES.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 99,
                      border: `1px solid ${active ? "rgba(77,168,98,0.55)" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "rgba(77,168,98,0.2)" : "rgba(255,255,255,0.03)",
                      color: active ? "#4da862" : "rgba(255,255,255,0.65)",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{c.emoji}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.4, paddingLeft: 2 }}>
              {CATEGORIES.find((c) => c.id === category)?.description}
            </div>

            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Subject <span style={{ fontWeight: 400 }}>(optional)</span></div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={category === "food" ? "e.g. Drum & Quill" : category === "course" ? "e.g. No. 2 — 5th hole" : "Short title"}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", marginBottom: 12 }}
            />

            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Note *</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What should we know?"
              rows={4}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", resize: "vertical" }}
            />

            {error && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#ff7575", marginTop: 12, padding: "8px 12px", background: "rgba(255,90,90,0.06)", border: "1px solid rgba(255,90,90,0.22)", borderRadius: 8 }}>{error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !body.trim()}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "13px",
                background: !body.trim() ? "rgba(45,122,66,0.4)" : "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontFamily: "'Outfit', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: saving || !body.trim() ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: !body.trim() ? "none" : "0 4px 16px rgba(45,122,66,0.35)",
              }}
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

"use client";

// "Plan My Trip" multi-input sheet. One form → submit → AI ranks the
// catalog and returns 3-5 matches with reasoning. Lives in the /search
// Trips tab as the hero CTA.
//
// Design constraints (per project rules):
// - Bottom-sheet pattern (.tourit-sheet) — never center-screen modal
// - No native alerts; toasts only
// - LLM call must include user's months — Phase 3 planner is seasonality-aware

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BEST_FOR_TAGS } from "@/lib/tripEnrichment";

type Recommendation = {
  slug: string;
  name: string;
  tagline: string;
  heroImageUrl: string | null;
  region: string;
  durationDays: number;
  costBand: string;
  matchScore: number;
  reasoning: string;
  caveat?: string;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GROUP_PRESETS = [
  { value: 2, label: "1-2", desc: "Couple / solo" },
  { value: 4, label: "3-4", desc: "Foursome" },
  { value: 8, label: "5-8", desc: "Big buddies trip" },
  { value: 12, label: "9+", desc: "Bachelor / corporate" },
];

const BUDGET_PRESETS = [
  { value: 800, label: "$500-1k", desc: "Budget bender" },
  { value: 1500, label: "$1k-2k", desc: "Solid buddy trip" },
  { value: 2500, label: "$2-3k", desc: "Resort-level" },
  { value: 4000, label: "$3k+", desc: "Bucket-list" },
];

const DURATION_PRESETS = [
  { value: 2, label: "Weekend" },
  { value: 3, label: "3 days" },
  { value: 4, label: "4 days" },
  { value: 5, label: "5+ days" },
];

const ROUNDS_PRESETS = [
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5+" },
];

export default function TripPlannerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  // Default months = current month + next 5 (so the planner defaults to
  // "in the next ~6 months"), but the user can clear and pick anything.
  const defaultMonths = (() => {
    const now = new Date().getMonth() + 1;
    return [now, now + 1, now + 2].map((m) => ((m - 1) % 12) + 1);
  })();

  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [rounds, setRounds] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [months, setMonths] = useState<number[]>(defaultMonths);
  const [vibes, setVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function toggleVibe(tag: string) {
    setVibes((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  function reset() {
    setRecs(null);
    setExplanation(null);
    setError(null);
  }

  function fullReset() {
    reset();
    setGroupSize(null);
    setBudget(null);
    setDays(null);
    setRounds(null);
    setOrigin("");
    setMonths(defaultMonths);
    setVibes([]);
    setNotes("");
  }

  async function handleSubmit() {
    if (months.length === 0) {
      setError("Pick at least one month so we know when you're going.");
      return;
    }
    setError(null);
    setSubmitting(true);
    reset();
    try {
      const res = await fetch("/api/trip-planner/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupSize,
          budgetPerPerson: budget,
          originCity: origin.trim() || undefined,
          rounds,
          days,
          months,
          vibes,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { explanation: string; recommendations: Recommendation[] };
      setExplanation(data.explanation);
      setRecs(data.recommendations ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Planner is offline. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div onClick={() => !submitting && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200 }} />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          top: 80,
          zIndex: 201,
          background: "#0d2318",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "16px 0 0",
          borderTop: "1px solid rgba(77,168,98,0.25)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99, margin: "0 auto 14px" }} />

        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 28px", WebkitOverflowScrolling: "touch" }}>
          {!recs && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Plan my trip</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Tell us about your group. We'll match it to the catalog.</div>
                </div>
              </div>

              <SectionLabel>Group size</SectionLabel>
              <ChipRow>
                {GROUP_PRESETS.map((p) => (
                  <Chip key={p.value} active={groupSize === p.value} onClick={() => setGroupSize(groupSize === p.value ? null : p.value)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>{p.desc}</div>
                  </Chip>
                ))}
              </ChipRow>

              <SectionLabel>Budget per person</SectionLabel>
              <ChipRow>
                {BUDGET_PRESETS.map((p) => (
                  <Chip key={p.value} active={budget === p.value} onClick={() => setBudget(budget === p.value ? null : p.value)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>{p.desc}</div>
                  </Chip>
                ))}
              </ChipRow>

              <SectionLabel>Trip length</SectionLabel>
              <ChipRow>
                {DURATION_PRESETS.map((p) => (
                  <Chip key={p.value} active={days === p.value} onClick={() => setDays(days === p.value ? null : p.value)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
                  </Chip>
                ))}
              </ChipRow>

              <SectionLabel>Rounds you want to play</SectionLabel>
              <ChipRow>
                {ROUNDS_PRESETS.map((p) => (
                  <Chip key={p.value} active={rounds === p.value} onClick={() => setRounds(rounds === p.value ? null : p.value)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
                  </Chip>
                ))}
              </ChipRow>

              <SectionLabel>When are you going?</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {MONTH_LABELS.map((label, i) => {
                  const m = i + 1;
                  const active = months.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleMonth(m)}
                      style={{
                        padding: "9px 0",
                        borderRadius: 8,
                        border: `1px solid ${active ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`,
                        background: active ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.03)",
                        color: active ? "#4da862" : "rgba(255,255,255,0.55)",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <SectionLabel>Vibe (tap as many as fit)</SectionLabel>
              <ChipRow wrap>
                {BEST_FOR_TAGS.map((t) => (
                  <Chip key={t.id} active={vibes.includes(t.id)} onClick={() => toggleVibe(t.id)} compact>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  </Chip>
                ))}
              </ChipRow>

              <SectionLabel>Flying from (city or airport)</SectionLabel>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. NYC, LAX, Atlanta"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "#fff",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  outline: "none",
                }}
              />

              <SectionLabel>Anything else? (optional)</SectionLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. good bars, walking only, no carts, beach for non-golfers, public courses only"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "#fff",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                }}
              />

              {error && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#ff7575", marginTop: 14, padding: "8px 12px", background: "rgba(255,90,90,0.06)", border: "1px solid rgba(255,90,90,0.25)", borderRadius: 10 }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  marginTop: 22,
                  background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "wait" : "pointer",
                  boxShadow: "0 4px 16px rgba(45,122,66,0.35)",
                  opacity: submitting ? 0.7 : 1,
                  letterSpacing: "0.02em",
                }}
              >
                {submitting ? "Matching your trip…" : "Plan my trip"}
              </button>
            </>
          )}

          {recs && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Your matches</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 1.5 }}>{explanation}</div>
                </div>
                <button
                  onClick={fullReset}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "6px 12px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 12 }}
                >
                  Redo
                </button>
              </div>

              {recs.length === 0 && (
                <div style={{ padding: "24px 14px", textAlign: "center", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit', sans-serif", fontSize: 13.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  No matches yet. Try widening your dates or budget.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recs.map((r, idx) => (
                  <button
                    key={r.slug}
                    onClick={() => {
                      onClose();
                      router.push(`/trip-ideas/${r.slug}`);
                    }}
                    style={{
                      position: "relative",
                      width: "100%",
                      background: "rgba(10,28,18,0.6)",
                      border: "1px solid rgba(77,168,98,0.25)",
                      borderRadius: 16,
                      overflow: "hidden",
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {r.heroImageUrl && (
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.heroImageUrl} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0) 50%, rgba(7,16,10,0.7) 100%)" }} />
                        <div style={{ position: "absolute", left: 12, top: 12, display: "flex", gap: 6 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "#fff", padding: "3px 9px", borderRadius: 99, background: "rgba(45,122,66,0.95)", border: "1px solid rgba(77,168,98,0.7)" }}>
                            #{idx + 1} · {r.matchScore}% MATCH
                          </span>
                        </div>
                        <div style={{ position: "absolute", right: 12, top: 12, display: "flex", gap: 6 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#4da862", padding: "3px 8px", borderRadius: 99, background: "rgba(7,16,10,0.7)", border: "1px solid rgba(77,168,98,0.4)" }}>
                            {r.durationDays} DAYS · {r.costBand}
                          </span>
                        </div>
                      </div>
                    )}
                    <div style={{ padding: "14px 14px 16px" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>{r.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.55, fontStyle: "italic", marginBottom: r.caveat ? 8 : 0 }}>
                        {r.reasoning}
                      </div>
                      {r.caveat && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(240,140,90,0.85)", lineHeight: 1.4, padding: "5px 10px", background: "rgba(240,140,90,0.07)", border: "1px solid rgba(240,140,90,0.18)", borderRadius: 8, marginTop: 4 }}>
                          ⚠ {r.caveat}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.75)", marginTop: 18, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function ChipRow({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: wrap ? "wrap" : "nowrap", overflowX: wrap ? "visible" : "auto", paddingBottom: wrap ? 0 : 4 }}>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, compact }: { active: boolean; onClick: () => void; children: React.ReactNode; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: compact ? "0 0 auto" : "1 0 auto",
        padding: compact ? "6px 12px" : "9px 14px",
        borderRadius: compact ? 99 : 12,
        border: `1px solid ${active ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`,
        background: active ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.03)",
        color: active ? "#4da862" : "rgba(255,255,255,0.7)",
        fontFamily: "'Outfit', sans-serif",
        textAlign: "center",
        cursor: "pointer",
        whiteSpace: "nowrap",
        minWidth: compact ? 0 : 70,
      }}
    >
      {children}
    </button>
  );
}

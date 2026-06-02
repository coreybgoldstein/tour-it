"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// Score-entry bottom sheet. Two ways in:
//   1. Scan — photograph a paper scorecard OR screenshot a score app
//      (GHIN etc). One AI route classifies + extracts; we fuzzy-match the
//      names it reads onto this game's players and fill the grid.
//   2. Manual — type straight into the grid.
// On save we write each matched player's Round ledger row and the full
// per-player score map onto the game (settlement reads it in Phase 3).

type SheetGame = {
  id: string;
  courseId: string;
  courseName: string;
  players: { userId?: string | null; displayName: string }[];
  holeHandicaps?: number[] | null;
};

type GhinStats = {
  scoreToPar: number | null; greensInReg: number | null; fairwaysHit: number | null;
  fairwaysPossible: number | null; putts: number | null; courseRating: number | null;
  slope: number | null; tee: string | null;
};

type Row = {
  key: string;
  userId: string | null;
  name: string;
  holeScores: (number | null)[];
  stats: GhinStats | null;
};

// Loose name match: lowercase, strip non-alphanumerics, then compare on
// full string, first-name token, or prefix. Returns a 0–1 score so the
// caller can pick the best candidate.
function nameScore(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const fa = na.split(/\s+/)[0], fb = nb.split(/\s+/)[0];
  if (fa && fa === fb) return 0.8;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.7;
  if (fa && (na.includes(fb) || nb.includes(fa))) return 0.5;
  return 0;
}

const sum = (a: (number | null)[]) => a.reduce((s: number, v) => (typeof v === "number" ? s + v : s), 0);

export default function ScoreEntrySheet({
  game, tripId, golfTripId, roundDate, onClose, onSaved,
}: {
  game: SheetGame;
  tripId: string;
  golfTripId: string;
  roundDate: string;
  onClose: () => void;
  onSaved: (scoreMap: Record<string, (number | null)[]>) => void;
}) {
  const holeCount = game.holeHandicaps?.length && game.holeHandicaps.length > 0 ? game.holeHandicaps.length : 18;
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [par, setPar] = useState<(number | null)[]>(Array(holeCount).fill(null));
  const [rows, setRows] = useState<Row[]>(
    game.players.map(p => ({
      key: p.userId || p.displayName,
      userId: p.userId ?? null,
      name: p.displayName,
      holeScores: Array(holeCount).fill(null),
      stats: null,
    }))
  );
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("Hole").select("holeNumber, par").eq("courseId", game.courseId).order("holeNumber");
      if (!data) return;
      const arr = Array<number | null>(holeCount).fill(null);
      for (const h of data as { holeNumber: number; par: number | null }[]) {
        if (h.holeNumber >= 1 && h.holeNumber <= holeCount) arr[h.holeNumber - 1] = h.par;
      }
      setPar(arr);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCell = useCallback((rowKey: string, hole: number, value: string) => {
    const n = value === "" ? null : parseInt(value, 10);
    setRows(prev => prev.map(r => {
      if (r.key !== rowKey) return r;
      const next = r.holeScores.slice();
      next[hole] = n !== null && Number.isFinite(n) && n > 0 ? n : null;
      return { ...r, holeScores: next };
    }));
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setNote(null);
    setScanning(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `scorecards/scores-${game.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const imageUrl = supabase.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/rounds/score-extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Couldn't read that image");

      if (Array.isArray(data.par)) setPar((data.par as (number | null)[]).slice(0, holeCount));

      const extracted: { name: string; holeScores: (number | null)[] }[] = data.players || [];
      const ghinStats: GhinStats | null = data.kind === "ghin" ? (data.stats ?? null) : null;

      // Greedily assign each extracted player to the best-matching unfilled
      // game row. Anything that matches nothing becomes a guest row.
      setRows(prev => {
        const next = prev.map(r => ({ ...r, holeScores: r.holeScores.slice() }));
        const used = new Set<number>();
        let appliedToKnown = 0;
        const guests: Row[] = [];
        for (const ex of extracted) {
          let bestIdx = -1, best = 0;
          next.forEach((r, i) => {
            if (used.has(i)) return;
            const s = nameScore(ex.name, r.name);
            if (s > best) { best = s; bestIdx = i; }
          });
          if (bestIdx >= 0 && best >= 0.5) {
            used.add(bestIdx);
            next[bestIdx].holeScores = ex.holeScores.slice(0, holeCount);
            if (ghinStats) next[bestIdx].stats = ghinStats;
            appliedToKnown++;
          } else {
            guests.push({
              key: ex.name, userId: null, name: ex.name,
              holeScores: ex.holeScores.slice(0, holeCount),
              stats: ghinStats,
            });
          }
        }
        const msg = data.kind === "ghin"
          ? "Read your score screenshot — review below."
          : `Read ${extracted.length} player${extracted.length === 1 ? "" : "s"} from the card${guests.length ? ` (${guests.length} unmatched — assign or keep as guest)` : ""}.`;
        setNote(msg);
        return [...next, ...guests];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  // Reassign a guest row to one of the game's app players (or back to guest).
  function assignRow(rowKey: string, userId: string | null) {
    setRows(prev => prev.map(r => {
      if (r.key !== rowKey) return r;
      if (!userId) return { ...r, userId: null };
      const gp = game.players.find(p => p.userId === userId);
      return { ...r, userId, name: gp?.displayName || r.name };
    }));
  }

  async function save() {
    setError(null);
    const filled = rows.filter(r => r.holeScores.some(v => typeof v === "number"));
    if (filled.length === 0) { setError("Enter at least one score"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/rounds/score-save", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          golfTripId,
          courseId: game.courseId,
          date: roundDate,
          tripGameId: game.id,
          par,
          source: "manual",
          players: filled.map(r => ({
            key: r.userId || r.name,
            userId: r.userId,
            name: r.name,
            holeScores: r.holeScores,
            stats: r.stats,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed");
      const scoreMap: Record<string, (number | null)[]> = {};
      for (const r of filled) scoreMap[r.userId || r.name] = r.holeScores;
      onSaved(scoreMap);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const CELL = 34;
  const holes = Array.from({ length: holeCount }, (_, i) => i + 1);
  const unassignedUserIds = new Set(
    game.players.map(p => p.userId).filter(Boolean) as string[]
  );
  for (const r of rows) if (r.userId) unassignedUserIds.delete(r.userId);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 260, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Enter Scores</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{game.courseName} · {holeCount} holes</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px 8px" }}>
          {/* Scan button */}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            style={{ width: "100%", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 12, padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#4da862", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {scanning ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" style={{ animation: "tourit-spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Reading image…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Scan scorecard or screenshot
              </>
            )}
          </button>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", margin: "8px 0 4px" }}>or type scores in below</div>

          {note && (
            <div style={{ background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 10, padding: "9px 12px", margin: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>{note}</div>
          )}

          {/* Score grid */}
          <div style={{ overflowX: "auto", marginTop: 10, WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "inline-flex", flexDirection: "column", minWidth: "100%" }}>
              {/* Hole-number header */}
              <div style={{ display: "flex" }}>
                <div style={{ width: 96, flexShrink: 0 }} />
                {holes.map(h => (
                  <div key={h} style={{ width: CELL, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", paddingBottom: 4 }}>{h}</div>
                ))}
                <div style={{ width: CELL + 6, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", paddingBottom: 4 }}>Tot</div>
              </div>
              {/* Par row */}
              {par.some(p => p != null) && (
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <div style={{ width: 96, flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>Par</div>
                  {holes.map((h, i) => (
                    <div key={h} style={{ width: CELL, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{par[i] ?? "·"}</div>
                  ))}
                  <div style={{ width: CELL + 6, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{sum(par) || ""}</div>
                </div>
              )}
              {/* Player rows */}
              {rows.map(r => {
                const total = sum(r.holeScores);
                return (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ width: 96, flexShrink: 0, paddingRight: 6 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: r.userId ? "#fff" : "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      {!r.userId && (
                        <select
                          value=""
                          onChange={e => assignRow(r.key, e.target.value || null)}
                          style={{ marginTop: 2, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontFamily: "'Outfit', sans-serif", fontSize: 10, padding: "2px 4px" }}
                        >
                          <option value="">Guest — assign…</option>
                          {game.players.filter(p => p.userId && unassignedUserIds.has(p.userId)).map(p => (
                            <option key={p.userId} value={p.userId!}>{p.displayName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {holes.map((h, i) => (
                      <input
                        key={h}
                        inputMode="numeric"
                        value={r.holeScores[i] ?? ""}
                        onChange={e => setCell(r.key, i, e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                        style={{ width: CELL - 4, marginRight: 4, height: 30, textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600 }}
                      />
                    ))}
                    <div style={{ width: CELL + 6, flexShrink: 0, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: total > 0 ? "#4da862" : "rgba(255,255,255,0.25)" }}>{total > 0 ? total : "–"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{ color: "#e57373", fontFamily: "'Outfit', sans-serif", fontSize: 13, marginTop: 10 }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ width: "100%", background: saving ? "rgba(77,168,98,0.4)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Save Scores"}
          </button>
        </div>
        <style>{`@keyframes tourit-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

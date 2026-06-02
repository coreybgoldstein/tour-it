"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { settleGame, netFromWinners, type SettlePlayer, type NetEntry } from "@/lib/settleGame";

// Confirm-before-write settlement. Runs the pure engine on the game's saved
// scores, shows proposed winners + net $, lets the user override a winner
// (for the winner-driven money formats), then writes formatConfig.winners +
// TripGame.settlement on confirm.

type SheetGame = {
  id: string;
  courseId: string;
  courseName: string;
  format: string;
  formatConfig: Record<string, unknown>;
  players: any[];
  holeHandicaps?: number[] | null;
  scores?: Record<string, (number | null)[]> | null;
};

const WINNER_DRIVEN = new Set(["nassau", "best_ball"]);

export default function SettlementSheet({
  game, onClose, onConfirmed,
}: {
  game: SheetGame;
  onClose: () => void;
  onConfirmed: (winners: Record<string, string>, settlement: any) => void;
}) {
  const holeCount = game.holeHandicaps?.length && game.holeHandicaps.length > 0 ? game.holeHandicaps.length : 18;
  const supabase = createClient();
  const players: SettlePlayer[] = (game.players || []).map((p: any) => ({
    userId: p.userId ?? null, displayName: p.displayName, teamId: p.teamId ?? null, strokeHoles: p.strokeHoles ?? [],
  }));
  const scores = game.scores || {};

  const [par, setPar] = useState<(number | null)[] | null>(null);
  const [parLoaded, setParLoaded] = useState(false);
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("Hole").select("holeNumber, par").eq("courseId", game.courseId).order("holeNumber");
      if (data) {
        const arr = Array<number | null>(holeCount).fill(null);
        for (const h of data as { holeNumber: number; par: number | null }[]) {
          if (h.holeNumber >= 1 && h.holeNumber <= holeCount) arr[h.holeNumber - 1] = h.par;
        }
        setPar(arr);
      }
      setParLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proposal = useMemo(
    () => settleGame({ format: game.format, formatConfig: game.formatConfig, players, scores, holeCount, par }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parLoaded],
  );

  // Seed editable winners from the proposal once it's computed.
  useEffect(() => { setWinners(proposal.winners); }, [proposal]);

  const isWinnerDriven = WINNER_DRIVEN.has(game.format);

  // Net $: winner-driven formats recompute from the (overridable) winners;
  // score-derived formats use the engine's net as-is.
  const net: NetEntry[] = useMemo(() => {
    if (isWinnerDriven) return netFromWinners({ format: game.format, formatConfig: game.formatConfig, players, winners });
    return proposal.net;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winners, proposal]);

  const nameFor = (key: string | null) => {
    if (!key) return null;
    if (game.format === "best_ball") return `Team ${key}`;
    return players.find(p => (p.userId || p.displayName) === key)?.displayName ?? key;
  };

  // Choices for the override dropdown per segment.
  const choices: { key: string; label: string }[] = game.format === "best_ball"
    ? [...new Set(players.map(p => p.teamId || "A"))].map(t => ({ key: t, label: `Team ${t}` }))
    : players.map(p => ({ key: p.userId || p.displayName, label: p.displayName }));

  async function confirm() {
    setError(null);
    setSaving(true);
    try {
      const settlement = {
        format: game.format,
        winners,
        segments: proposal.segments.map(s => ({ ...s, winnerKey: winners[s.key] ?? s.winnerKey, winnerName: nameFor(winners[s.key] ?? s.winnerKey) })),
        net,
        complete: proposal.complete,
        settledAt: new Date().toISOString(),
      };
      const nextCfg = { ...(game.formatConfig || {}), winners };
      const { error: upErr } = await supabase
        .from("TripGame")
        .update({ formatConfig: nextCfg, settlement })
        .eq("id", game.id);
      if (upErr) throw new Error(upErr.message);
      onConfirmed(winners, settlement);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save settlement");
    } finally {
      setSaving(false);
    }
  }

  const hasScores = Object.keys(scores).length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 270, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ background: "#0d1f14", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 2 }}>Proposed Result</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff" }}>Settle Up</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
          {!hasScores ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit', sans-serif", fontSize: 14 }}>
              Enter scores first — then we&apos;ll calculate the result.
            </div>
          ) : (
            <>
              {proposal.note && (
                <div style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: 10, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>{proposal.note}</div>
              )}
              {!proposal.complete && (
                <div style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: 10, padding: "9px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>Some holes are missing scores — result is based on the holes entered so far.</div>
              )}

              {/* Segments + winner override */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {proposal.segments.map(seg => (
                  <div key={seg.key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{seg.label}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{seg.detail}</div>
                    </div>
                    {isWinnerDriven && (
                      <select
                        value={winners[seg.key] ?? ""}
                        onChange={e => setWinners(w => { const n = { ...w }; if (e.target.value) n[seg.key] = e.target.value; else delete n[seg.key]; return n; })}
                        style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 13, padding: "8px 10px" }}
                      >
                        <option value="">Push / no winner</option>
                        {choices.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              {/* Net $ */}
              {net.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Net</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {net.map(n => (
                      <div key={n.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{n.name}</span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: n.amount > 0 ? "#4da862" : "#e57373" }}>{n.amount > 0 ? `+$${n.amount}` : `-$${Math.abs(n.amount)}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ color: "#e57373", fontFamily: "'Outfit', sans-serif", fontSize: 13 }}>{error}</div>}
            </>
          )}
        </div>

        <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button
            onClick={confirm}
            disabled={saving || !hasScores}
            style={{ width: "100%", background: saving || !hasScores ? "rgba(77,168,98,0.4)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: saving || !hasScores ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Confirm Result"}
          </button>
        </div>
      </div>
    </div>
  );
}

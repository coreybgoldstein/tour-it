"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";

type Round = {
  id: string; userId: string; courseId: string; date: string;
  totalScore: number | null; fairwaysHit: number | null; putts: number | null; notes: string | null;
};
type Clip = {
  id: string; mediaUrl: string; cloudflareVideoId?: string | null; mediaType: string; courseId: string;
  holeNumber?: number | null; shotType?: string | null; likeCount?: number;
};
type Course = { id: string; name: string; city: string; state: string; logoUrl: string | null };

export default function RoundDetailPage() {
  const { userId, roundId } = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Edit state
  // Feed overlay state
  const [feedIndex, setFeedIndex] = useState<number | null>(null);
  const [feedVisible, setFeedVisible] = useState(0);
  const [muted, setMuted] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedIndex === null || !feedRef.current) return;
    feedRef.current.scrollTop = feedIndex * feedRef.current.clientHeight;
    setFeedVisible(feedIndex);
  }, [feedIndex]);

  const [editOpen, setEditOpen] = useState(false);
  const [editScore, setEditScore] = useState("");
  const [editFairways, setEditFairways] = useState("");
  const [editPutts, setEditPutts] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roundId || !userId) return;
    const supabase = createClient();
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const owner = authUser?.id === userId;
      setIsOwner(owner);

      const { data: roundData, error } = await supabase.from("Round")
        .select("id, userId, courseId, date, totalScore, fairwaysHit, putts, notes")
        .eq("id", roundId as string).single();

      if (error || !roundData || roundData.userId !== userId) {
        setNotFound(true); setLoading(false); return;
      }
      setRound(roundData);
      setEditScore(roundData.totalScore?.toString() || "");
      setEditFairways(roundData.fairwaysHit?.toString() || "");
      setEditPutts(roundData.putts?.toString() || "");
      setEditNotes(roundData.notes || "");

      const { data: courseData } = await supabase.from("Course")
        .select("id, name, city, state, logoUrl").eq("id", roundData.courseId).single();
      setCourse(courseData);

      const { data: clipsData } = await supabase.from("Upload")
        .select("id, mediaUrl, cloudflareVideoId, mediaType, courseId, holeId, shotType, likeCount")
        .eq("roundId", roundId as string).order("createdAt", { ascending: true });

      if (clipsData && clipsData.length > 0) {
        const holeIds = [...new Set(clipsData.map((c: any) => c.holeId).filter(Boolean))];
        if (holeIds.length > 0) {
          const { data: holes } = await supabase.from("Hole").select("id, holeNumber").in("id", holeIds);
          const holeMap = new Map(holes?.map((h: any) => [h.id, h.holeNumber]) || []);
          setClips(clipsData.map((c: any) => ({ ...c, holeNumber: holeMap.get(c.holeId) ?? null })));
        } else {
          setClips(clipsData);
        }
      }

      setLoading(false);
    }
    load();
  }, [roundId, userId]);

  async function saveEdit() {
    if (!round) return;
    setSaving(true);
    const supabase = createClient();
    const updates: any = { updatedAt: new Date().toISOString() };
    if (editScore.trim()) updates.totalScore = parseInt(editScore);
    else updates.totalScore = null;
    if (editFairways.trim()) updates.fairwaysHit = parseInt(editFairways);
    else updates.fairwaysHit = null;
    if (editPutts.trim()) updates.putts = parseInt(editPutts);
    else updates.putts = null;
    updates.notes = editNotes.trim() || null;
    await supabase.from("Round").update(updates).eq("id", round.id);
    setRound(r => r ? { ...r, ...updates } : r);
    setEditOpen(false);
    setSaving(false);
  }

  const [y, m, d] = (round?.date || "2000-01-01").split("-").map(Number);
  const dateStr = round ? new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100dvh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Round not found</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#07100a", paddingBottom: 100, ...(isDesktop ? { marginLeft: 72 } : {}) }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ padding: "48px 20px 20px", background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course?.name || "Round"}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{dateStr}</div>
          </div>
          {isOwner && (
            <button onClick={() => setEditOpen(true)} style={{ marginLeft: "auto", flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
        </div>

        {/* Stats row */}
        {(round?.totalScore != null || round?.fairwaysHit != null || round?.putts != null) && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {round.totalScore != null && (
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{round.totalScore}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Score</div>
              </div>
            )}
            {round.fairwaysHit != null && (
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#4da862", lineHeight: 1 }}>{round.fairwaysHit}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Fairways</div>
              </div>
            )}
            {round.putts != null && (
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#c8a96e", lineHeight: 1 }}>{round.putts}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Putts</div>
              </div>
            )}
          </div>
        )}

        {round?.notes && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{round.notes}</div>
          </div>
        )}

        {isOwner && round?.totalScore == null && round?.fairwaysHit == null && round?.putts == null && !round?.notes && (
          <button onClick={() => setEditOpen(true)} style={{ width: "100%", padding: "12px", background: "rgba(77,168,98,0.1)", border: "1px dashed rgba(77,168,98,0.3)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(77,168,98,0.7)", cursor: "pointer", marginBottom: 20 }}>
            + Add score, stats & notes
          </button>
        )}
      </div>

      {/* Clips */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
          Clips from this round · {clips.length}
        </div>
        {clips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No clips linked to this round yet</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px" }}>
            {clips.map((clip, i) => (
              <div key={clip.id} onClick={() => setFeedIndex(i)}
                style={{ aspectRatio: "9/16", borderRadius: "6px", overflow: "hidden", position: "relative", cursor: "pointer", background: i % 3 === 0 ? "linear-gradient(180deg,#1a4d22 0%,#2d7a42 50%,#0f2e18 100%)" : i % 3 === 1 ? "linear-gradient(180deg,#0a2e14 0%,#1e5c30 50%,#0a1e10 100%)" : "linear-gradient(180deg,#1e3a10 0%,#3a6020 50%,#122010 100%)" }}>
                {clip.mediaType === "PHOTO"
                  ? <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <img src={clip.cloudflareVideoId ? `https://videodelivery.net/${clip.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=0s&width=400` : clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                }
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
                {clip.holeNumber && (
                  <div style={{ position: "absolute", bottom: 6, left: 6, background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff" }}>{clip.holeNumber}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

      {/* Full-screen clip feed overlay */}
      {feedIndex !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000" }}>
          <div
            ref={feedRef}
            onScroll={e => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollTop / el.clientHeight);
              if (idx !== feedVisible) setFeedVisible(idx);
            }}
            style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory" }}
          >
            {clips.map((clip, i) => (
              <div key={clip.id} style={{ height: "100svh", scrollSnapAlign: "start", position: "relative", flexShrink: 0, background: "#000" }}>
                {i === feedVisible ? (
                  clip.mediaType === "PHOTO"
                    ? <img src={clip.mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    : <HlsVideo
                        src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId ?? undefined)}
                        autoPlay muted={muted} loop playsInline
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                ) : (
                  <img
                    src={clip.cloudflareVideoId ? `https://videodelivery.net/${clip.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=0s&width=400` : clip.mediaUrl}
                    alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 25%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 40%)", pointerEvents: "none" }} />

                {/* Back button */}
                <button
                  onClick={() => setFeedIndex(null)}
                  style={{ position: "absolute", top: 52, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "7px 12px 7px 8px", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>Round</span>
                </button>

                {/* Clip counter */}
                <div style={{ position: "absolute", top: 56, right: 16, zIndex: 10, fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>{i + 1} / {clips.length}</div>

                {/* Hole # badge */}
                {clip.holeNumber && (
                  <div style={{ position: "absolute", bottom: 100, left: 0, zIndex: 10, background: "rgba(7,16,10,0.82)", backdropFilter: "blur(10px)", borderRadius: "0 16px 0 0", borderTop: "1px solid rgba(77,168,98,0.2)", borderRight: "1px solid rgba(77,168,98,0.2)", padding: "12px 16px 16px 14px", pointerEvents: "none" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 400, color: "#fff", lineHeight: 1, letterSpacing: "-1px" }}>{clip.holeNumber}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit sheet */}
      {editOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => setEditOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 48px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Edit round</div>

            {[
              { label: "Total Score", value: editScore, set: setEditScore, placeholder: "e.g. 82" },
              { label: "Fairways Hit", value: editFairways, set: setEditFairways, placeholder: "e.g. 9" },
              { label: "Putts", value: editPutts, set: setEditPutts, placeholder: "e.g. 32" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{label}</div>
                <input
                  type="number" value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#fff", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Notes</div>
              <textarea
                value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="How did it go? Any highlights?"
                rows={3}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
            </div>

            <button onClick={saveEdit} disabled={saving} style={{ width: "100%", padding: "15px", background: saving ? "rgba(45,122,66,0.5)" : "#2d7a42", border: "none", borderRadius: 14, fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: saving ? "default" : "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

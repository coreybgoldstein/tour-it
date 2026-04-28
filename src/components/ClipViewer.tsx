"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLike } from "@/hooks/useLike";
import { HlsVideo } from "@/components/HlsVideo";
import { getVideoSrc } from "@/lib/getVideoSrc";

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", CHIP: "Chip", PITCH: "Pitch",
  PUTT: "Putt", BUNKER: "Bunker", LAY_UP: "Layup", FULL_HOLE: "Full Hole",
};

export type ClipViewerClip = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  cloudflareVideoId?: string | null;
  courseId: string;
  holeId?: string;
  holeNumber?: number | null;
  userId: string;
  likeCount?: number;
  commentCount?: number;
  shotType?: string | null;
  clubUsed?: string | null;
  windCondition?: string | null;
  strategyNote?: string | null;
  landingZoneNote?: string | null;
  whatCameraDoesntShow?: string | null;
  datePlayedAt?: string | null;
};

type Props = {
  clip: ClipViewerClip;
  onClose: () => void;
  courseName?: string | null;
  courseId?: string | null;
  courseLogoUrl?: string | null;
  uploader?: { id: string; username: string; avatarUrl: string | null } | null;
  currentUserId?: string | null;
  currentUserMeta?: { username: string; avatarUrl: string | null } | null;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function ClipViewer({
  clip, onClose, courseName, courseLogoUrl, uploader,
  currentUserId, currentUserMeta, onEdit, onDelete,
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  const [muted, setMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const { liked, likeCount, toggleLike } = useLike({ uploadId: clip.id, initialLikeCount: clip.likeCount || 0 });
  const [localCommentCount, setLocalCommentCount] = useState(clip.commentCount || 0);

  const abbr = courseName
    ? courseName.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase()
    : "?";

  // Auto-play video on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  // Pause video when notes or comments open
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (notesOpen || commentOpen) {
      v.pause();
      setVideoPaused(true);
    } else {
      v.play().catch(() => {});
      setVideoPaused(false);
    }
  }, [notesOpen, commentOpen]);

  // Load comments when comment sheet opens
  useEffect(() => {
    if (!commentOpen) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient()
      .from("Comment")
      .select("id, body, createdAt, userId, User:userId(username, avatarUrl)")
      .eq("uploadId", clip.id)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        setCommentItems((data || []).map((c: any) => ({
          id: c.id, body: c.body, createdAt: c.createdAt,
          username: c.User?.username || "user",
          avatarUrl: c.User?.avatarUrl || null,
        })));
        setLoadingComments(false);
      });
  }, [commentOpen, clip.id]);

  const onTouchStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    if (delta > 60) { setNotesOpen(false); setCommentOpen(false); }
    dragStartY.current = null;
  };

  async function handleShare() {
    const url = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
    const text = `Tour It — ${courseName || ""}${clip.holeNumber ? ` — Hole ${clip.holeNumber}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  }

  async function submitComment() {
    if (!commentText.trim() || !currentUserId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("Comment").insert({
      id: newId, userId: currentUserId, uploadId: clip.id,
      body: commentText.trim(), createdAt: now, updatedAt: now,
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount").eq("id", clip.id).single();
      await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", clip.id);
      setCommentItems(prev => [...prev, {
        id: newId, body: commentText.trim(), createdAt: now,
        username: currentUserMeta?.username || "you",
        avatarUrl: currentUserMeta?.avatarUrl || null,
      }]);
      setLocalCommentCount(prev => prev + 1);
      setCommentText("");
    }
    setSubmittingComment(false);
  }

  const hasNotes = !!(clip.shotType || clip.strategyNote || clip.clubUsed || clip.windCondition || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.datePlayedAt);

  return (
    <>
      <style>{`
        .cv-top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 52px 14px 12px; z-index: 20; gap: 10px; }
        .cv-course-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(77,168,98,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #4da862; flex-shrink: 0; overflow: hidden; }
        .cv-mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .cv-right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .cv-action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .cv-action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.45); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .cv-action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; }
        .cv-owner-btn { width: 36px; height: 36px; border-radius: 50%; backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        @keyframes cv-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000" }}>
        {/* Media */}
        {clip.mediaType === "VIDEO" ? (
          <HlsVideo
            ref={videoRef}
            src={getVideoSrc(clip.mediaUrl, clip.cloudflareVideoId)}
            loop muted={muted} playsInline
            onClick={() => {
              const v = videoRef.current; if (!v) return;
              if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
              else { v.pause(); setVideoPaused(true); }
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
          />
        ) : (
          <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}

        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none", zIndex: 5 }} />

        {/* Pause indicator */}
        {videoPaused && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="cv-top-bar">
          <button
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div className="cv-course-badge">
              {courseLogoUrl
                ? <img src={courseLogoUrl} alt={courseName || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : abbr
              }
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 6px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {courseName || "Unknown course"}
              </div>
              {clip.holeNumber != null && (
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)" }}>
                  Hole {clip.holeNumber}{clip.shotType && SHOT_LABEL[clip.shotType] ? ` · ${SHOT_LABEL[clip.shotType]}` : ""}
                </span>
              )}
            </div>
          </button>

          {/* Owner controls */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {onEdit && (
              <button
                className="cv-owner-btn"
                onClick={onEdit}
                style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {onDelete && (
              <button
                className="cv-owner-btn"
                onClick={onDelete}
                style={{ background: "rgba(220,60,60,0.15)", border: "1px solid rgba(220,60,60,0.3)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(220,100,100,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            )}
            <button className="cv-mute-btn" onClick={() => setMuted(m => !m)}>
              {muted
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="cv-right-actions">
          {/* Uploader avatar */}
          <button className="cv-action-btn" onClick={() => uploader && router.push(`/profile/${uploader.id}`)}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {uploader?.avatarUrl
                ? <img src={uploader.avatarUrl} alt={uploader.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
            {uploader && <span className="cv-action-label" style={{ maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>@{uploader.username}</span>}
          </button>

          {/* Like */}
          <button className="cv-action-btn" onClick={toggleLike}>
            <div className="cv-action-icon" style={liked ? { borderColor: "rgba(77,168,98,0.7)", background: "rgba(77,168,98,0.15)" } : {}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <span className="cv-action-label" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
          </button>

          {/* Comment */}
          <button className="cv-action-btn" onClick={() => setCommentOpen(true)}>
            <div className="cv-action-icon" style={commentOpen ? { borderColor: "rgba(77,168,98,0.5)", background: "rgba(77,168,98,0.15)" } : {}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span className="cv-action-label" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{localCommentCount}</span>
          </button>

          {/* Notes */}
          {hasNotes && (
            <button className="cv-action-btn" onClick={() => setNotesOpen(true)}>
              <div className="cv-action-icon" style={notesOpen ? { borderColor: "rgba(77,168,98,0.5)", background: "rgba(77,168,98,0.15)" } : {}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={notesOpen ? "#4da862" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
            </button>
          )}

          {/* Share */}
          <button className="cv-action-btn" onClick={handleShare}>
            <div className="cv-action-icon" style={copied ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.2)" } : {}}>
              {copied
                ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>SENT</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, marginTop: 3 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.12em", marginRight: "-0.12em" }}>SEND</span>
                    <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.25)", margin: "2px 0" }} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "#4ade80", letterSpacing: "0.22em", marginRight: "-0.22em" }}>IT</span>
                  </div>
              }
            </div>
            <span style={{ height: 13, display: "block" }} />
          </button>
        </div>

        {/* Notes bottom sheet */}
        {notesOpen && (
          <>
            <div onClick={() => setNotesOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 40 }} />
            <div
              ref={sheetRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,28,16,0.97)", borderTop: "1px solid rgba(77,168,98,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", backdropFilter: "blur(20px)" }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
                {clip.holeNumber != null ? `Hole ${clip.holeNumber} · ` : ""}Scout Notes
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {clip.shotType && SHOT_LABEL[clip.shotType] && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shot Type</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#4da862" }}>{SHOT_LABEL[clip.shotType]}</span>
                  </div>
                )}
                {clip.clubUsed && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Club</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{clip.clubUsed}</span>
                  </div>
                )}
                {clip.windCondition && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Wind</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{clip.windCondition.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}</span>
                  </div>
                )}
                {clip.datePlayedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Played</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{new Date(clip.datePlayedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                )}
                {clip.strategyNote && (
                  <div style={{ paddingTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? 6 : 0, borderTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Strategy</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{clip.strategyNote}</div>
                  </div>
                )}
                {clip.landingZoneNote && (
                  <div style={{ paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Landing Zone</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{clip.landingZoneNote}</div>
                  </div>
                )}
                {clip.whatCameraDoesntShow && (
                  <div style={{ paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>What the Camera Doesn&apos;t Show</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{clip.whatCameraDoesntShow}</div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Comment sheet */}
        {commentOpen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 150 }} onClick={() => { setCommentOpen(false); setCommentText(""); }}>
            <div
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onClick={e => e.stopPropagation()}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 16px 32px", maxHeight: "70vh", display: "flex", flexDirection: "column" }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Comments</div>

              {/* Comment list */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                {loadingComments ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "cv-spin 0.8s linear infinite" }} />
                  </div>
                ) : commentItems.length === 0 ? (
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "16px 0" }}>No comments yet</div>
                ) : commentItems.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.avatarUrl
                        ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      }
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862", marginBottom: 2 }}>@{c.username}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment input */}
              {currentUserId ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    placeholder="Add a comment…"
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  />
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim() || submittingComment}
                    style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !commentText.trim() || submittingComment ? 0.5 : 1 }}
                  >
                    Post
                  </button>
                </div>
              ) : (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                  <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "#4da862", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Log in</button> to comment
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

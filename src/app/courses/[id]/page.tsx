"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useLike } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSave } from "@/hooks/useSave";
type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  holeCount: number;
  isPublic: boolean;
  uploadCount: number;
  description: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
};

type Clip = {
  id: string;
  mediaType: string;
  mediaUrl: string;
  shotType: string | null;
  clubUsed: string | null;
  strategyNote: string | null;
  landingZoneNote: string | null;
  whatCameraDoesntShow: string | null;
  windCondition: string | null;
  datePlayedAt: string | null;
  rankScore: number;
  holeId: string | null;
  courseId: string;
  likeCount: number;
  commentCount: number;
  holeNumber?: number;
  seriesId?: string | null;
  courseName?: string;
  isForeign?: boolean;
  userId: string;
};

type SuggestedCourse = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
};

const SHOT_LABEL: Record<string, string> = {
  TEE_SHOT: "Tee Shot", APPROACH: "Approach", LAY_UP: "Layup",
  CHIP: "Chip", PITCH: "Pitch", PUTT: "Putt",
  BUNKER: "Bunker", FULL_HOLE: "Full Hole",
};

const COURSE_HEROES: Record<string, { gradient: string; description: string; designer?: string; year?: number }> = {
  "kiawah": {
    gradient: "linear-gradient(160deg, #1a4a2e 0%, #0d3320 30%, #082818 60%, #041a10 100%)",
    description: "Pete Dye's coastal masterpiece on a barrier island. 10 holes within view of the Atlantic. Host of the 1991 Ryder Cup and 2021 PGA Championship.",
    designer: "Pete Dye",
    year: 1991,
  },
  "bethpage": {
    gradient: "linear-gradient(160deg, #162e12 0%, #0e2010 40%, #071508 100%)",
    description: "A public golf mecca on Long Island. The Black Course is one of the most demanding tracks in America — host of two US Opens.",
    designer: "A.W. Tillinghast",
    year: 1936,
  },
  "pebble": {
    gradient: "linear-gradient(160deg, #0a2a3a 0%, #0d3020 40%, #071510 100%)",
    description: "Arguably the finest meeting of land and sea in golf. Eight holes border the Pacific on the Monterey Peninsula.",
    designer: "Jack Neville",
    year: 1919,
  },
  "default": {
    gradient: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 50%, #071208 100%)",
    description: "",
  },
};

function getCourseHero(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("kiawah")) return COURSE_HEROES["kiawah"];
  if (lower.includes("bethpage")) return COURSE_HEROES["bethpage"];
  if (lower.includes("pebble")) return COURSE_HEROES["pebble"];
  return COURSE_HEROES["default"];
}

function FlagBadge({ label, large }: { label: string | number; large?: boolean }) {
  if (large) {
    return (
      <div style={{ background: "#1a5c30", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 4, padding: "6px 14px 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
          <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.5)" }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.1)" }}>
      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1, userSelect: "none" }}>{label}</span>
    </div>
  );
}

function FeedCard({ clip, isActive, onClose, onComment, course, uploaderMap, clipIndex, totalClips, onEnded, onReport }: {
  clip: Clip; isActive: boolean; onClose: () => void; onComment: () => void;
  course: Course | null; uploaderMap: Record<string, { username: string; avatarUrl: string | null }>;
  clipIndex: number; totalClips: number; onEnded: () => void; onReport?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [muted, setMuted] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const { liked, likeCount, toggleLike } = useLike({ uploadId: clip.id, initialLikeCount: clip.likeCount || 0 });
  const uploader = uploaderMap[clip.userId];
  const abbr = course?.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "?";

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
    else { v.pause(); v.currentTime = 0; }
  }, [isActive]);

  // Pause video when notes open, resume when closed
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (notesOpen) { v.pause(); setVideoPaused(true); }
    else if (isActive) { v.play().catch(() => {}); setVideoPaused(false); }
  }, [notesOpen, isActive]);

  const openNotes = () => setNotesOpen(true);
  const closeNotes = () => setNotesOpen(false);

  // Swipe-down to dismiss
  const onTouchStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    if (delta > 60) closeNotes();
    dragStartY.current = null;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/courses/${clip.courseId}${clip.holeNumber ? `/holes/${clip.holeNumber}` : ""}`;
    const text = `Tour It — ${course?.name || ""}${clip.holeNumber ? ` — Hole ${clip.holeNumber}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#000", display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 390, height: "100%", overflow: "hidden" }}>
      {clip.mediaType === "VIDEO" ? (
        <video
          ref={videoRef} src={clip.mediaUrl} muted={muted} playsInline
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
            else { v.pause(); setVideoPaused(true); }
          }}
          onEnded={onEnded}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
        />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      {/* Gradients */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none", zIndex: 5 }} />

      {/* Pause indicator */}
      {videoPaused && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
        </div>
      )}

      {/* Top bar — matches hole page exactly */}
      <div className="top-bar">
        <button
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <div className="course-top-badge">
            {course?.logoUrl
              ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : abbr
            }
          </div>
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 6px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course?.name}</div>
            {clip.holeNumber && (
              <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(0,0,0,0.48)", backdropFilter: "blur(6px)", borderRadius: 99, padding: "2px 8px", marginTop: 3 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                  Hole {clip.holeNumber}{clip.datePlayedAt ? ` · ${new Date(clip.datePlayedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </span>
              </span>
            )}
          </div>
        </button>
        <button className="mute-btn" onClick={() => setMuted(m => !m)}>
          {muted
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          }
        </button>
      </div>

      {/* Right sidebar — uploader → like → comment → share → flag badge */}
      <div className="right-actions">
        <button className="action-btn" onClick={() => router.push(`/profile/${clip.userId}`)}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {uploader?.avatarUrl
              ? <img src={uploader.avatarUrl} alt={uploader.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          {uploader && <span className="action-label" style={{ maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>@{uploader.username}</span>}
        </button>

        <button className="action-btn" onClick={toggleLike}>
          <div className="action-icon" style={liked ? { borderColor: "rgba(26,158,66,0.7)", background: "rgba(26,158,66,0.15)" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <span className="action-label" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
        </button>

        <button className="action-btn" onClick={onComment}>
          <div className="action-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span className="action-label" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{clip.commentCount || 0}</span>
        </button>

        {/* Notes button — only show if clip has any intel */}
        {(clip.shotType || clip.strategyNote || clip.clubUsed || clip.windCondition || clip.landingZoneNote || clip.whatCameraDoesntShow || clip.datePlayedAt) && (
          <button className="action-btn" onClick={openNotes}>
            <div className="action-icon" style={notesOpen ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.15)" } : {}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={notesOpen ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </button>
        )}

        <button className="action-btn" onClick={handleShare}>
          <div className="action-icon" style={copied ? { borderColor: "rgba(26,158,66,0.5)", background: "rgba(26,158,66,0.2)" } : {}}>
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

        {onReport && (
          <button className="action-btn" onClick={onReport}>
            <div className="action-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </div>
            <span style={{ height: 13, display: "block" }} />
          </button>
        )}

      </div>

      {/* Clip position dots — only when hole has multiple clips */}
      {totalClips > 1 && (
        <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 20, pointerEvents: "none" }}>
          {Array.from({ length: totalClips }).map((_, i) => (
            <div key={i} style={{ width: i === clipIndex ? 16 : 5, height: 5, borderRadius: 99, background: i === clipIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.28)", transition: "width 0.2s, background 0.2s" }} />
          ))}
        </div>
      )}

      {/* Notes bottom sheet */}
      {notesOpen && (
        <>
          <div onClick={closeNotes} style={{ position: "absolute", inset: 0, zIndex: 40 }} />
          <div
            ref={sheetRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,28,16,0.97)", borderTop: "1px solid rgba(26,158,66,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", backdropFilter: "blur(20px)" }}
          >
            {/* Drag handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />

            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
              Hole {clip.holeNumber} · Scout Notes
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {clip.shotType && SHOT_LABEL[clip.shotType] && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shot Type</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#1a9e42" }}>{SHOT_LABEL[clip.shotType]}</span>
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
              {(clip.strategyNote || clip.landingZoneNote || clip.whatCameraDoesntShow) && (
                <div style={{ paddingTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? 6 : 0, borderTop: clip.shotType || clip.clubUsed || clip.windCondition || clip.datePlayedAt ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
                    {[clip.strategyNote, clip.landingZoneNote, clip.whatCameraDoesntShow].filter(Boolean).join("\n\n")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </div>{/* end inner wrapper */}
    </div>
  );
}

export default function CourseProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseClips, setCourseClips] = useState<Clip[]>([]);
  const [suggestedCourses, setSuggestedCourses] = useState<SuggestedCourse[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, { username: string; avatarUrl: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [feedOpen, setFeedOpen] = useState(false);
  const [showFeedHint, setShowFeedHint] = useState(false);
  const [feedStartHole, setFeedStartHole] = useState(1);
  const [activeHoleNum, setActiveHoleNum] = useState<number | null>(null);
  const [activeClipByHole, setActiveClipByHole] = useState<Record<number, number>>({});
  const [holeClipsMap, setHoleClipsMap] = useState<Record<number, Clip[]>>({});
  const [extendedClips, setExtendedClips] = useState<Clip[]>([]);
  const [holesWithClips, setHolesWithClips] = useState<number[]>([]);
  const [extendedClip, setExtendedClip] = useState<Clip | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const holeScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const holesWithClipsRef = useRef<number[]>([]);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [holes, setHoles] = useState<{ holeNumber: number; par: number; handicapRank: number }[]>([]);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeSuccess, setContributeSuccess] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<{ id: string; body: string; username: string; avatarUrl: string | null; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null }[]>([]);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { saved, saveType, toggleSave, showPicker, setShowPicker } = useSave({ courseId: id as string });
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripStep, setTripStep] = useState<"select" | "create" | "details" | "success">("select");
  const [userTrips, setUserTrips] = useState<{ id: string; name: string; startDate: string | null; endDate: string | null }[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedTripName, setSelectedTripName] = useState("");
  const [newTripName, setNewTripName] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");
  const [tripPlayDate, setTripPlayDate] = useState("");
  const [tripTeeTime, setTripTeeTime] = useState("");
  const [tripAccommodation, setTripAccommodation] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripAddedName, setTripAddedName] = useState("");
  const [tripAddedId, setTripAddedId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    createClient()
      .from("Comment")
      .select("id, body, createdAt, userId, User:userId(username, avatarUrl)")
      .eq("uploadId", commentUploadId)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) setCommentItems(data.map((c: any) => ({
          id: c.id, body: c.body, createdAt: c.createdAt,
          username: c.User?.username || "golfer",
          avatarUrl: c.User?.avatarUrl || null,
        })));
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  function handleCommentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
      if (q.length < 1) { setMentionResults([]); return; }
      mentionDebounce.current = setTimeout(async () => {
        const { data } = await createClient().from("User").select("id, username, displayName, avatarUrl").ilike("username", `%${q}%`).limit(5);
        setMentionResults(data || []);
      }, 220);
    } else {
      setMentionResults([]);
    }
  }

  function selectMention(username: string) {
    const input = commentInputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? commentText.length;
    const before = commentText.slice(0, cursor).replace(/@(\w*)$/, `@${username} `);
    const after = commentText.slice(cursor);
    const next = before + after;
    setCommentText(next);
    setMentionResults([]);
    setTimeout(() => { input.focus(); input.setSelectionRange(before.length, before.length); }, 0);
  }

  async function submitComment() {
    if (!commentText.trim() || !user || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("Comment").insert({
      id: newId, userId: user.id, uploadId: commentUploadId, body: commentText.trim(),
      createdAt: now, updatedAt: now,
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount").eq("id", commentUploadId).single();
      await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);
      setCommentItems(prev => [...prev, {
        id: newId, body: commentText.trim(), createdAt: new Date().toISOString(),
        username: user.user_metadata?.username || "you", avatarUrl: null,
      }]);
      setCourseClips(prev => prev.map((c: Clip) => c.id === commentUploadId ? { ...c, commentCount: (c.commentCount || 0) + 1 } : c));

      // Notify @mentioned users
      const mentions = [...new Set((commentText.match(/@(\w+)/g) || []).map(m => m.slice(1).toLowerCase()))];
      if (mentions.length > 0) {
        const { data: mentionedUsers } = await supabase
          .from("User")
          .select("id, username")
          .in("username", mentions);
        const tagged = (mentionedUsers || []).filter(u => u.id !== user.id);
        if (tagged.length > 0) {
          const commenterName = user.user_metadata?.username || user.user_metadata?.display_name || "Someone";
          const { data: commenterProfile } = await supabase.from("User").select("displayName, username").eq("id", user.id).single();
          const senderName = commenterProfile?.displayName || commenterProfile?.username || commenterName;
          const notifNow = new Date().toISOString();
          await supabase.from("Notification").insert(
            tagged.map(u => ({
              id: crypto.randomUUID(),
              userId: u.id,
              type: "comment_mention",
              title: "You were mentioned",
              body: `${senderName} tagged you in a comment: "${commentText.trim().slice(0, 80)}${commentText.trim().length > 80 ? "…" : ""}"`,
              linkUrl: `/courses/${id}`,
              read: false,
              createdAt: notifNow,
              updatedAt: notifNow,
            }))
          );
        }
      }

      setCommentText("");
    }
    setSubmittingComment(false);
  }

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    async function loadData() {
      const { data: courseData } = await supabase.from("Course").select("*").eq("id", id).single();
      if (courseData) setCourse(courseData);

      const { data: holesData } = await supabase.from("Hole").select("id, holeNumber, par, handicapRank").eq("courseId", id).order("holeNumber", { ascending: true });
      const holeMap: Record<string, number> = {};
      holesData?.forEach((h: any) => { holeMap[h.id] = h.holeNumber; });
      if (holesData) setHoles(holesData.map((h: any) => ({ holeNumber: h.holeNumber, par: h.par || 4, handicapRank: h.handicapRank || h.holeNumber })));

      const { data: uploads } = await supabase
        .from("Upload").select("*").eq("courseId", id).eq("moderationStatus", "APPROVED").order("rankScore", { ascending: false });

      const clips: Clip[] = (uploads || []).map((u: any) => ({
        ...u,
        holeNumber: u.holeId ? holeMap[u.holeId] : undefined,
        courseName: courseData?.name,
        isForeign: false,
        likeCount: u.likeCount || 0,
      }));

      // Sort by hole number ascending (clips without hole go last)
      clips.sort((a, b) => (a.holeNumber ?? 999) - (b.holeNumber ?? 999));
      setCourseClips(clips);

      // Group by hole for new grid/feed
      const map: Record<number, Clip[]> = {};
      const extended: Clip[] = [];
      for (const clip of clips) {
        if (clip.holeNumber) {
          if (!map[clip.holeNumber]) map[clip.holeNumber] = [];
          map[clip.holeNumber].push(clip);
        } else {
          extended.push(clip);
        }
      }
      setHoleClipsMap(map);
      setExtendedClips(extended);
      const hw = Object.keys(map).map(Number).sort((a, b) => a - b);
      setHolesWithClips(hw);
      holesWithClipsRef.current = hw;

      // Fetch uploader info
      if (clips.length > 0) {
        const userIds = [...new Set(clips.map((c: any) => c.userId).filter(Boolean))];
        const { data: users } = await supabase.from("User").select("id, username, avatarUrl").in("id", userIds);
        if (users) {
          const map: Record<string, { username: string; avatarUrl: string | null }> = {};
          users.forEach((u: any) => { map[u.id] = { username: u.username, avatarUrl: u.avatarUrl }; });
          setUploaders(map);
        }
      }

      // Fetch 2 suggested courses
      const { data: suggested } = await supabase
        .from("Course")
        .select("id, name, city, state, logoUrl, coverImageUrl")
        .neq("id", id)
        .order("uploadCount", { ascending: false })
        .limit(2);
      setSuggestedCourses(suggested || []);

      setLoading(false);
    }

    loadData();
  }, [id]);

  const openContribute = useCallback(() => {
    if (!course) return;
    setEditDescription(course.description || "");
    setCoverFile(null);
    setCoverPreview(null);
    setLogoFile(null);
    setLogoPreview(null);
    setContributeSuccess(false);
    setContributeOpen(true);
  }, [course]);

  const generateDescription = async () => {
    if (!course || generatingDesc) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/generate-course-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: course.name, city: course.city, state: course.state }),
      });
      const { description } = await res.json();
      if (description) setEditDescription(description);
    } catch {
      // silently fail — user can type manually
    }
    setGeneratingDesc(false);
  };

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleContributeSubmit = async () => {
    setContributeError(null);

    if (!user) {
      setContributeError("You need to be logged in to submit updates. Sign in and try again.");
      return;
    }

    const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
    if (coverFile && coverFile.size > MAX_BYTES) {
      setContributeError(`Cover photo is too large (${(coverFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB and try again.`);
      return;
    }
    if (logoFile && logoFile.size > MAX_BYTES) {
      setContributeError(`Logo file is too large (${(logoFile.size / 1024 / 1024).toFixed(1)} MB). Please resize it to under 8 MB and try again.`);
      return;
    }

    setContributing(true);
    const supabase = createClient();
    const updates: Record<string, string> = {};

    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `covers/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, coverFile, { upsert: true });
      if (upErr) {
        setContributing(false);
        setContributeError(`Cover photo upload failed: ${upErr.message}`);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      updates.coverImageUrl = publicUrl;
    }

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `logos/${id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(path, logoFile, { upsert: true });
      if (upErr) {
        setContributing(false);
        setContributeError(`Logo upload failed: ${upErr.message}`);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
      updates.logoUrl = publicUrl;
    }

    if (editDescription.trim()) updates.description = editDescription.trim();

    if (Object.keys(updates).length > 0) {
      const { error: dbErr } = await supabase.from("Course").update(updates).eq("id", id as string);
      if (dbErr) {
        setContributing(false);
        setContributeError(`Failed to save: ${dbErr.message}`);
        return;
      }
      setCourse(prev => prev ? { ...prev, ...updates } : prev);
      if (updates.coverImageUrl) setCoverPreview(null);
    }

    setContributing(false);
    setContributeSuccess(true);
  };

  useEffect(() => {
    if (feedOpen && feedRef.current) {
      const idx = holesWithClipsRef.current.indexOf(feedStartHole);
      feedRef.current.scrollTop = Math.max(0, idx) * window.innerHeight;
      setActiveHoleNum(feedStartHole);
      setActiveClipByHole({});
    }
  }, [feedOpen, feedStartHole]);

  const handleFeedScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = feedRef.current;
      if (!el) return;
      const holeIdx = Math.round(el.scrollTop / window.innerHeight);
      const holeNum = holesWithClipsRef.current[holeIdx];
      if (holeNum !== undefined) {
        setActiveHoleNum(holeNum);
        const inner = holeScrollRefs.current[holeNum];
        if (inner) {
          const clipIdx = Math.round(inner.scrollLeft / inner.offsetWidth);
          setActiveClipByHole(prev => ({ ...prev, [holeNum]: clipIdx }));
        }
      }
    }, 50);
  }, []);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>Loading...</div>
      </main>
    );
  }

  if (!course) {
    return (
      <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 99, padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", cursor: "pointer" }}>Back to Search</button>
      </main>
    );
  }

  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  const hero = getCourseHero(course.name);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .feed-modal { position: fixed; inset: 0; z-index: 100; background: #000; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed-modal::-webkit-scrollbar { display: none; }
        .feed-hole-page { scroll-snap-align: start; scroll-snap-stop: always; height: 100svh; width: 100vw; display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior: contain; }
        .feed-hole-page::-webkit-scrollbar { display: none; }
        .feed-clip-page { width: 100vw; height: 100svh; flex-shrink: 0; scroll-snap-align: start; scroll-snap-stop: always; }
        .feed-end-snap { scroll-snap-align: start; scroll-snap-stop: always; }
        @keyframes hint-fade { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; } }
        .clip-thumb { position: relative; aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; background: #0d2318; cursor: pointer; transition: opacity 0.15s; }
        .clip-thumb:hover { opacity: 0.85; }
        .clip-thumb video, .clip-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .hole-empty { position: relative; aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
        .hole-cell-indicator { display: flex; gap: 3px; position: absolute; bottom: 6px; right: 6px; }
        .hole-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.4); }
        .hole-dot.active { background: #1a9e42; }
        .top-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 36px 14px 12px; z-index: 20; gap: 10px; }
        .back-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .mute-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .course-top-badge { width: 46px; height: 46px; border-radius: 12px; background: rgba(26,158,66,0.2); border: 1.5px solid rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 700; color: #1a9e42; flex-shrink: 0; overflow: hidden; }
        .right-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 30; }
        .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
        .action-icon { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
        .action-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }
        .bottom-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 16px 88px; z-index: 20; }
      `}</style>

      {/* Hero */}
      <div style={{ position: "relative", width: "100%", minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : courseClips.find(c => c.mediaType === "PHOTO") ? (
          <img src={courseClips.find(c => c.mediaType === "PHOTO")!.mediaUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: hero.gradient }} />
        )}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,16,10,1) 0%, rgba(7,16,10,0.5) 45%, rgba(0,0,0,0.15) 100%)" }} />

        {/* Add cover photo prompt — only when no cover image */}
        {!course.coverImageUrl && (
          <button
            onClick={openContribute}
            style={{ position: "absolute", top: 52, right: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "7px 12px", cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Add cover photo</span>
          </button>
        )}

        {/* Top left: course logo badge (tap to go back) */}
        <button onClick={() => router.back()} style={{ position: "absolute", top: 52, left: 16, zIndex: 10, width: 46, height: 46, borderRadius: 12, background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", padding: 0 }}>
          {course.logoUrl ? (
            <img
              src={course.logoUrl}
              alt={course.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
            />
          ) : null}
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#1a9e42", display: course.logoUrl ? "none" : "inline" }}>{abbr}</span>
        </button>


        <div style={{ position: "relative", padding: "0 20px 18px", zIndex: 10, marginTop: 100 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {[course.city, course.state].filter(s => s?.trim()).join(", ")}
            {course.city || course.state ? " · " : ""}{course.isPublic ? "Public" : "Private"}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.05, marginBottom: 12, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {course.name}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "4px 12px" }}>
              {course.holeCount || 18} holes
            </span>
            {hero.year && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "4px 12px" }}>
                Est. {hero.year}
              </span>
            )}
            {(course.description || hero.description) && (
              <button
                onClick={() => setAboutOpen(true)}
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                About
              </button>
            )}
            {/* Save button — bottom right of hero */}
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, background: saved ? "rgba(26,158,66,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${saved ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 99, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "#1a9e42" : "none"} stroke={saved ? "#1a9e42" : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span style={{ color: saved ? "#1a9e42" : "rgba(255,255,255,0.5)" }}>{saved ? "Saved" : "Save"}</span>
            </button>
            {/* Save picker dropdown */}
            {showPicker && (
              <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, background: "rgba(13,35,24,0.98)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 12, padding: 6, zIndex: 50, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                <button onClick={() => toggleSave("PLAYED")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "PLAYED" ? "rgba(26,158,66,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>✓</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "PLAYED" ? "#1a9e42" : "#fff" }}>Played</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I&apos;ve played this course</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button onClick={() => toggleSave("BUCKET_LIST")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: saveType === "BUCKET_LIST" ? "rgba(26,158,66,0.15)" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>⛳</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: saveType === "BUCKET_LIST" ? "#1a9e42" : "#fff" }}>Bucket List</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>I want to play this</div>
                  </div>
                </button>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button
                  onClick={async () => {
                    setShowPicker(false);
                    setTripStep("select");
                    setNewTripName(""); setNewTripStart(""); setNewTripEnd("");
                    setTripPlayDate(""); setTripTeeTime(""); setTripAccommodation("");
                    setSelectedTripId(null); setSelectedTripName("");
                    if (user) {
                      const supabase = createClient();
                      const { data: memberData } = await supabase.from("GolfTripMember").select("tripId").eq("userId", user.id);
                      if (memberData && memberData.length > 0) {
                        const tripIds = memberData.map((m: any) => m.tripId);
                        const { data: tripsData } = await supabase.from("GolfTrip").select("id, name, startDate, endDate").in("id", tripIds).order("createdAt", { ascending: false });
                        setUserTrips(tripsData || []);
                      } else {
                        setUserTrips([]);
                      }
                    }
                    setTripPickerOpen(true);
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", marginTop: 2 }}
                >
                  <span style={{ fontSize: 16 }}>✈️</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Golf Trip</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Add to a trip itinerary</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

{/* Action bar */}
<div style={{ padding: "14px 20px 16px", display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
  <button
    onClick={() => setScorecardOpen(true)}
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap" }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>
    Scorecard
  </button>
  <button
    onClick={() => router.push(`/upload?courseId=${id}`)}
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  </button>
  <button
    onClick={openContribute}
    title="Suggest a cover photo or edit course info"
    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  </button>
</div>

      {/* 18-hole grid — Front 9 left | Back 9 right, all visible at once */}
      <div style={{ padding: courseClips.length === 0 ? "0 14px" : "14px 14px 0" }}>
        {courseClips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⛳</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.2 }}>No intel on this course yet.</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, marginBottom: 20, maxWidth: 270 }}>Every golfer who plays here knows something the next one needs to know. Be the first to put it on record.</div>
            <button onClick={() => router.push(`/upload?courseId=${id}`)} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 28px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", boxShadow: "0 2px 14px rgba(45,122,66,0.35)" }}>
              Post the first clip
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 0 }}>
            {[{ label: "Front 9", holes: [1,2,3,4,5,6,7,8,9] }, { label: "Back 9", holes: [10,11,12,13,14,15,16,17,18] }].map(({ label, holes: nineHoles }, sectionIdx) => (
              <>
                {sectionIdx === 1 && (
                  <div style={{ width: 1, background: "rgba(77,168,98,0.25)", alignSelf: "stretch", margin: "0 6px", flexShrink: 0 }} />
                )}
              <div key={label} style={{ flex: 1, minWidth: 0 }}>
                {/* Section label */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 3, height: 14, background: "#4da862", borderRadius: 99, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                  {nineHoles.map(holeNum => {
                    const clips = holeClipsMap[holeNum];
                    const topClip = clips?.[0];
                    const hasClips = clips && clips.length > 0;
                    return (
                      <div
                        key={holeNum}
                        className={hasClips ? "clip-thumb" : "hole-empty"}
                        onClick={() => { if (hasClips) { setFeedStartHole(holeNum); setFeedOpen(true); if (!localStorage.getItem("ti-feed-hint")) { setShowFeedHint(true); setTimeout(() => { setShowFeedHint(false); localStorage.setItem("ti-feed-hint", "1"); }, 2800); } } else { router.push(`/upload?courseId=${id}&holeNumber=${holeNum}`); } }}
                        style={{ cursor: "pointer" }}
                      >
                        {hasClips && topClip ? (
                          <>
                            {topClip.mediaType === "VIDEO" ? (
                              <video src={topClip.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <img src={topClip.mediaUrl} alt={`Hole ${holeNum}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)" }} />
                            <div style={{ position: "absolute", bottom: 4, right: 4 }}>
                              <FlagBadge label={holeNum} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ position: "absolute", bottom: 4, right: 4 }}>
                              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "2px 5px 3px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)" }}>{holeNum}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              </>
            ))}
          </div>
        )}
      </div>

      {/* Extended Play — horizontal scroll row */}
      {extendedClips.length > 0 && (
        <div style={{ marginTop: 20, paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>Extended Play</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 2px", scrollbarWidth: "none" }}>
            {extendedClips.map(clip => (
              <div
                key={clip.id}
                onClick={() => setExtendedClip(clip)}
                style={{ position: "relative", width: 110, flexShrink: 0, aspectRatio: "9/16", borderRadius: 8, overflow: "hidden", background: "#0d2318", cursor: "pointer" }}
              >
                {clip.mediaType === "VIDEO" ? (
                  <video src={clip.mediaUrl} muted playsInline preload="metadata" onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.001; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 6, right: 6 }}>
                  <div style={{ background: "#1a5c30", border: "1px solid rgba(255,255,255,0.45)", borderRadius: 3, padding: "2px 6px 3px", display: "inline-flex", alignItems: "center" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>
                      {clip.shotType === "FULL_ROUND" ? "Full 18" : clip.shotType === "FRONT_NINE" ? "Front 9" : clip.shotType === "BACK_NINE" ? "Back 9" : clip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 100 }} />

{/* Contribute link */}

{/* About modal */}
      {aboutOpen && (
        <div onClick={() => setAboutOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 24px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{course.name}</div>
            {(hero.designer || hero.year) && (
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                {hero.designer ? `Designed by ${hero.designer}` : ""}{hero.designer && hero.year ? " · " : ""}{hero.year ? `Est. ${hero.year}` : ""}
              </div>
            )}
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              {course.description || hero.description}
            </p>
            <button onClick={() => setAboutOpen(false)} style={{ marginTop: 24, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Scorecard modal */}
      {scorecardOpen && (
        <div onClick={() => setScorecardOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Scorecard</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>{course.name}</div>

            {[{ label: "Front 9", start: 0, end: 9 }, { label: "Back 9", start: 9, end: 18 }].map(({ label, start, end }) => {
              const nine = holes.slice(start, end);
              if (nine.length === 0) return null;
              const total = nine.reduce((s, h) => s + h.par, 0);
              return (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{label}</div>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {/* Hole row */}
                    <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ width: 44, padding: "8px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Hole</div>
                      {nine.map(h => (
                        <div key={h.holeNumber} style={{ flex: 1, padding: "8px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{h.holeNumber}</div>
                      ))}
                      <div style={{ width: 36, padding: "8px 6px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Out</div>
                    </div>
                    {/* Par row */}
                    <div style={{ display: "flex" }}>
                      <div style={{ width: 44, padding: "9px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Par</div>
                      {nine.map(h => (
                        <div key={h.holeNumber} style={{ flex: 1, padding: "9px 4px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: h.par === 3 ? "#6bcf7f" : h.par === 5 ? "#f0c55a" : "#fff" }}>{h.par}</div>
                      ))}
                      <div style={{ width: 36, padding: "9px 6px", textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#1a9e42", flexShrink: 0 }}>{total}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total */}
            {holes.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "rgba(26,158,66,0.1)", borderRadius: 12, border: "1px solid rgba(26,158,66,0.2)", marginTop: 4 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Par</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1a9e42" }}>{holes.reduce((s, h) => s + h.par, 0)}</span>
              </div>
            )}

            <button onClick={() => setScorecardOpen(false)} style={{ marginTop: 20, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

{/* Contribute modal */}
      {contributeOpen && (
        <div onClick={() => setContributeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Contribute</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Help keep {course.name} accurate and beautiful</div>

            {contributeSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: "#1a9e42", marginBottom: 6 }}>Thanks for contributing!</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Your updates are live.</div>
                <button onClick={() => setContributeOpen(false)} style={{ marginTop: 20, background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px 32px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Done</button>
              </div>
            ) : (
              <>
                {/* Cover photo */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Cover Photo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: "100%", height: 140, borderRadius: 12, border: "1.5px dashed rgba(26,158,66,0.4)", background: "rgba(26,158,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                      {coverPreview ? (
                        <img src={coverPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : course.coverImageUrl ? (
                        <img src={course.coverImageUrl} alt="current" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(26,158,66,0.7)" }}>Tap to upload a beauty shot</div>
                        </div>
                      )}
                      {coverPreview && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 99 }}>Change</span></div>}
                    </div>
                    <input type="file" accept="image/*" onChange={handleCoverPick} style={{ display: "none" }} />
                  </label>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Course Description</div>
                    <button
                      onClick={generateDescription}
                      disabled={generatingDesc}
                      style={{ background: "none", border: "none", cursor: generatingDesc ? "default" : "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: generatingDesc ? "rgba(26,158,66,0.4)" : "#1a9e42", display: "flex", alignItems: "center", gap: 4, padding: 0 }}
                    >
                      {generatingDesc ? (
                        <>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(26,158,66,0.3)", borderTopColor: "#1a9e42", animation: "spin 0.6s linear infinite" }} />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
                          Generate a draft
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="What makes this course worth playing? Be honest..."
                    rows={4}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", resize: "none", outline: "none" }}
                  />
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>
                    Generate a draft then edit it — you know this course better than any AI.
                  </div>
                </div>

                {/* Course Logo upload */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Course Logo</div>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div style={{ width: 80, height: 80, borderRadius: 12, border: "1.5px dashed rgba(26,158,66,0.4)", background: "rgba(26,158,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} />
                      ) : course.logoUrl ? (
                        <img src={course.logoUrl} alt="current logo" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, opacity: 0.5 }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleLogoPick} style={{ display: "none" }} />
                  </label>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>Tap the square to upload a logo image</div>
                </div>

                {contributeError && (
                  <div style={{ background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)", lineHeight: 1.5 }}>
                    {contributeError}
                  </div>
                )}
                <button onClick={handleContributeSubmit} disabled={contributing} style={{ width: "100%", background: contributing ? "rgba(45,122,66,0.5)" : "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: contributing ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}>
                  {contributing ? "Saving..." : "Submit Updates"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full-screen feed modal — vertical = next hole, horizontal = other clips from same hole */}
      {feedOpen && (
        <div className="feed-modal" ref={feedRef} onScroll={handleFeedScroll} onClick={() => { if (showFeedHint) { setShowFeedHint(false); localStorage.setItem("ti-feed-hint", "1"); } }} style={{ left: isDesktop ? 72 : 0 }}>
          {holesWithClips.map(holeNum => {
            const clips = holeClipsMap[holeNum] || [];
            const isHoleActive = holeNum === activeHoleNum;
            const activeClipIdx = activeClipByHole[holeNum] || 0;
            return (
              <div
                key={holeNum}
                className="feed-hole-page"
                ref={el => { holeScrollRefs.current[holeNum] = el; }}
                onScroll={() => {
                  const inner = holeScrollRefs.current[holeNum];
                  if (!inner) return;
                  const clipIdx = Math.round(inner.scrollLeft / inner.offsetWidth);
                  setActiveClipByHole(prev => ({ ...prev, [holeNum]: clipIdx }));
                }}
              >
                {clips.map((clip, clipIdx) => (
                  <div key={clip.id} className="feed-clip-page">
                    <FeedCard
                      clip={clip}
                      isActive={isHoleActive && clipIdx === activeClipIdx}
                      onClose={() => setFeedOpen(false)}
                      onComment={() => setCommentUploadId(clip.id)}
                      course={course}
                      uploaderMap={uploaders}
                      clipIndex={clipIdx}
                      totalClips={clips.length}
                      onEnded={() => {
                        if (clipIdx < clips.length - 1) {
                          const hsr = holeScrollRefs.current[holeNum];
                          hsr?.scrollBy({ left: hsr.offsetWidth, behavior: "smooth" });
                        } else {
                          feedRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });
                        }
                      }}
                      onReport={user && clip.userId !== user.id ? () => setReportClipId(clip.id) : undefined}
                    />
                  </div>
                ))}
              </div>
            );
          })}
          {/* One-time gesture hint */}
          {showFeedHint && (
            <div style={{ position: "fixed", inset: 0, zIndex: 110, pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", animation: "hint-fade 2.8s ease forwards", background: "rgba(0,0,0,0.62)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "16px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>swipe for more shots</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>scroll for next hole</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
          )}

          {/* End card — suggested courses */}
          {suggestedCourses.length > 0 && (
            <div className="feed-end-snap">
              <div style={{ width: "100%", height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative" }}>
                <button onClick={() => setFeedOpen(false)} style={{ position: "absolute", top: 52, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>More to scout</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 360 }}>
                  {suggestedCourses.map(c => (
                    <button key={c.id} onClick={() => { setFeedOpen(false); router.push(`/courses/${c.id}`); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      <div style={{ width: "100%", height: 90, background: "#0d2318", position: "relative", overflow: "hidden" }}>
                        {c.coverImageUrl
                          ? <img src={c.coverImageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, #1a4d22 0%, #0d2e14 100%)" }} />
                        }
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
                        {c.logoUrl && (
                          <div style={{ position: "absolute", top: 7, right: 7, width: 28, height: 18, borderRadius: 5, overflow: "hidden" }}>
                            <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "10px 12px 12px" }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 2 }}>{c.name}</div>
                        {(c.city || c.state) && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setFeedOpen(false)} style={{ marginTop: 20, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 24px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                  Back to {course?.name}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extended Play full-screen viewer */}
      {extendedClip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#000", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "52px 14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)", zIndex: 10 }}>
            <button onClick={() => setExtendedClip(null)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
              {extendedClip.shotType === "FULL_ROUND" ? "Full Round" : extendedClip.shotType === "FRONT_NINE" ? "Front 9" : extendedClip.shotType === "BACK_NINE" ? "Back 9" : extendedClip.shotType === "THREE_HOLE" ? "3 Holes" : "Extended Play"}
            </div>
            <div style={{ width: 36 }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {extendedClip.mediaType === "VIDEO" ? (
              <video src={extendedClip.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls playsInline autoPlay muted />
            ) : (
              <img src={extendedClip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </div>
          {(extendedClip.strategyNote || extendedClip.landingZoneNote || extendedClip.whatCameraDoesntShow) && (
            <div style={{ position: "absolute", bottom: 80, left: 16, right: 80, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {[extendedClip.strategyNote, extendedClip.landingZoneNote, extendedClip.whatCameraDoesntShow].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Report clip sheet */}
      {reportClipId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={() => { setReportClipId(null); setReportReason(null); setReportDone(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#0d1f12", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 18px" }} />
            {reportDone ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Report submitted</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Thanks for keeping Tour It quality.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Report clip</div>
                {[
                  { value: "WRONG_HOLE", label: "Wrong hole" },
                  { value: "WRONG_COURSE", label: "Wrong course" },
                  { value: "LOW_QUALITY", label: "Low quality / unviewable" },
                  { value: "INAPPROPRIATE", label: "Inappropriate content" },
                  { value: "SPAM", label: "Spam" },
                  { value: "COPYRIGHT", label: "Copyright issue" },
                  { value: "OTHER", label: "Other" },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setReportReason(opt.value)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: reportReason === opt.value ? "rgba(255,255,255,0.06)" : "none", border: reportReason === opt.value ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent", borderRadius: 10, padding: "11px 14px", marginBottom: 6, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", textAlign: "left" }}>
                    {opt.label}
                    {reportReason === opt.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
                <button
                  disabled={!reportReason || submittingReport}
                  onClick={async () => {
                    if (!reportReason || !user) return;
                    setSubmittingReport(true);
                    await createClient().from("ModerationReport").insert({ id: crypto.randomUUID(), reportedById: user.id, uploadId: reportClipId, reason: reportReason, createdAt: new Date().toISOString() });
                    setSubmittingReport(false);
                    setReportDone(true);
                    setTimeout(() => { setReportClipId(null); setReportReason(null); setReportDone(false); }, 1800);
                  }}
                  style={{ width: "100%", marginTop: 8, background: reportReason ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: reportReason ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", cursor: reportReason ? "pointer" : "not-allowed" }}>
                  {submittingReport ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Comment sheet */}
      {commentUploadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => { setCommentUploadId(null); setCommentText(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(13,35,24,0.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", padding: "16px 16px 32px", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {c.avatarUrl
                      ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                  <div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#1a9e42" }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{c.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
              {/* @mention dropdown */}
              {mentionResults.length > 0 && (
                <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, background: "#0d1f12", border: "1px solid rgba(26,158,66,0.2)", borderRadius: 10, overflow: "hidden", zIndex: 20 }}>
                  {mentionResults.map(u => (
                    <button key={u.id} onMouseDown={e => { e.preventDefault(); selectMention(u.username); }}
                      style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(26,158,66,0.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={u.username} /> : <span style={{ fontSize: 10, color: "#1a9e42", fontWeight: 700 }}>{u.username[0].toUpperCase()}</span>}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>{u.displayName}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleCommentChange}
                  placeholder={user ? "Add a comment... use @ to tag" : "Log in to comment"}
                  disabled={!user}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }}
                  onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submittingComment || !user}
                  style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!commentText.trim() || !user) ? 0.4 : 1 }}
                >
                  {submittingComment ? "..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Golf Trip picker modal */}
      {tripPickerOpen && (
        <div onClick={() => setTripPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "0 auto 20px" }} />

            {tripStep === "select" && (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Add to Golf Trip</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Select a trip or create a new one</div>
                {userTrips.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {userTrips.map(trip => (
                      <button key={trip.id} onClick={() => { setSelectedTripId(trip.id); setSelectedTripName(trip.name); setTripStep("details"); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, rgba(26,158,66,0.25), rgba(45,122,66,0.15))", border: "1px solid rgba(26,158,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 18 }}>✈️</span>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{trip.name}</div>
                          {(trip.startDate || trip.endDate) && (
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                              {trip.startDate || ""}{trip.startDate && trip.endDate ? " → " : ""}{trip.endDate || ""}
                            </div>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setTripStep("create")} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Trip
                </button>
              </>
            )}

            {tripStep === "create" && (
              <>
                <button onClick={() => setTripStep("select")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 4, marginBottom: 16, padding: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Back
                </button>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 20 }}>New Golf Trip</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Trip Name *</div>
                  <input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="e.g. Myrtle Beach 2025" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Start Date</div>
                    <input type="date" value={newTripStart} onChange={e => setNewTripStart(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: newTripStart ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>End Date</div>
                    <input type="date" value={newTripEnd} onChange={e => setNewTripEnd(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: newTripEnd ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!newTripName.trim() || !user) return;
                    setSavingTrip(true);
                    const supabase = createClient();
                    const tripId = crypto.randomUUID();
                    await supabase.from("GolfTrip").insert({ id: tripId, name: newTripName.trim(), startDate: newTripStart || null, endDate: newTripEnd || null, createdBy: user.id });
                    await supabase.from("GolfTripMember").insert({ id: crypto.randomUUID(), tripId, userId: user.id, role: "owner" });
                    setSelectedTripId(tripId);
                    setSelectedTripName(newTripName.trim());
                    setSavingTrip(false);
                    setTripStep("details");
                  }}
                  disabled={!newTripName.trim() || savingTrip}
                  style={{ width: "100%", background: !newTripName.trim() ? "rgba(45,122,66,0.4)" : "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: !newTripName.trim() ? "default" : "pointer" }}
                >
                  {savingTrip ? "Creating..." : "Create Trip"}
                </button>
              </>
            )}

            {tripStep === "details" && (
              <>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Course Details</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#1a9e42", marginBottom: 20 }}>Adding {course?.name} to {selectedTripName}</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Play Date <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input type="date" value={tripPlayDate} onChange={e => setTripPlayDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: tripPlayDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Tee Time <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input type="time" value={tripTeeTime} onChange={e => setTripTeeTime(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: tripTeeTime ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Where you're staying <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></div>
                  <input value={tripAccommodation} onChange={e => setTripAccommodation(e.target.value)} placeholder="e.g. Marriott Myrtle Beach" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} />
                </div>
                <button
                  onClick={async () => {
                    if (!selectedTripId || !id) return;
                    setSavingTrip(true);
                    const supabase = createClient();
                    await supabase.from("GolfTripCourse").insert({ id: crypto.randomUUID(), tripId: selectedTripId, courseId: id as string, playDate: tripPlayDate || null, teeTime: tripTeeTime || null, accommodation: tripAccommodation.trim() || null, sortOrder: 0 });
                    setSavingTrip(false);
                    setTripAddedName(selectedTripName);
                    setTripAddedId(selectedTripId || "");
                    setTripStep("success");
                  }}
                  disabled={savingTrip}
                  style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: savingTrip ? "default" : "pointer", boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
                >
                  {savingTrip ? "Adding..." : "Add to Trip ✓"}
                </button>
              </>
            )}

            {tripStep === "success" && (
              <>
                <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(26,158,66,0.15)", border: "1.5px solid rgba(26,158,66,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Course Added!</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>{course?.name} is on <span style={{ color: "#1a9e42" }}>{tripAddedName}</span></div>
                  <button
                    onClick={() => { setTripPickerOpen(false); router.push(`/trips/${tripAddedId}`); }}
                    style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: 10, boxShadow: "0 2px 12px rgba(45,122,66,0.3)" }}
                  >
                    View Trip →
                  </button>
                  <button
                    onClick={() => { setTripPickerOpen(false); router.push(`/search?tripId=${tripAddedId}`); }}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                  >
                    + Add Another Course
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLike } from "@/hooks/useLike";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import BottomNav from "@/components/BottomNav";

type TrendingCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  uploadCount: number;
  coverImageUrl: string | null;
  logoUrl: string | null;
  isPublic?: boolean;
};

const SHOT_LABEL: Record<string, string> = { DRIVE: "Drive", APPROACH: "Approach Shot", CHIP: "Chip", PUTT: "Putt", LAYUP: "Layup", FULL_SWING: "Full Swing" };

type FeedClip = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  courseName: string;
  courseLogoUrl: string | null;
  holeId: string;
  holeNumber?: number;
  strategyNote: string | null;
  clubUsed: string | null;
  windCondition: string | null;
  shotType: string | null;
  username: string;
  avatarUrl: string | null;
  userId: string;
  likeCount: number;
  commentCount: number;
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
  datePlayedAt: string | null;
  createdAt: string;
};

type FeedItem =
  | { type: "clip"; clip: FeedClip }
  | { type: "series"; shots: FeedClip[]; seriesId: string; courseName: string; courseLogoUrl: string | null; courseId: string; holeId: string; holeNumber?: number; username: string; avatarUrl: string | null; userId: string };

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function TourItLogo({ size = 26 }: { size?: number }) {
  const w = Math.round(size * 0.8);
  return (
    <svg width={w} height={size} viewBox="0 0 60 75" fill="none">
      <defs>
        <clipPath id="ti-clip">
          <path d="M30 68 C16 53 7 44 7 30 A23 23 0 0 1 53 30 C53 44 44 53 30 68Z" />
        </clipPath>
        <linearGradient id="ti-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d7d35"/>
          <stop offset="100%" stopColor="#1a5520"/>
        </linearGradient>
        <linearGradient id="ti-g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5ec46a"/>
          <stop offset="100%" stopColor="#3d9046"/>
        </linearGradient>
      </defs>
      {/* White pin border */}
      <path d="M30 72 C14 56 3 46 3 30 A27 27 0 0 1 57 30 C57 46 46 56 30 72Z" fill="white" />
      {/* Dark interior */}
      <path d="M30 68 C16 53 7 44 7 30 A23 23 0 0 1 53 30 C53 44 44 53 30 68Z" fill="#0c1e11" />
      {/* Back rough */}
      <ellipse cx="30" cy="30" rx="22" ry="20" fill="#163d1a" clipPath="url(#ti-clip)" />
      {/* Mid grass */}
      <path d="M12 44 Q14 32 24 28 Q32 24 36 18 Q30 12 22 14 Q14 17 11 26Z" fill="url(#ti-g1)" clipPath="url(#ti-clip)" />
      {/* Fairway S-curve */}
      <path d="M24 52 Q22 40 26 34 Q30 28 32 22 Q28 15 22 17 Q17 20 18 30 Q19 39 22 46Z" fill="#3d8c40" clipPath="url(#ti-clip)" />
      {/* Water hazard */}
      <path d="M35 50 Q43 44 47 36 Q51 27 47 19 Q43 14 39 17 Q37 21 39 28 Q41 35 39 42 Q37 46 35 50Z" fill="#3d9fd4" clipPath="url(#ti-clip)" />
      {/* Water shimmer */}
      <path d="M37 45 Q44 40 47 32 Q49 25 45 19" stroke="rgba(120,210,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" clipPath="url(#ti-clip)" />
      {/* Putting green */}
      <ellipse cx="20" cy="40" rx="9" ry="7" fill="url(#ti-g2)" clipPath="url(#ti-clip)" />
      {/* Green highlight */}
      <ellipse cx="18" cy="38" rx="4" ry="2.5" fill="rgba(140,240,150,0.25)" clipPath="url(#ti-clip)" />
      {/* Sand trap */}
      <ellipse cx="25" cy="43" rx="3" ry="1.8" fill="#e8d060" clipPath="url(#ti-clip)" />
      {/* Flag pole */}
      <line x1="19" y1="40" x2="19" y2="13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      {/* Red flag */}
      <path d="M19 13 L31 17 L19 21Z" fill="#e53e3e" />
    </svg>
  );
}

function NotificationBellInline() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("Notification").select("id", { count: "exact", head: true }).eq("userId", user.id).eq("read", false)
        .then(({ count }) => setUnread(count ?? 0));
    });
  }, []);
  return (
    <button onClick={() => router.push("/notifications")} style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread > 0 && (
        <div style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#4da862", border: "1.5px solid #1c4425" }} />
      )}
    </button>
  );
}

function FeedTopBar({ courseLogoUrl, courseName, holeNumber, shotType, datePlayedAt, muted, onMuteToggle, onTapCourse }: {
  courseLogoUrl: string | null; courseName: string; holeNumber?: number; shotType?: string | null;
  datePlayedAt?: string | null; muted: boolean; onMuteToggle: () => void; onTapCourse: () => void;
}) {
  const abbr = courseName.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase() || "?";
  const dateLabel = datePlayedAt ? new Date(datePlayedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "36px 14px 12px", zIndex: 20, gap: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)" }}>
      <button onClick={onTapCourse} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(26,158,66,0.2)", border: "1.5px solid rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#1a9e42", flexShrink: 0, overflow: "hidden" }}>
          {courseLogoUrl
            ? <img src={courseLogoUrl} alt={courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : abbr
          }
        </div>
        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 6px rgba(0,0,0,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{courseName}</div>
          {holeNumber && (
            <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(0,0,0,0.48)", backdropFilter: "blur(6px)", borderRadius: 99, padding: "2px 8px", marginTop: 3 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                Hole {holeNumber}{dateLabel ? ` · ${dateLabel}` : ""}
              </span>
            </span>
          )}
        </div>
      </button>
      <button onClick={onMuteToggle} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {muted
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        }
      </button>
    </div>
  );
}

function CourseCard({ course, onClick }: { course: TrendingCourse; onClick: () => void }) {
  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div
      onClick={onClick}
      style={{
        width: 148, height: 188, borderRadius: 14, flexShrink: 0, overflow: "hidden",
        cursor: "pointer", position: "relative", background: "rgba(10,28,18,0.95)",
        border: "1px solid rgba(26,158,66,0.12)",
      }}
    >
      {course.coverImageUrl && (
        <img src={course.coverImageUrl} alt={course.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: course.coverImageUrl ? "linear-gradient(to bottom, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.82) 100%)" : "linear-gradient(145deg, rgba(13,35,22,1) 0%, rgba(7,16,10,1) 100%)" }} />

      {!course.coverImageUrl && (
        <div style={{ position: "absolute", top: "32%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {course.logoUrl ? (
            <img src={course.logoUrl} alt={course.name} style={{ width: 68, height: 42, objectFit: "cover", objectPosition: "center", borderRadius: 8 }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(26,158,66,0.12)", border: "1px solid rgba(26,158,66,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(26,158,66,0.6)" }}>{abbr}</div>
          )}
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 10px 12px" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#fff", lineHeight: 1.35, marginBottom: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
          {course.name}
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
          {[course.city, course.state].filter(s => s?.trim()).join(", ")}
        </div>
        {course.uploadCount > 0 && (
          <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", background: "rgba(26,158,66,0.18)", borderRadius: 99, padding: "2px 8px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "#1a9e42" }}>{course.uploadCount} clips</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel({ userId, avatarUrl, username, courseId, courseName, liked, onLike, likeCount, onComment, commentCount, onTapUser, onNotes, notesOpen, onReport }: {
  userId: string; avatarUrl: string | null; username: string;
  courseId: string; courseName: string;
  liked: boolean; onLike: () => void; likeCount: number;
  onComment: () => void; commentCount: number;
  onTapUser: () => void;
  onNotes: (() => void) | null; notesOpen: boolean;
  onReport?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleShare = () => {
    const url = `${window.location.origin}/courses/${courseId}`;
    if (navigator.share) navigator.share({ title: courseName, text: `Check out ${courseName} on Tour It`, url }).catch(() => {});
    else { navigator.clipboard.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <div style={{ position: "absolute", right: 14, bottom: 100, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 10 }}>
      {/* Uploader */}
      <button onClick={onTapUser} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          }
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>@{username}</span>
      </button>
      {/* Like */}
      <button onClick={onLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${liked ? "rgba(26,158,66,0.7)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", ...(liked ? { background: "rgba(26,158,66,0.15)" } : {}) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "#1a9e42" : "none"} stroke={liked ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{likeCount}</span>
      </button>
      {/* Comment */}
      <button onClick={onComment} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.95)" }}>{commentCount}</span>
      </button>
      {/* Notes */}
      {onNotes && (
        <button onClick={onNotes} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: notesOpen ? "rgba(26,158,66,0.15)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${notesOpen ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={notesOpen ? "#1a9e42" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
        </button>
      )}
      {/* Share */}
      <button onClick={handleShare} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: copied ? "rgba(26,158,66,0.2)" : "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: `1px solid ${copied ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      {/* Report (non-owner only) */}
      {onReport && (
        <button onClick={onReport} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </div>
          <span style={{ height: 13, display: "block" }} />
        </button>
      )}
    </div>
  );
}

function SeriesCard({
  item, isActive, muted, onMuteToggle, onTapCourse, onTapUser, onComment,
}: {
  item: Extract<FeedItem, { type: "series" }>;
  isActive: boolean; muted: boolean;
  onMuteToggle: () => void;
  onTapCourse: () => void; onTapUser: () => void; onComment: () => void;
}) {
  const [shotIndex, setShotIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastTapRef = useRef<number>(0);
  const activeShot = item.shots[shotIndex];
  const hasNotes = !!(activeShot?.shotType || activeShot?.strategyNote || activeShot?.clubUsed || activeShot?.windCondition || activeShot?.datePlayedAt);

  useEffect(() => {
    if (!isActive) {
      Object.values(videoRefs.current).forEach(v => { if (v) { v.pause(); v.currentTime = 0; } });
      setShotIndex(0);
      return;
    }
    item.shots.forEach((shot, i) => {
      const el = videoRefs.current[shot.id];
      if (!el) return;
      if (i === shotIndex) { el.currentTime = 0; el.play().catch(() => {}); }
      else { el.pause(); el.currentTime = 0; }
    });
  }, [isActive, shotIndex, item.shots]);

  useEffect(() => {
    const el = videoRefs.current[activeShot?.id];
    if (el) el.muted = muted;
  }, [muted, activeShot]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      e.stopPropagation();
      if (dx > 0 && shotIndex < item.shots.length - 1) setShotIndex(i => i + 1);
      else if (dx < 0 && shotIndex > 0) setShotIndex(i => i - 1);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) { onTapCourse(); }
    else { onMuteToggle(); }
    lastTapRef.current = now;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#000", display: "flex", justifyContent: "center" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ position: "relative", width: "100%", maxWidth: 390, height: "100%", overflow: "hidden", background: "#07100a" }}>
      {item.shots.map((shot, i) => (
        <div key={shot.id} style={{ position: "absolute", inset: 0, opacity: i === shotIndex ? 1 : 0, transition: "opacity 0.18s", pointerEvents: i === shotIndex ? "auto" : "none" }}>
          {shot.mediaType === "VIDEO" ? (
            <video ref={el => { videoRefs.current[shot.id] = el; }} src={shot.mediaUrl} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleTap} />
          ) : (
            <img src={shot.mediaUrl} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleTap} />
          )}
        </div>
      ))}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%)", pointerEvents: "none", zIndex: 5 }} />

      <FeedTopBar
        courseLogoUrl={item.courseLogoUrl}
        courseName={item.courseName}
        holeNumber={item.holeNumber}
        shotType={item.shots[shotIndex]?.shotType}
        datePlayedAt={item.shots[shotIndex]?.datePlayedAt}
        muted={muted}
        onMuteToggle={onMuteToggle}
        onTapCourse={onTapCourse}
      />

      {/* Shot progress dots */}
      {item.shots.length > 1 && (
        <div style={{ position: "absolute", top: 116, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 20, pointerEvents: "none" }}>
          {item.shots.map((_, i) => (
            <div key={i} style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#1a9e42" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 22 : 7, transition: "all 0.3s" }} />
          ))}
        </div>
      )}

      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeShot.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      {shotIndex > 0 && (
        <button onClick={() => setShotIndex(i => i - 1)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {shotIndex < item.shots.length - 1 && (
        <button onClick={() => setShotIndex(i => i + 1)} style={{ position: "absolute", right: 76, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <RightPanel userId={item.userId} avatarUrl={item.avatarUrl} username={item.username} courseId={item.courseId} courseName={item.courseName} liked={false} onLike={() => {}} likeCount={item.shots[0]?.likeCount || 0} onComment={onComment} commentCount={item.shots[0]?.commentCount || 0} onTapUser={onTapUser} onNotes={hasNotes ? () => setNotesOpen(o => !o) : null} notesOpen={notesOpen} />

      {notesOpen && (
        <>
          <div onClick={() => setNotesOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,28,16,0.97)", borderTop: "1px solid rgba(26,158,66,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", backdropFilter: "blur(20px)" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>{item.holeNumber ? `Hole ${item.holeNumber} · ` : ""}Scout Notes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activeShot?.shotType && SHOT_LABEL[activeShot.shotType] && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shot Type</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#1a9e42" }}>{SHOT_LABEL[activeShot.shotType]}</span>
                </div>
              )}
              {activeShot?.clubUsed && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Club</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{activeShot.clubUsed}</span>
                </div>
              )}
              {activeShot?.windCondition && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Wind</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{activeShot.windCondition.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}</span>
                </div>
              )}
              {activeShot?.datePlayedAt && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Played</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{new Date(activeShot.datePlayedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              )}
              {activeShot?.strategyNote && (
                <div style={{ paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{activeShot.strategyNote}</div>
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

function VideoCard({
  clip, isActive, muted, onMuteToggle, onTapCourse, onTapUser, onComment, onEnded, onReport,
}: {
  clip: FeedClip; isActive: boolean; muted: boolean;
  onMuteToggle: () => void;
  onTapCourse: () => void; onTapUser: () => void; onComment: () => void;
  onEnded: () => void;
  onReport?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { liked, likeCount, toggleLike } = useLike({ uploadId: clip.id, initialLikeCount: clip.likeCount || 0 });
  const [videoPaused, setVideoPaused] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotes = !!(clip.shotType || clip.strategyNote || clip.clubUsed || clip.windCondition || clip.datePlayedAt);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) { video.play().catch(() => {}); setVideoPaused(false); }
    else { video.pause(); video.currentTime = 0; }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#000", display: "flex", justifyContent: "center" }}>
      {/* Inner wrapper — constrains clip to 390px on desktop */}
      <div style={{ position: "relative", width: "100%", maxWidth: 390, height: "100%", overflow: "hidden" }}>
      {clip.mediaType === "VIDEO" ? (
        <video ref={videoRef} src={clip.mediaUrl} muted={muted} playsInline
          onClick={() => {
            const v = videoRef.current; if (!v) return;
            if (v.paused) { v.play().catch(() => {}); setVideoPaused(false); }
            else { v.pause(); setVideoPaused(true); }
          }}
          onEnded={onEnded}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%)", pointerEvents: "none", zIndex: 5 }} />

      {videoPaused && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15, pointerEvents: "none", opacity: 0.7 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </div>
        </div>
      )}

      <FeedTopBar
        courseLogoUrl={clip.courseLogoUrl}
        courseName={clip.courseName}
        holeNumber={clip.holeNumber}
        shotType={clip.shotType}
        datePlayedAt={clip.datePlayedAt}
        muted={muted}
        onMuteToggle={onMuteToggle}
        onTapCourse={onTapCourse}
      />

      {clip.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 10, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{clip.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      <RightPanel userId={clip.userId} avatarUrl={clip.avatarUrl} username={clip.username} courseId={clip.courseId} courseName={clip.courseName} liked={liked} onLike={toggleLike} likeCount={likeCount} onComment={onComment} commentCount={clip.commentCount} onTapUser={onTapUser} onNotes={hasNotes ? () => setNotesOpen(o => !o) : null} notesOpen={notesOpen} onReport={onReport} />

      {notesOpen && (
        <>
          <div onClick={() => setNotesOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,28,16,0.97)", borderTop: "1px solid rgba(26,158,66,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", backdropFilter: "blur(20px)" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>{clip.holeNumber ? `Hole ${clip.holeNumber} · ` : ""}Scout Notes</div>
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
              {clip.strategyNote && (
                <div style={{ paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>{clip.strategyNote}</div>
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

export default function Home() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [user, setUser] = useState<any>(undefined); // undefined = auth not yet checked, null = confirmed logged out
  const [userProfile, setUserProfile] = useState<any>(null);
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [commentUploadId, setCommentUploadId] = useState<string | null>(null);
  const [commentItems, setCommentItems] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [splashVisible, setSplashVisible] = useState(false);
  const [splashFading, setSplashFading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearMeCourses, setNearMeCourses] = useState<TrendingCourse[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [nearMeRadius, setNearMeRadius] = useState(50);
  const [publicOnly, setPublicOnly] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [reportClipId, setReportClipId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUser(data.user);
      const { data: profile } = await supabase.from("User").select("username, avatarUrl, displayName").eq("id", data.user.id).single();
      setUserProfile(profile);
    });

    supabase
      .from("Course")
      .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
      .gt("uploadCount", 0)
      .order("uploadCount", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setTrendingCourses(data); });

    async function loadFeed() {
      const { data: rawUploads } = await supabase
        .from("Upload")
        .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, windCondition, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, datePlayedAt, createdAt, rankScore")
        .eq("moderationStatus", "APPROVED")
        .order("rankScore", { ascending: false, nullsFirst: false })
        .limit(30);

      // Apply ±20% random jitter so new clips with similar scores shuffle each load
      const uploads = rawUploads
        ? [...rawUploads]
            .map(u => ({ ...u, _jittered: (u.rankScore ?? 0) * (0.8 + Math.random() * 0.4) }))
            .sort((a, b) => b._jittered - a._jittered)
            .slice(0, 15)
        : [];

      if (!rawUploads || uploads.length === 0) { setLoading(false); return; }

      const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
      const userIds = [...new Set(uploads.map((u: any) => u.userId))];
      const holeIds = [...new Set(uploads.map((u: any) => u.holeId).filter(Boolean))];

      const [{ data: courses }, { data: users }, { data: holes }] = await Promise.all([
        supabase.from("Course").select("id, name, logoUrl").in("id", courseIds),
        supabase.from("User").select("id, username, avatarUrl").in("id", userIds),
        supabase.from("Hole").select("id, holeNumber").in("id", holeIds),
      ]);

      const enriched: FeedClip[] = uploads.map((u: any) => ({
        ...u,
        commentCount: u.commentCount || 0,
        courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
        courseLogoUrl: courses?.find((c: any) => c.id === u.courseId)?.logoUrl || null,
        username: users?.find((usr: any) => usr.id === u.userId)?.username || "golfer",
        avatarUrl: users?.find((usr: any) => usr.id === u.userId)?.avatarUrl || null,
        holeNumber: holes?.find((h: any) => h.id === u.holeId)?.holeNumber || undefined,
      }));

      const seriesMap: Record<string, FeedClip[]> = {};
      const singleClips: FeedClip[] = [];
      enriched.forEach(clip => {
        if (clip.seriesId) {
          if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
          seriesMap[clip.seriesId].push(clip);
        } else {
          singleClips.push(clip);
        }
      });

      const seriesItems: FeedItem[] = Object.entries(seriesMap).map(([seriesId, shots]) => {
        const sorted = shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
        const first = sorted[0];
        return { type: "series", seriesId, shots: sorted, courseName: first.courseName, courseLogoUrl: first.courseLogoUrl, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId };
      });

      const singleItems: FeedItem[] = singleClips
        .sort((a, b) => { if (a.mediaType === "VIDEO" && b.mediaType !== "VIDEO") return -1; if (a.mediaType !== "VIDEO" && b.mediaType === "VIDEO") return 1; return 0; })
        .map(clip => ({ type: "clip", clip }));

      setFeedItems([...seriesItems, ...singleItems]);
      feedCursorRef.current = uploads[uploads.length - 1].createdAt;
      hasMoreRef.current = uploads.length === 15;
      setLoading(false);
    }

    loadFeed();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const feed = feedRef.current;
      if (!feed) return;
      // Slot 0 = discovery section; feed clips start at slot 1 → feedItems index 0
      const rawIndex = Math.round(feed.scrollTop / window.innerHeight);
      setActiveIndex(rawIndex - 1);
    }, 50);
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (!feedCursorRef.current || loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const supabase = createClient();
    const { data: uploads } = await supabase
      .from("Upload")
      .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, windCondition, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, datePlayedAt, createdAt")
      .eq("moderationStatus", "APPROVED")
      .order("createdAt", { ascending: false })
      .lt("createdAt", feedCursorRef.current)
      .limit(15);

    if (!uploads || uploads.length === 0) {
      hasMoreRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
    const userIds = [...new Set(uploads.map((u: any) => u.userId))];
    const holeIds = [...new Set(uploads.map((u: any) => u.holeId).filter(Boolean))];

    const [{ data: courses }, { data: users }, { data: holes }] = await Promise.all([
      supabase.from("Course").select("id, name, logoUrl").in("id", courseIds),
      supabase.from("User").select("id, username, avatarUrl").in("id", userIds),
      supabase.from("Hole").select("id, holeNumber").in("id", holeIds),
    ]);

    const enriched: FeedClip[] = uploads.map((u: any) => ({
      ...u,
      commentCount: u.commentCount || 0,
      courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
      courseLogoUrl: courses?.find((c: any) => c.id === u.courseId)?.logoUrl || null,
      username: users?.find((usr: any) => usr.id === u.userId)?.username || "golfer",
      avatarUrl: users?.find((usr: any) => usr.id === u.userId)?.avatarUrl || null,
      holeNumber: holes?.find((h: any) => h.id === u.holeId)?.holeNumber || undefined,
    }));

    const seriesMap: Record<string, FeedClip[]> = {};
    const singleClips: FeedClip[] = [];
    enriched.forEach(clip => {
      if (clip.seriesId) {
        if (!seriesMap[clip.seriesId]) seriesMap[clip.seriesId] = [];
        seriesMap[clip.seriesId].push(clip);
      } else {
        singleClips.push(clip);
      }
    });

    const newItems: FeedItem[] = [
      ...Object.entries(seriesMap).map(([seriesId, shots]) => {
        const sorted = shots.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
        const first = sorted[0];
        return { type: "series" as const, seriesId, shots: sorted, courseName: first.courseName, courseLogoUrl: first.courseLogoUrl, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId };
      }),
      ...singleClips.map(clip => ({ type: "clip" as const, clip })),
    ];

    setFeedItems(prev => [...prev, ...newItems]);
    feedCursorRef.current = uploads[uploads.length - 1].createdAt;
    hasMoreRef.current = uploads.length === 15;
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (feedItems.length === 0) return;
    if (activeIndex >= feedItems.length - 3) loadMoreFeed();
  }, [activeIndex, feedItems.length, loadMoreFeed]);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastSplash = localStorage.getItem("tour-it-splash-date");
    if (lastSplash === today) return;
    localStorage.setItem("tour-it-splash-date", today);
    setSplashVisible(true);
    const fadeTimer = setTimeout(() => setSplashFading(true), 2000);
    const hideTimer = setTimeout(() => setSplashVisible(false), 2600);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("tour-it-onboarded")) setShowOnboarding(true);

    // Check for ?welcome=1 from post-signup onboarding redirect
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("welcome") === "1") {
        setShowWelcome(true);
        window.history.replaceState({}, "", "/");
      }
    }

    // Auto-load near me if previously granted
    if (localStorage.getItem("tour-it-location-denied")) {
      setLocationStatus("denied");
      return;
    }
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) fetchNearMe(); // fetchNearMe always refreshes coords in background
    } catch {}
  }, []);

  useEffect(() => {
    if (!commentUploadId) { setCommentItems([]); return; }
    setLoadingComments(true);
    const supabase = createClient();
    supabase
      .from("Comment")
      .select("id, body, createdAt, userId, user:User(username, avatarUrl)")
      .eq("uploadId", commentUploadId)
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setCommentItems(data.map((c: any) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            username: c.user?.username || "golfer",
            avatarUrl: c.user?.avatarUrl || null,
          })));
        }
        setLoadingComments(false);
      });
  }, [commentUploadId]);

  function dismissOnboarding() {
    localStorage.setItem("tour-it-onboarded", "1");
    setShowOnboarding(false);
  }

  async function submitComment() {
    if (!commentText.trim() || !user || !commentUploadId || submittingComment) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const id = crypto.randomUUID();
    const { error } = await supabase.from("Comment").insert({
      id,
      uploadId: commentUploadId,
      userId: user.id,
      body: commentText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!error) {
      const { data: uploadData } = await supabase.from("Upload").select("commentCount, likeCount, createdAt").eq("id", commentUploadId).single();
      const newCommentCount = (uploadData?.commentCount || 0) + 1;
      const { computeRankScore } = await import("@/lib/rankScore");
      const newRank = uploadData ? computeRankScore(uploadData.likeCount || 0, newCommentCount, uploadData.createdAt) : undefined;
      await supabase.from("Upload").update({ commentCount: newCommentCount, ...(newRank !== undefined && { rankScore: newRank }) }).eq("id", commentUploadId);
      setCommentItems(prev => [...prev, {
        id,
        body: commentText.trim(),
        createdAt: new Date().toISOString(),
        username: userProfile?.username || "golfer",
        avatarUrl: userProfile?.avatarUrl || null,
      }]);
      setFeedItems(prev => prev.map(item => {
        if (item.type === "clip" && item.clip.id === commentUploadId) {
          return { ...item, clip: { ...item.clip, commentCount: item.clip.commentCount + 1 } };
        }
        return item;
      }));
      setCommentText("");
    }
    setSubmittingComment(false);
  }

  function fetchNearMe(radiusOverride?: number, publicOnlyOverride?: boolean) {
    if (!navigator.geolocation) return;
    setLocationStatus("loading");
    const radius = radiusOverride ?? nearMeRadius;
    const onlyPublic = publicOnlyOverride ?? publicOnly;

    async function doFetch(lat: number, lng: number) {
      const RANGE = radius / 69; // degrees ≈ miles / 69
      let query = createClient()
        .from("Course")
        .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl, isPublic")
        .gte("latitude", lat - RANGE).lte("latitude", lat + RANGE)
        .gte("longitude", lng - RANGE).lte("longitude", lng + RANGE);
      if (onlyPublic) query = query.eq("isPublic", true);
      const { data } = await query.order("uploadCount", { ascending: false }).limit(20);
      setNearMeCourses(data || []);
      setLocationStatus("granted");
    }

    // Use cached coords if fresh (< 1h) for instant display, but always refresh in background
    let usedCache = false;
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { lat, lng, ts } = JSON.parse(raw);
        if (Date.now() - ts < 3600000) { doFetch(lat, lng); usedCache = true; }
      }
    } catch {}

    // Always request fresh location to keep coords current
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem("tour-it-location", JSON.stringify({ lat, lng, ts: Date.now() }));
        // If we didn't use cache, fetch now; if we did, silently update for next load
        if (!usedCache) doFetch(lat, lng);
      },
      () => {
        if (!usedCache) {
          localStorage.setItem("tour-it-location-denied", "1");
          setLocationStatus("denied");
        }
      }
    );
  }

  return (
    <main style={{ height: "100svh", background: "#07100a", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; overflow: hidden; }
        @keyframes pulse-ring { 0%,100% { transform: scale(1); opacity: 0.18; } 50% { transform: scale(1.18); opacity: 0.07; } }
        .feed { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed::-webkit-scrollbar { display: none; }
        .feed-item { scroll-snap-align: start; scroll-snap-stop: always; }
        .courses-row { display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding: 0 20px 4px; }
        .courses-row::-webkit-scrollbar { display: none; }
        @keyframes bounce-down { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .bounce-arrow { animation: bounce-down 1.6s ease-in-out infinite; display: inline-block; }
        @keyframes splash-logo-in { 0% { opacity: 0; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes splash-tagline-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes splash-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
        .splash-logo { animation: splash-logo-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .splash-tagline { animation: splash-tagline-in 0.5s ease forwards 0.5s; opacity: 0; }
        .splash-fade-out { animation: splash-fade-out 0.6s ease forwards; }
      `}</style>

      {/* ── Hamburger drawer ── */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          {/* Backdrop */}
          <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          {/* Panel */}
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "72vw", maxWidth: 300, background: "#07100a", borderRight: "1px solid rgba(77,168,98,0.18)", display: "flex", flexDirection: "column", paddingTop: 64, paddingBottom: 40 }}>
            {/* Close */}
            <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 18, right: 16, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Logo mark */}
            <div style={{ paddingLeft: 24, paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 36, width: "auto" }} />
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 12 }}>
              {[
                { label: "My Profile", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, onClick: () => { setMenuOpen(false); router.push("/profile"); } },
                { label: "My Trips", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>, onClick: () => { setMenuOpen(false); router.push("/trips"); } },
                { label: "Privacy Policy", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, onClick: () => { setMenuOpen(false); router.push("/privacy"); } },
                { label: "Contact Us", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, onClick: () => { setMenuOpen(false); window.location.href = "mailto:corey@touritgolf.com"; } },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.82)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, textAlign: "left", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(77,168,98,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ color: "#4da862", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Log out */}
            {user && (
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "rgba(255,100,100,0.8)", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 500, width: "100%", textAlign: "left" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log Out
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={feedRef} className="feed" onScroll={handleScroll} style={{ paddingLeft: isDesktop ? 72 : 0 }}>

        {/* ── Discovery section ── */}
        <div className="feed-item" style={{ height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none" }}>
          {/* Green header bar */}
          <div style={{ position: "relative", background: "linear-gradient(180deg, #1c4425 0%, #102916 100%)", borderBottom: "1px solid rgba(77,168,98,0.35)", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(77,168,98,0.07) 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
            {/* 3-col row: hamburger | logo | bell */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", paddingTop: "max(14px, env(safe-area-inset-top))", paddingBottom: 10, paddingLeft: 16, paddingRight: 16, position: "relative", zIndex: 1 }}>
              {/* Hamburger */}
              <button onClick={() => setMenuOpen(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)", display: isDesktop ? "none" : "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
                <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
              </button>
              {/* Logo — centered on mobile, left-aligned on desktop */}
              <div style={{ display: "flex", justifyContent: isDesktop ? "flex-start" : "center" }}>
                <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: isDesktop ? 56 : 44, width: "auto" }} />
              </div>
              {/* Bell — right-aligned in third column */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <NotificationBellInline />
              </div>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ padding: "16px 20px 12px", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
              Scout your next round
            </div>
          </div>

          {/* Search CTA */}
          <div style={{ padding: "0 20px 18px", flexShrink: 0 }}>
            <button
              onClick={() => router.push("/search")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "rgba(26,158,66,0.07)", border: "1.5px solid rgba(26,158,66,0.55)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", boxShadow: "0 0 18px rgba(26,158,66,0.2), inset 0 0 10px rgba(26,158,66,0.04)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(26,158,66,0.85)" }}>Find a course — name, city, or state</span>
            </button>
          </div>

          {/* Logged-out sign-up nudge */}
          {user === null && (
            <div style={{ padding: "0 20px 18px", flexShrink: 0 }}>
              <button
                onClick={() => router.push("/signup")}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(26,158,66,0.07)", border: "1px solid rgba(26,158,66,0.22)", borderRadius: 12, padding: "12px 16px", cursor: "pointer" }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Save courses. Upload clips. Scout smarter.</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Takes 30 seconds</div>
                </div>
                <div style={{ background: "#2d7a42", borderRadius: 8, padding: "7px 14px", flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>Join</span>
                </div>
              </button>
            </div>
          )}

          {/* Popular courses */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ padding: "0 20px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
              Popular on Tour It
            </div>
            <div className="courses-row">
              {trendingCourses.length > 0 ? trendingCourses.map(course => (
                <CourseCard key={course.id} course={course} onClick={() => router.push(`/courses/${course.id}`)} />
              )) : [1, 2, 3].map(i => (
                <div key={i} style={{ width: 148, height: 188, borderRadius: 14, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          </div>

          {/* Courses Near Me */}
          {locationStatus !== "denied" && (
            <div style={{ flexShrink: 0, marginTop: 10 }}>
              <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
                  Courses Near Me
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {locationStatus === "granted" && [10, 25, 50].map(r => (
                    <button key={r} onClick={() => { setNearMeRadius(r); fetchNearMe(r); }} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: nearMeRadius === r ? "#fff" : "rgba(255,255,255,0.35)", background: nearMeRadius === r ? "rgba(26,158,66,0.3)" : "rgba(255,255,255,0.05)", border: `1px solid ${nearMeRadius === r ? "rgba(26,158,66,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 99, padding: "3px 9px", cursor: "pointer" }}>
                      {r}mi
                    </button>
                  ))}
                  {locationStatus === "idle" && (
                    <button onClick={() => fetchNearMe()} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(26,158,66,0.1)", border: "1px solid rgba(26,158,66,0.25)", borderRadius: 99, padding: "4px 12px", cursor: "pointer" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a9e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#1a9e42" }}>Enable</span>
                    </button>
                  )}
                </div>
              </div>
              {locationStatus === "idle" && (
                <div style={{ padding: "0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
                  Tap Enable to find courses within {nearMeRadius} miles of you.
                </div>
              )}
              {locationStatus === "granted" && (
                <button
                  onClick={() => { const next = !publicOnly; setPublicOnly(next); fetchNearMe(undefined, next); }}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 20px 10px", background: "none", border: "none", cursor: "pointer" }}
                >
                  <div style={{ width: 28, height: 16, borderRadius: 99, background: publicOnly ? "#2d7a42" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: publicOnly ? 12 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </div>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: publicOnly ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>Public only</span>
                </button>
              )}
              {locationStatus === "loading" && (
                <div className="courses-row">
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ width: 148, height: 188, borderRadius: 14, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} />
                  ))}
                </div>
              )}
              {locationStatus === "granted" && nearMeCourses.length > 0 && (
                <div className="courses-row">
                  {nearMeCourses.map(course => (
                    <CourseCard key={course.id} course={course} onClick={() => router.push(`/courses/${course.id}`)} />
                  ))}
                </div>
              )}
              {locationStatus === "granted" && nearMeCourses.length === 0 && (
                <div style={{ padding: "0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                  No courses found within {nearMeRadius} miles.
                </div>
              )}
            </div>
          )}

          {/* Bridge to feed */}
          <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 104 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="bounce-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1, whiteSpace: "nowrap" }}>
                Scroll to find your next bucket list course
              </div>
              <div className="bounce-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Feed clips ── */}
        {!loading && feedItems.map((item, i) => (
          <div key={item.type === "clip" ? item.clip.id : item.seriesId} className="feed-item">
            {item.type === "series" ? (
              <SeriesCard item={item} isActive={i === activeIndex} muted={muted} onMuteToggle={() => setMuted(m => !m)} onTapUser={() => router.push(`/profile/${item.userId}`)} onTapCourse={() => router.push(`/courses/${item.courseId}`)} onComment={() => setCommentUploadId(item.shots[0]?.id || null)} />
            ) : (
              <VideoCard clip={item.clip} isActive={i === activeIndex} muted={muted} onMuteToggle={() => setMuted(m => !m)} onTapUser={() => router.push(`/profile/${item.clip.userId}`)} onTapCourse={() => router.push(`/courses/${item.clip.courseId}`)} onComment={() => setCommentUploadId(item.clip.id)} onEnded={() => feedRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" })} onReport={user && item.clip.userId !== user.id ? () => setReportClipId(item.clip.id) : undefined} />
            )}
          </div>
        ))}

        {!loading && feedItems.length === 0 && (
          <div className="feed-item" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>No clips yet — be the first to upload</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#1a9e42", border: "none", borderRadius: 10, padding: "12px 28px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Upload the first clip</button>
          </div>
        )}
      </div>

      {loadingMore && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(0,0,0,0.6)", borderRadius: 99, padding: "6px 16px", backdropFilter: "blur(8px)" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Loading more...</span>
        </div>
      )}

      {/* Comment sheet */}
      {commentUploadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => { setCommentUploadId(null); setCommentText(""); }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", maxHeight: "72vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "12px auto 8px" }} />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Comments</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {loadingComments ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "24px 0" }}>Loading...</div>
              ) : commentItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "32px 0", lineHeight: 1.6 }}>No comments yet.<br />Be the first to say something!</div>
              ) : commentItems.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(26,158,66,0.2)", border: "1px solid rgba(26,158,66,0.25)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(26,158,66,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#1a9e42" }}>@{c.username} </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.82)" }}>{c.body}</span>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{formatTimeAgo(c.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px 36px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={user ? "Add a comment..." : "Log in to comment"} disabled={!user} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", outline: "none" }} onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) submitComment(); }} />
              <button onClick={submitComment} disabled={!commentText.trim() || submittingComment || !user} style={{ background: "#2d7a42", border: "none", borderRadius: 10, padding: "10px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!commentText.trim() || !user) ? 0.4 : 1 }}>
                {submittingComment ? "..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome moment — shown after signup/onboarding */}
      {showWelcome && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowWelcome(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "28px 24px 52px" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, margin: "0 auto 24px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10 }}>
              You&apos;re in. Welcome to Tour It.
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>
              Every course on here gets better when golfers who&apos;ve played it contribute. Start by finding your home course — add a clip, drop some intel, and make it useful for whoever&apos;s playing next.
            </div>
            <button
              onClick={() => { setShowWelcome(false); router.push("/search"); }}
              style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", boxShadow: "0 2px 16px rgba(45,122,66,0.4)", marginBottom: 12 }}
            >
              Find my home course
            </button>
            <button
              onClick={() => setShowWelcome(false)}
              style={{ width: "100%", background: "none", border: "none", padding: "12px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
            >
              Explore first
            </button>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <TourItLogo size={48} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 14, marginBottom: 8 }}>Welcome to Tour It</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>Scout any golf course before you play — real clips from golfers who&apos;ve already been there.</div>
            </div>
            {[
              { icon: "🎥", title: "Watch hole-by-hole clips", desc: "See tee shots, approaches, and putts from real rounds" },
              { icon: "📌", title: "Save courses to your list", desc: "Build your bucket list and track rounds you've played" },
              { icon: "⛳", title: "Upload your own footage", desc: "Help other golfers by sharing your course knowledge" },
            ].map(f => (
              <div key={f.title} style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{f.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
            {!user ? (
              <>
                <button onClick={() => router.push("/signup")} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: 8, boxShadow: "0 2px 16px rgba(45,122,66,0.4)" }}>
                  Create an account
                </button>
                <button onClick={dismissOnboarding} style={{ width: "100%", background: "none", border: "none", padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", cursor: "pointer", marginTop: 4 }}>
                  Browse without an account
                </button>
                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(26,158,66,0.7)", cursor: "pointer", textDecoration: "underline" }}>
                    Already have an account? Sign in
                  </button>
                </div>
              </>
            ) : (
              <button onClick={dismissOnboarding} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: 8, boxShadow: "0 2px 16px rgba(45,122,66,0.4)" }}>
                Start Scouting
              </button>
            )}
          </div>
        </div>
      )}

      <BottomNav />

      {/* Report clip sheet */}
      {reportClipId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", zIndex: 150 }} onClick={() => { setReportClipId(null); setReportReason(null); setReportDone(false); }}>
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

      {/* ── Splash screen ── */}
      {splashVisible && (
        <div className={splashFading ? "splash-fade-out" : ""} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "#07100a",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 10,
        }}>
          <div className="splash-logo">
            <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 90, width: "auto", maxWidth: "82vw" }} />
          </div>
          <div className="splash-tagline" style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400,
            color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em",
          }}>
            See the shots before you play them.
          </div>
        </div>
      )}
    </main>
  );
}

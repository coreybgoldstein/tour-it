"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLike } from "@/hooks/useLike";

type TrendingCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  uploadCount: number;
  coverImageUrl: string | null;
  logoUrl: string | null;
};

type FeedClip = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  courseName: string;
  holeId: string;
  holeNumber?: number;
  strategyNote: string | null;
  clubUsed: string | null;
  shotType: string | null;
  username: string;
  avatarUrl: string | null;
  userId: string;
  likeCount: number;
  commentCount: number;
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
  createdAt: string;
};

type FeedItem =
  | { type: "clip"; clip: FeedClip }
  | { type: "series"; shots: FeedClip[]; seriesId: string; courseName: string; courseId: string; holeId: string; holeNumber?: number; username: string; avatarUrl: string | null; userId: string };

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

function HoleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="3" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 3 L20 7 L12 11 Z" fill="white" />
      <ellipse cx="12" cy="21" rx="4" ry="1.2" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function CourseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M2 10 L12 3 L22 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="10" width="16" height="11" rx="1" stroke="white" strokeWidth="1.8" fill="none" />
      <rect x="6" y="13" width="3" height="3" rx="0.5" stroke="white" strokeWidth="1.4" fill="none" />
      <rect x="15" y="13" width="3" height="3" rx="0.5" stroke="white" strokeWidth="1.4" fill="none" />
      <path d="M10 21 L10 17 Q12 15.5 14 17 L14 21" stroke="white" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
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
        border: "1px solid rgba(77,168,98,0.12)",
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
            <div style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(77,168,98,0.6)" }}>{abbr}</div>
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
          <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", background: "rgba(77,168,98,0.18)", borderRadius: 99, padding: "2px 8px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "#4da862" }}>{course.uploadCount} clips</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel({ courseId, courseName, onTapCourse, onTapHole, liked, onLike, likeCount, onComment, commentCount }: {
  courseId: string; courseName: string;
  onTapCourse: () => void; onTapHole: () => void;
  liked: boolean; onLike: () => void; likeCount: number;
  onComment: () => void; commentCount: number;
}) {
  return (
    <div style={{ position: "absolute", right: 12, bottom: 120, display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", zIndex: 5 }}>
      <button onClick={onLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: `1.5px solid ${liked ? "rgba(77,168,98,0.7)" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <span style={{ fontSize: "10px", color: liked ? "#4da862" : "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{likeCount}</span>
      </button>
      <button onClick={onComment} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{commentCount}</span>
      </button>
      <button onClick={onTapCourse} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}><CourseIcon /></div>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Course</span>
      </button>
      <button onClick={onTapHole} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}><HoleIcon /></div>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Hole</span>
      </button>
      <button
        onClick={() => {
          const url = `https://tour-it.vercel.app/courses/${courseId}`;
          if (navigator.share) navigator.share({ title: courseName, text: `Check out ${courseName} on Tour It — scout before you play`, url }).catch(() => {});
          else navigator.clipboard.writeText(url).then(() => alert("Link copied!")).catch(() => {});
        }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </div>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Share</span>
      </button>
    </div>
  );
}

function UserInfo({ avatarUrl, username, courseName, holeNumber, onTapUser, onTapCourse }: {
  avatarUrl: string | null; username: string; courseName: string; holeNumber?: number; onTapUser: () => void; onTapCourse: () => void;
}) {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 16px 90px", zIndex: 5 }}>
      <button onClick={onTapUser} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 7 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(77,168,98,0.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          }
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>@{username}</span>
      </button>
      <button onClick={onTapCourse} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "block", marginBottom: 4 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
          {courseName}
        </div>
      </button>
      {holeNumber && (
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, color: "#4da862" }}>
          Hole {holeNumber}
        </div>
      )}
    </div>
  );
}

function SeriesCard({
  item, isActive, muted, onUnmute, onTapCourse, onTapHole, onTapUser, onComment,
}: {
  item: Extract<FeedItem, { type: "series" }>;
  isActive: boolean; muted: boolean;
  onUnmute: () => void;
  onTapCourse: () => void; onTapHole: () => void; onTapUser: () => void; onComment: () => void;
}) {
  const [shotIndex, setShotIndex] = useState(0);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastTapRef = useRef<number>(0);
  const activeShot = item.shots[shotIndex];

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
    else { onUnmute(); }
    lastTapRef.current = now;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#07100a", overflow: "hidden" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {item.shots.map((shot, i) => (
        <div key={shot.id} style={{ position: "absolute", inset: 0, opacity: i === shotIndex ? 1 : 0, transition: "opacity 0.18s", pointerEvents: i === shotIndex ? "auto" : "none" }}>
          {shot.mediaType === "VIDEO" ? (
            <video ref={el => { videoRefs.current[shot.id] = el; }} src={shot.mediaUrl} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleTap} />
          ) : (
            <img src={shot.mediaUrl} alt="shot" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleTap} />
          )}
        </div>
      ))}

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.92) 100%)", pointerEvents: "none" }} />

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
        <div style={{ background: "rgba(180,145,60,0.85)", backdropFilter: "blur(8px)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#fff" }}>🏌️ Play a Hole With Me</span>
        </div>
      </div>

      <div style={{ position: "absolute", top: 100, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 5, pointerEvents: "none" }}>
        {item.shots.map((_, i) => (
          <div key={i} style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#c8a96e" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 22 : 7, transition: "all 0.3s" }} />
        ))}
      </div>

      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 5, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeShot.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      {shotIndex > 0 && (
        <button onClick={() => setShotIndex(i => i - 1)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      )}
      {shotIndex < item.shots.length - 1 && (
        <button onClick={() => setShotIndex(i => i + 1)} style={{ position: "absolute", right: 60, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      <RightPanel courseId={item.courseId} courseName={item.courseName} onTapCourse={onTapCourse} onTapHole={onTapHole} liked={false} onLike={() => {}} likeCount={0} onComment={onComment} commentCount={item.shots[0]?.commentCount || 0} />
      <UserInfo avatarUrl={item.avatarUrl} username={item.username} courseName={item.courseName} holeNumber={item.holeNumber} onTapUser={onTapUser} onTapCourse={onTapCourse} />

      {shotIndex === 0 && item.shots.length > 1 && (
        <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 4, opacity: 0.7, pointerEvents: "none", zIndex: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>SWIPE FOR NEXT SHOT</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      )}
    </div>
  );
}

function VideoCard({
  clip, isActive, muted, onUnmute, onTapCourse, onTapHole, onTapUser, onComment,
}: {
  clip: FeedClip; isActive: boolean; muted: boolean;
  onUnmute: () => void;
  onTapCourse: () => void; onTapHole: () => void; onTapUser: () => void; onComment: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { liked, likeCount, toggleLike } = useLike({
    uploadId: clip.id,
    initialLikeCount: clip.likeCount || 0,
  });
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) { video.play().catch(() => {}); }
    else { video.pause(); video.currentTime = 0; }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) { onTapCourse(); }
    else { onUnmute(); }
    lastTapRef.current = now;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#07100a", overflow: "hidden" }}>
      {clip.mediaType === "VIDEO" ? (
        <video ref={videoRef} src={clip.mediaUrl} loop muted={muted} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleMediaTap} />
      ) : (
        <img src={clip.mediaUrl} alt="clip" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={handleMediaTap} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.92) 100%)", pointerEvents: "none" }} />

      {clip.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 5, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{clip.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      <RightPanel courseId={clip.courseId} courseName={clip.courseName} onTapCourse={onTapCourse} onTapHole={onTapHole} liked={liked} onLike={toggleLike} likeCount={likeCount} onComment={onComment} commentCount={clip.commentCount} />
      <UserInfo avatarUrl={clip.avatarUrl} username={clip.username} courseName={clip.courseName} holeNumber={clip.holeNumber} onTapUser={onTapUser} onTapCourse={onTapCourse} />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearMeCourses, setNearMeCourses] = useState<TrendingCourse[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase.from("User").select("username, avatarUrl, displayName").eq("id", data.user.id).single();
        setUserProfile(profile);
      }
    });

    supabase
      .from("Course")
      .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
      .gt("uploadCount", 0)
      .order("uploadCount", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setTrendingCourses(data); });

    async function loadFeed() {
      const { data: uploads } = await supabase
        .from("Upload")
        .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, createdAt")
        .order("createdAt", { ascending: false })
        .limit(15);

      if (!uploads || uploads.length === 0) { setLoading(false); return; }

      const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
      const userIds = [...new Set(uploads.map((u: any) => u.userId))];
      const holeIds = [...new Set(uploads.map((u: any) => u.holeId).filter(Boolean))];

      const [{ data: courses }, { data: users }, { data: holes }] = await Promise.all([
        supabase.from("Course").select("id, name").in("id", courseIds),
        supabase.from("User").select("id, username, avatarUrl").in("id", userIds),
        supabase.from("Hole").select("id, holeNumber").in("id", holeIds),
      ]);

      const enriched: FeedClip[] = uploads.map((u: any) => ({
        ...u,
        commentCount: u.commentCount || 0,
        courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
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
        return { type: "series", seriesId, shots: sorted, courseName: first.courseName, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId };
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
      .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, shotType, likeCount, commentCount, userId, seriesId, seriesOrder, yardageOverlay, createdAt")
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
      supabase.from("Course").select("id, name").in("id", courseIds),
      supabase.from("User").select("id, username, avatarUrl").in("id", userIds),
      supabase.from("Hole").select("id, holeNumber").in("id", holeIds),
    ]);

    const enriched: FeedClip[] = uploads.map((u: any) => ({
      ...u,
      commentCount: u.commentCount || 0,
      courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
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
        return { type: "series" as const, seriesId, shots: sorted, courseName: first.courseName, courseId: first.courseId, holeId: first.holeId, holeNumber: first.holeNumber, username: first.username, avatarUrl: first.avatarUrl, userId: first.userId };
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
    if (!localStorage.getItem("tour-it-onboarded")) setShowOnboarding(true);

    // Auto-load near me if previously granted
    if (localStorage.getItem("tour-it-location-denied")) {
      setLocationStatus("denied");
      return;
    }
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < 86400000) fetchNearMe();
      }
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
      const { data: uploadData } = await supabase.from("Upload").select("commentCount").eq("id", commentUploadId).single();
      await supabase.from("Upload").update({ commentCount: (uploadData?.commentCount || 0) + 1 }).eq("id", commentUploadId);
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

  function fetchNearMe() {
    if (!navigator.geolocation) return;
    setLocationStatus("loading");

    async function doFetch(lat: number, lng: number) {
      const RANGE = 0.5;
      const { data } = await createClient()
        .from("Course")
        .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
        .gte("latitude", lat - RANGE).lte("latitude", lat + RANGE)
        .gte("longitude", lng - RANGE).lte("longitude", lng + RANGE)
        .order("uploadCount", { ascending: false }).limit(10);
      setNearMeCourses(data || []);
      setLocationStatus("granted");
    }

    // Use cached coords if fresh (< 24h)
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { lat, lng, ts } = JSON.parse(raw);
        if (Date.now() - ts < 86400000) { doFetch(lat, lng); return; }
      }
    } catch {}

    // Request fresh permission
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem("tour-it-location", JSON.stringify({ lat, lng, ts: Date.now() }));
        doFetch(lat, lng);
      },
      () => {
        localStorage.setItem("tour-it-location-denied", "1");
        setLocationStatus("denied");
      }
    );
  }

  return (
    <main style={{ height: "100svh", background: "#07100a", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; overflow: hidden; }
        .feed { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed::-webkit-scrollbar { display: none; }
        .feed-item { scroll-snap-align: start; scroll-snap-stop: always; }
        .courses-row { display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding: 0 20px 4px; }
        .courses-row::-webkit-scrollbar { display: none; }
        @keyframes bounce-down { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .bounce-arrow { animation: bounce-down 1.6s ease-in-out infinite; display: inline-block; }
      `}</style>

      <div ref={feedRef} className="feed" onScroll={handleScroll}>

        {/* ── Discovery section ── */}
        <div className="feed-item" style={{ height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none" }}>
          {/* Top bar */}
          <div style={{ padding: "48px 20px 10px", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src="/tour-it-logo.png" alt="Tour It" style={{ height: 34, width: "auto" }} />
          </div>

          {/* Hero text */}
          <div style={{ padding: "2px 20px 14px", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 25, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 8 }}>
              Scout your next round.
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
              Watch the course before your round.
            </div>
          </div>

          {/* Search CTA */}
          <div style={{ padding: "0 20px 18px", flexShrink: 0 }}>
            <button
              onClick={() => router.push("/search")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "rgba(77,168,98,0.07)", border: "1.5px solid rgba(77,168,98,0.55)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", boxShadow: "0 0 18px rgba(77,168,98,0.2), inset 0 0 10px rgba(77,168,98,0.04)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(77,168,98,0.85)" }}>Find a course — name, city, or state...</span>
            </button>
          </div>

          {/* Popular courses */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ padding: "0 20px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
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
            <div style={{ flexShrink: 0, marginTop: 24 }}>
              <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
                  Courses Near Me
                </div>
                {locationStatus === "idle" && (
                  <button onClick={fetchNearMe} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "4px 12px", cursor: "pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862" }}>Enable</span>
                  </button>
                )}
              </div>
              {locationStatus === "idle" && (
                <div style={{ padding: "0 20px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
                  Tap Enable to find courses within ~35 miles of you.
                </div>
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
                  No courses found within 35 miles.
                </div>
              )}
            </div>
          )}

          {/* Bridge to feed */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 86 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.22)", textAlign: "center", lineHeight: 1.75, marginBottom: 10 }}>
              Or scroll to find your next<br />bucket list course?
            </div>
            <div className="bounce-arrow" style={{ color: "rgba(77,168,98,0.45)", fontSize: 20, lineHeight: 1 }}>↓</div>
          </div>
        </div>

        {/* ── Feed clips ── */}
        {!loading && feedItems.map((item, i) => (
          <div key={item.type === "clip" ? item.clip.id : item.seriesId} className="feed-item">
            {item.type === "series" ? (
              <SeriesCard item={item} isActive={i === activeIndex} muted={muted} onUnmute={() => setMuted(false)} onTapUser={() => router.push(`/profile/${item.userId}`)} onTapCourse={() => router.push(`/courses/${item.courseId}`)} onTapHole={() => router.push(`/courses/${item.courseId}/holes`)} onComment={() => setCommentUploadId(item.shots[0]?.id || null)} />
            ) : (
              <VideoCard clip={item.clip} isActive={i === activeIndex} muted={muted} onUnmute={() => setMuted(false)} onTapUser={() => router.push(`/profile/${item.clip.userId}`)} onTapCourse={() => router.push(`/courses/${item.clip.courseId}`)} onTapHole={() => router.push(`/courses/${item.clip.courseId}/holes`)} onComment={() => setCommentUploadId(item.clip.id)} />
            )}
          </div>
        ))}

        {!loading && feedItems.length === 0 && (
          <div className="feed-item" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", textAlign: "center", fontFamily: "'Outfit', sans-serif" }}>No clips yet — be the first to upload</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#4da862", border: "none", borderRadius: 10, padding: "12px 28px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>Upload the first clip</button>
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
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(77,168,98,0.2)", border: "1px solid rgba(77,168,98,0.25)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862" }}>@{c.username} </span>
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
            <button onClick={dismissOnboarding} style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", marginTop: 8, boxShadow: "0 2px 16px rgba(45,122,66,0.4)" }}>
              Start Scouting
            </button>
          </div>
        </div>
      )}

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "linear-gradient(to top, rgba(7,16,10,0.97) 0%, rgba(7,16,10,0.5) 100%)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <button onClick={() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" })} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span style={{ fontSize: "9px", color: "#4da862", fontFamily: "'Outfit', sans-serif" }}>Home</span>
        </button>
        <button onClick={() => router.push("/search")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Search</span>
        </button>
        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>
        <button onClick={() => router.push("/lists")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Lists</span>
        </button>
        <button onClick={() => router.push(user ? "/profile" : "/login")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
        </button>
      </nav>
    </main>
  );
}

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
  seriesId: string | null;
  seriesOrder: number | null;
  yardageOverlay: string | null;
};

type FeedItem =
  | { type: "clip"; clip: FeedClip }
  | { type: "series"; shots: FeedClip[]; seriesId: string; courseName: string; courseId: string; holeId: string; holeNumber?: number; username: string; avatarUrl: string | null; userId: string };

type CourseResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  uploadCount: number;
};

function TourItLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" fill="#0d2318" stroke="rgba(77,168,98,0.35)" strokeWidth="1.5" />
      <line x1="40" y1="18" x2="40" y2="54" stroke="#4da862" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 18 Q54 22 52 30 Q54 36 40 34 Z" fill="#4da862" />
      <circle cx="40" cy="57" r="5" fill="#fff" />
      <circle cx="38.5" cy="55.5" r="0.9" fill="rgba(0,0,0,0.12)" />
      <circle cx="41.5" cy="55.5" r="0.9" fill="rgba(0,0,0,0.12)" />
      <circle cx="40" cy="57.8" r="0.9" fill="rgba(0,0,0,0.12)" />
      <ellipse cx="40" cy="54" rx="6" ry="1.5" fill="#0a1a10" />
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

// Shared right panel buttons
function RightPanel({ courseId, courseName, onTapCourse, onTapHole, liked, onLike, likeCount }: {
  courseId: string; courseName: string;
  onTapCourse: () => void; onTapHole: () => void;
  liked: boolean; onLike: () => void; likeCount: number;
}) {
  return (
    <div style={{ position: "absolute", right: 12, bottom: 120, display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", zIndex: 5 }}>
      <button onClick={onLike} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: `1.5px solid ${liked ? "rgba(77,168,98,0.7)" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <span style={{ fontSize: "10px", color: liked ? "#4da862" : "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{likeCount}</span>
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

// Shared bottom user info — avatar, @username, course name, hole number
function UserInfo({ avatarUrl, username, courseName, holeNumber, onTapUser }: {
  avatarUrl: string | null; username: string; courseName: string; holeNumber?: number; onTapUser: () => void;
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
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 4 }}>
        {courseName}
      </div>
      {holeNumber && (
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, color: "#4da862" }}>
          Hole {holeNumber}
        </div>
      )}
    </div>
  );
}

// Series card — horizontal swipe between shots
function SeriesCard({
  item, isActive, muted, onUnmute, onSingleTap, onTapCourse, onTapHole, onTapUser,
}: {
  item: Extract<FeedItem, { type: "series" }>;
  isActive: boolean; muted: boolean;
  onUnmute: () => void; onSingleTap: () => void;
  onTapCourse: () => void; onTapHole: () => void; onTapUser: () => void;
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
    else { onUnmute(); onSingleTap(); }
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

      {/* Banner */}
      <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
        <div style={{ background: "rgba(180,145,60,0.85)", backdropFilter: "blur(8px)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontSize: 11, fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#fff" }}>🏌️ Play a Hole With Me</span>
        </div>
      </div>

      {/* Shot dots */}
      <div style={{ position: "absolute", top: 100, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 5, pointerEvents: "none" }}>
        {item.shots.map((_, i) => (
          <div key={i} style={{ height: 3, borderRadius: 99, background: i === shotIndex ? "#c8a96e" : "rgba(255,255,255,0.3)", width: i === shotIndex ? 22 : 7, transition: "all 0.3s" }} />
        ))}
      </div>

      {/* Yardage overlay */}
      {activeShot?.yardageOverlay && (
        <div style={{ position: "absolute", top: "42%", left: 16, zIndex: 5, pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", backdropFilter: "blur(8px)" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff" }}>{activeShot.yardageOverlay}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: 5 }}>yds</span>
          </div>
        </div>
      )}

      {/* Arrows */}
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

      <RightPanel courseId={item.courseId} courseName={item.courseName} onTapCourse={onTapCourse} onTapHole={onTapHole} liked={false} onLike={() => {}} likeCount={0} />

      <UserInfo avatarUrl={item.avatarUrl} username={item.username} courseName={item.courseName} holeNumber={item.holeNumber} onTapUser={onTapUser} />

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

// Single clip card
function VideoCard({
  clip, isActive, muted, onUnmute, onSingleTap, onTapCourse, onTapHole, onTapUser,
}: {
  clip: FeedClip; isActive: boolean; muted: boolean;
  onUnmute: () => void; onSingleTap: () => void;
  onTapCourse: () => void; onTapHole: () => void; onTapUser: () => void;
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
    else { onUnmute(); onSingleTap(); }
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

      <RightPanel courseId={clip.courseId} courseName={clip.courseName} onTapCourse={onTapCourse} onTapHole={onTapHole} liked={liked} onLike={toggleLike} likeCount={likeCount} />

      <UserInfo avatarUrl={clip.avatarUrl} username={clip.username} courseName={clip.courseName} holeNumber={clip.holeNumber} onTapUser={onTapUser} />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [allCourses, setAllCourses] = useState<CourseResult[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [holeCount, setHoleCount] = useState<number | null>(null);
  const [clipCount, setClipCount] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [immersive, setImmersive] = useState(false);
  const [muted, setMuted] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchResults = searchQuery.trim().length > 0
    ? allCourses.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.state?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase.from("User").select("username, avatarUrl, displayName").eq("id", data.user.id).single();
        setUserProfile(profile);
      }
    });

    supabase.from("Course").select("id, name, city, state, uploadCount").order("uploadCount", { ascending: false }).limit(8).then(({ data }) => { if (data) setTrendingCourses(data); });
    supabase.from("Course").select("id, name, city, state, uploadCount").order("name").then(({ data }) => { if (data) setAllCourses(data); });
    supabase.from("User").select("*", { count: "exact", head: true }).then(({ count }) => { if (count !== null) setUserCount(count); });
    supabase.from("Course").select("*", { count: "exact", head: true }).then(({ count }) => { if (count !== null) setCourseCount(count); });
    supabase.from("Hole").select("*", { count: "exact", head: true }).then(({ count }) => { if (count !== null) setHoleCount(count); });
    supabase.from("Upload").select("*", { count: "exact", head: true }).then(({ count }) => { if (count !== null) setClipCount(count); });

    async function loadFeed() {
      const { data: uploads } = await supabase
        .from("Upload")
        .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, shotType, likeCount, userId, seriesId, seriesOrder, yardageOverlay")
        .order("createdAt", { ascending: false })
        .limit(40);

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
      setLoading(false);
    }

    loadFeed();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const feed = feedRef.current;
      if (!feed) return;
      const index = Math.round(feed.scrollTop / window.innerHeight);
      setActiveIndex(index);
    }, 50);
  }, []);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); };

  const formatStat = (n: number | null, fallback: string) => {
    if (n === null) return fallback;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
    return `${n}+`;
  };

  return (
    <main style={{ height: "100svh", background: "#07100a", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; overflow: hidden; }
        .feed { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed::-webkit-scrollbar { display: none; }
        .feed-item { scroll-snap-align: start; scroll-snap-stop: always; }
        .chip { display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.14); border-radius: 99px; padding: 5px 11px; cursor: pointer; white-space: nowrap; flex-shrink: 0; backdrop-filter: blur(10px); transition: border-color 0.15s; }
        .chip:hover { border-color: rgba(77,168,98,0.5); }
        .chip span { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.78); font-family: 'Outfit', sans-serif; }
        .chip small { font-size: 8px; color: rgba(255,255,255,0.3); font-family: 'Outfit', sans-serif; }
        .chips-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .chips-row::-webkit-scrollbar { display: none; }
        .search-input-field { background: transparent; border: none; outline: none; font-family: 'Outfit', sans-serif; font-size: 13px; color: #fff; flex: 1; min-width: 0; }
        .search-input-field::placeholder { color: rgba(255,255,255,0.38); }
        .search-result-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.1s; }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:active { background: rgba(77,168,98,0.1); }
        .search-backdrop { position: fixed; inset: 0; z-index: 18; }
      `}</style>

      <div ref={feedRef} className="feed" onScroll={handleScroll}>
        {loading ? (
          <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontFamily: "'Outfit', sans-serif" }}>Loading clips...</div>
        ) : feedItems.length === 0 ? (
          <div style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "20px", fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>No clips yet — be the first to upload</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#4da862", border: "none", borderRadius: "10px", padding: "12px 28px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Upload the first clip</button>
          </div>
        ) : (
          feedItems.map((item, i) => (
            <div key={item.type === "clip" ? item.clip.id : item.seriesId} className="feed-item">
              {item.type === "series" ? (
                <SeriesCard item={item} isActive={i === activeIndex} muted={muted} onUnmute={() => setMuted(false)} onSingleTap={() => setImmersive(true)} onTapUser={() => router.push(`/profile/${item.userId}`)} onTapCourse={() => { setImmersive(false); router.push(`/courses/${item.courseId}`); }} onTapHole={() => router.push(`/courses/${item.courseId}/holes`)} />
              ) : (
                <VideoCard clip={item.clip} isActive={i === activeIndex} muted={muted} onUnmute={() => setMuted(false)} onSingleTap={() => setImmersive(true)} onTapUser={() => router.push(`/profile/${item.clip.userId}`)} onTapCourse={() => { setImmersive(false); router.push(`/courses/${item.clip.courseId}`); }} onTapHole={() => router.push(`/courses/${item.clip.courseId}/holes`)} />
              )}
            </div>
          ))
        )}
      </div>

      {searchOpen && <div className="search-backdrop" onClick={closeSearch} />}

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20, background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 60%, transparent 100%)", padding: "10px 16px 20px", transition: "opacity 0.25s ease, transform 0.25s ease", opacity: immersive ? 0 : 1, pointerEvents: immersive ? "none" : "auto", transform: immersive ? "translateY(-6px)" : "translateY(0)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TourItLogo size={26} />
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>Tour It</div>
              <div style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.65)", marginTop: "1px" }}>Scout before you play</div>
            </div>
          </div>
          <button onClick={() => router.push(user ? "/profile" : "/login")} style={{ width: 34, height: 34, borderRadius: "50%", background: userProfile?.avatarUrl ? "transparent" : "rgba(77,168,98,0.18)", border: "1.5px solid rgba(77,168,98,0.45)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", padding: 0, flexShrink: 0 }}>
            {userProfile?.avatarUrl ? <img src={userProfile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </button>
        </div>

        {!searchOpen && (
          <>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: "5px" }}>
                Know the course<br />
                <span style={{ fontStyle: "italic", fontWeight: 400, color: "rgba(255,255,255,0.38)" }}>before you </span>
                <span style={{ color: "#4da862" }}>tee it up.</span>
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                <strong style={{ color: "rgba(255,255,255,0.72)", fontWeight: 500 }}>Preview any course, one hole at a time.</strong> Real videos and tips from golfers who&apos;ve already played it.
              </div>
            </div>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", overflow: "hidden", marginBottom: "10px", backdropFilter: "blur(12px)" }}>
              {[
                { value: courseCount !== null ? formatStat(courseCount, "—") : "—", label: "Courses" },
                { value: holeCount !== null ? formatStat(holeCount, "—") : "—", label: "Holes" },
                { value: clipCount !== null ? formatStat(clipCount, "—") : "—", label: "Clips" },
                { value: userCount !== null ? formatStat(userCount, "—") : "—", label: "Golfers" },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, padding: "7px 4px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "7px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "1px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ position: "relative", marginBottom: searchOpen ? 0 : "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "rgba(0,0,0,0.6)", border: `1.5px solid ${searchOpen ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.18)"}`, borderRadius: searchOpen && searchResults.length > 0 ? "12px 12px 0 0" : "12px", padding: "10px 14px", backdropFilter: "blur(16px)", transition: "border-color 0.15s" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.45, flexShrink: 0 }}><circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5" /><path d="M11 11L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
            {!searchOpen && <button onClick={() => setSearchOpen(true)} style={{ flex: 1, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.38)" }}>Find a course or hole — name, city, state...</span></button>}
            {searchOpen && <input className="search-input-field" placeholder="Course name, city, or state..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoComplete="off" autoFocus />}
            {searchOpen && <button onClick={closeSearch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,22,13,0.97)", border: "1.5px solid rgba(77,168,98,0.3)", borderTop: "none", borderRadius: "0 0 12px 12px", backdropFilter: "blur(20px)", zIndex: 30, overflow: "hidden" }}>
              {searchResults.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="search-result-item" onClick={() => { closeSearch(); router.push(`/courses/${course.id}`); }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", flexShrink: 0 }}>{abbr}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{course.city}, {course.state}{course.uploadCount > 0 && <span style={{ color: "#4da862", marginLeft: 6 }}>{course.uploadCount} clips</span>}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                );
              })}
            </div>
          )}
          {searchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,22,13,0.97)", border: "1.5px solid rgba(255,255,255,0.1)", borderTop: "none", borderRadius: "0 0 12px 12px", backdropFilter: "blur(20px)", zIndex: 30, padding: "14px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No courses found for &ldquo;{searchQuery}&rdquo;</div>
            </div>
          )}
        </div>

        {!searchOpen && (
          <div className="chips-row">
            {[
              { name: "Scottsdale", count: 34 }, { name: "Pinehurst", count: 28 }, { name: "Bandon", count: 19 },
              { name: "Pebble Beach", count: 22 }, { name: "Myrtle Beach", count: 41 }, { name: "Kiawah", count: 11 }, { name: "Sea Island", count: 9 },
            ].map(d => (
              <button key={d.name} className="chip" onClick={() => router.push(`/search?q=${encodeURIComponent(d.name)}`)}><span>{d.name}</span><small>{d.count}</small></button>
            ))}
            {trendingCourses.filter(c => c.uploadCount > 0).slice(0, 3).map(c => (
              <button key={c.id} className="chip" onClick={() => router.push(`/courses/${c.id}`)}><span>{c.name.split(" ").slice(0, 2).join(" ")}</span><small>{c.uploadCount} clips</small></button>
            ))}
          </div>
        )}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "linear-gradient(to top, rgba(7,16,10,0.97) 0%, rgba(7,16,10,0.5) 100%)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Home */}
        <button onClick={() => setImmersive(false)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span style={{ fontSize: "9px", color: "#4da862", fontFamily: "'Outfit', sans-serif" }}>Home</span>
        </button>
        {/* Search */}
        <button onClick={() => router.push("/search")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Search</span>
        </button>
        {/* Upload FAB */}
        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>
        {/* Notifications placeholder */}
        <button disabled style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", opacity: 0.4 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "'Outfit', sans-serif" }}>Alerts</span>
        </button>
        {/* Profile */}
        <button onClick={() => router.push(user ? "/profile" : "/login")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {userProfile?.avatarUrl
              ? <img src={userProfile.avatarUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
        </button>
      </nav>
    </main>
  );
}

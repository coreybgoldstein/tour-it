"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

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
  strategyNote: string | null;
  clubUsed: string | null;
  shotType: string | null;
  username: string;
  avatarUrl: string | null;
  userId: string;
  likeCount: number;
};

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

function VideoCard({
  clip,
  onTapCourse,
  onTapHole,
  onSingleTap,
  onTapUser,
  isActive,
}: {
  clip: FeedClip;
  onTapCourse: () => void;
  onTapHole: () => void;
  onSingleTap: () => void;
  onTapUser: () => void;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.likeCount || 0);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onTapCourse();
    } else {
      onSingleTap();
    }
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

      {clip.mediaType === "VIDEO" && (
        <button onClick={() => setMuted(m => !m)} style={{ position: "absolute", bottom: 185, left: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}>
          {muted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          )}
        </button>
      )}

      <div style={{ position: "absolute", right: 12, bottom: 120, display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", zIndex: 5 }}>
        <button onClick={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
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

        <button style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </div>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Share</span>
        </button>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 16px 90px", zIndex: 5 }}>
        <button
          onClick={onTapUser}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 5 }}
        >
          <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(77,168,98,0.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {clip.avatarUrl
              ? <img src={clip.avatarUrl} alt={clip.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>@{clip.username}</span>
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "5px", lineHeight: 1.2 }}>{clip.courseName}</div>
        {clip.strategyNote && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.72)", marginBottom: "9px", lineHeight: 1.5 }}>{clip.strategyNote}</div>
        )}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {clip.shotType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: "99px", padding: "2px 9px" }}>{clip.shotType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>}
          {clip.clubUsed && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "99px", padding: "2px 9px" }}>{clip.clubUsed}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [allCourses, setAllCourses] = useState<CourseResult[]>([]);
  const [clips, setClips] = useState<FeedClip[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [immersive, setImmersive] = useState(false);
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
        const { data: profile } = await supabase
          .from("User").select("username, avatarUrl, displayName").eq("id", data.user.id).single();
        setUserProfile(profile);
      }
    });

    supabase.from("Course").select("id, name, city, state, uploadCount").order("uploadCount", { ascending: false }).limit(8)
      .then(({ data }) => { if (data) setTrendingCourses(data); });

    supabase.from("Course").select("id, name, city, state, uploadCount").order("name")
      .then(({ data }) => { if (data) setAllCourses(data); });

    supabase.from("User").select("*", { count: "exact", head: true })
      .then(({ count }) => { if (count) setUserCount(count); });

    async function loadClips() {
      const { data: uploads } = await supabase
        .from("Upload").select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, shotType, likeCount, userId")
        .order("createdAt", { ascending: false }).limit(20);

      if (!uploads || uploads.length === 0) { setLoading(false); return; }

      const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
      const userIds = [...new Set(uploads.map((u: any) => u.userId))];

      const [{ data: courses }, { data: users }] = await Promise.all([
        supabase.from("Course").select("id, name").in("id", courseIds),
        supabase.from("User").select("id, username, avatarUrl").in("id", userIds),
      ]);

      const enriched: FeedClip[] = uploads.map((u: any) => ({
        ...u,
        courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
        username: users?.find((usr: any) => usr.id === u.userId)?.username || "golfer",
avatarUrl: users?.find((usr: any) => usr.id === u.userId)?.avatarUrl || null,
      }));

      const sorted = [...enriched].sort((a, b) => {
        if (a.mediaType === "VIDEO" && b.mediaType !== "VIDEO") return -1;
        if (a.mediaType !== "VIDEO" && b.mediaType === "VIDEO") return 1;
        return 0;
      });
      setClips(sorted);
      setLoading(false);
    }

    loadClips();
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

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

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

      {/* Video feed */}
      <div ref={feedRef} className="feed" onScroll={handleScroll}>
        {loading ? (
          <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontFamily: "'Outfit', sans-serif" }}>Loading clips...</div>
        ) : clips.length === 0 ? (
          <div style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "20px", fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>No clips yet — be the first to upload</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#4da862", border: "none", borderRadius: "10px", padding: "12px 28px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Upload the first clip</button>
          </div>
        ) : (
          clips.map((clip, i) => (
            <div key={clip.id} className="feed-item">
              <VideoCard clip={clip} isActive={i === activeIndex} onSingleTap={() => setImmersive(v => !v)} onTapUser={() => router.push(`/profile/${clip.userId}`)} onTapCourse={() => { setImmersive(false); router.push(`/courses/${clip.courseId}`); }} onTapHole={() => router.push(`/courses/${clip.courseId}/holes`)} />
            </div>
          ))
        )}
      </div>

      {/* Backdrop to close search */}
      {searchOpen && <div className="search-backdrop" onClick={closeSearch} />}

      {/* Top overlay */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20, transition: "opacity 0.25s ease, transform 0.25s ease", opacity: immersive ? 0 : 1, pointerEvents: immersive ? "none" : "auto", transform: immersive ? "translateY(-6px)" : "translateY(0)", background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 60%, transparent 100%)", padding: "10px 16px 20px" }}>

        {/* Logo + avatar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TourItLogo size={26} />
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>Tour It</div>
              <div style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.65)", marginTop: "1px" }}>Scout before you play</div>
            </div>
          </div>
          <button onClick={() => router.push(user ? "/profile" : "/login")} style={{ width: 34, height: 34, borderRadius: "50%", background: userProfile?.avatarUrl ? "transparent" : "rgba(77,168,98,0.18)", border: "1.5px solid rgba(77,168,98,0.45)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", padding: 0, flexShrink: 0 }}>
            {userProfile?.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
          </button>
        </div>

        {/* Hero — hidden when search open */}
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
                { value: "4,200+", label: "Courses" },
                { value: "38K+", label: "Holes" },
                { value: "112K+", label: "Clips" },
                { value: userCount ? formatStat(userCount, "—") : "—", label: "Golfers" },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, padding: "7px 4px", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", fontWeight: 700, color: "#fff" }}>{s.value}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "7px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "1px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Search — shows placeholder button when closed, real input when open */}
        <div style={{ position: "relative", marginBottom: searchOpen ? 0 : "8px" }}>

          {/* Always-visible search bar container */}
          <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "rgba(0,0,0,0.6)", border: `1.5px solid ${searchOpen ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.18)"}`, borderRadius: searchOpen && searchResults.length > 0 ? "12px 12px 0 0" : "12px", padding: "10px 14px", backdropFilter: "blur(16px)", transition: "border-color 0.15s" }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.45, flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            {/* When closed — tappable label that opens search */}
            {!searchOpen && (
              <button
                onClick={() => setSearchOpen(true)}
                style={{ flex: 1, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
              >
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.38)" }}>
                  Find a course or hole — name, city, state...
                </span>
              </button>
            )}

            {/* When open — real input, autoFocus triggers iOS keyboard */}
            {searchOpen && (
              <input
                className="search-input-field"
                placeholder="Course name, city, or state..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            )}

            {searchOpen && (
              <button onClick={closeSearch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {searchOpen && searchResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,22,13,0.97)", border: "1.5px solid rgba(77,168,98,0.3)", borderTop: "none", borderRadius: "0 0 12px 12px", backdropFilter: "blur(20px)", zIndex: 30, overflow: "hidden" }}>
              {searchResults.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="search-result-item" onClick={() => { closeSearch(); router.push(`/courses/${course.id}`); }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", flexShrink: 0 }}>
                      {abbr}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                        {course.city}, {course.state}
                        {course.uploadCount > 0 && <span style={{ color: "#4da862", marginLeft: 6 }}>{course.uploadCount} clips</span>}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {searchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,22,13,0.97)", border: "1.5px solid rgba(255,255,255,0.1)", borderTop: "none", borderRadius: "0 0 12px 12px", backdropFilter: "blur(20px)", zIndex: 30, padding: "14px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No courses found for &ldquo;{searchQuery}&rdquo;</div>
            </div>
          )}
        </div>

        {/* Chips — hidden when search open */}
        {!searchOpen && (
          <div className="chips-row">
            {[
              { name: "Scottsdale", count: 34 },
              { name: "Pinehurst", count: 28 },
              { name: "Bandon", count: 19 },
              { name: "Pebble Beach", count: 22 },
              { name: "Myrtle Beach", count: 41 },
              { name: "Kiawah", count: 11 },
              { name: "Sea Island", count: 9 },
            ].map(d => (
              <button key={d.name} className="chip" onClick={() => router.push(`/search?q=${encodeURIComponent(d.name)}`)}>
                <span>{d.name}</span>
                <small>{d.count}</small>
              </button>
            ))}
            {trendingCourses.filter(c => c.uploadCount > 0).slice(0, 3).map(c => (
              <button key={c.id} className="chip" onClick={() => router.push(`/courses/${c.id}`)}>
                <span>{c.name.split(" ").slice(0, 2).join(" ")}</span>
                <small>{c.uploadCount} clips</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

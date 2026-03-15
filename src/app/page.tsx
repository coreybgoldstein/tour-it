"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  likeCount: number;
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
  isActive,
  immersive,
  onToggleImmersive,
}: {
  clip: FeedClip;
  onTapCourse: () => void;
  onTapHole: () => void;
  isActive: boolean;
  immersive: boolean;
  onToggleImmersive: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(clip.likeCount || 0);

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

  const formatShotType = (s: string | null) => {
    if (!s) return null;
    return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#07100a", overflow: "hidden" }}>

      {clip.mediaType === "VIDEO" ? (
        <video
          ref={videoRef}
          src={clip.mediaUrl}
          loop
          muted={muted}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
          onClick={onToggleImmersive}
        />
      ) : (
        <img
          src={clip.mediaUrl}
          alt="clip"
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
          onClick={onToggleImmersive}
        />
      )}

      {/* Bottom gradient — always */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.92) 100%)", pointerEvents: "none" }} />

      {/* Mute — always visible */}
      {clip.mediaType === "VIDEO" && (
        <button
          onClick={() => setMuted(m => !m)}
          style={{ position: "absolute", bottom: 185, left: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 }}
        >
          {muted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          )}
        </button>
      )}

      {/* Right actions — always visible, order: Like, Course, Hole, Share */}
      <div style={{ position: "absolute", right: 14, bottom: 110, display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", zIndex: 5 }}>
        <button
          onClick={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: `1.5px solid ${liked ? "rgba(77,168,98,0.7)" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span style={{ fontSize: "10px", color: liked ? "#4da862" : "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{likeCount}</span>
        </button>

        <button onClick={onTapCourse} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <CourseIcon />
          </div>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Course</span>
        </button>

        <button onClick={onTapHole} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <HoleIcon />
          </div>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Hole</span>
        </button>

        <button style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", fontFamily: "'Outfit', sans-serif" }}>Share</span>
        </button>
      </div>

      {/* Bottom clip info — always visible */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 16px 90px", zIndex: 5, pointerEvents: "none" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "3px" }}>
          @{clip.username}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "5px", lineHeight: 1.2 }}>
          {clip.courseName}
        </div>
        {clip.strategyNote && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.72)", marginBottom: "9px", lineHeight: 1.5 }}>
            {clip.strategyNote}
          </div>
        )}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {clip.shotType && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: "99px", padding: "2px 9px" }}>
              {formatShotType(clip.shotType)}
            </span>
          )}
          {clip.clubUsed && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "99px", padding: "2px 9px" }}>
              {clip.clubUsed}
            </span>
          )}
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
  const [clips, setClips] = useState<FeedClip[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase
          .from("User")
          .select("username, avatarUrl, displayName")
          .eq("id", data.user.id)
          .single();
        setUserProfile(profile);
      }
    });

    supabase
      .from("Course")
      .select("id, name, city, state, uploadCount")
      .order("uploadCount", { ascending: false })
      .limit(8)
      .then(({ data }) => { if (data) setTrendingCourses(data); });

    supabase
      .from("User")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => { if (count) setUserCount(count); });

    async function loadClips() {
      const { data: uploads } = await supabase
        .from("Upload")
        .select("id, mediaUrl, mediaType, courseId, holeId, strategyNote, clubUsed, shotType, likeCount, userId")
        .order("createdAt", { ascending: false })
        .limit(20);

      if (!uploads || uploads.length === 0) { setLoading(false); return; }

      const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
      const userIds = [...new Set(uploads.map((u: any) => u.userId))];

      const [{ data: courses }, { data: users }] = await Promise.all([
        supabase.from("Course").select("id, name").in("id", courseIds),
        supabase.from("User").select("id, username").in("id", userIds),
      ]);

      const enriched: FeedClip[] = uploads.map((u: any) => ({
        ...u,
        courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
        username: users?.find((usr: any) => usr.id === u.userId)?.username || "golfer",
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

  // Scroll handler — does NOT exit immersive
  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const feed = feedRef.current;
      if (!feed) return;
      const index = Math.round(feed.scrollTop / window.innerHeight);
      setActiveIndex(index);
    }, 50);
  }, []);

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
        .top-overlay { transition: opacity 0.25s ease, transform 0.25s ease; }
        .top-overlay.hidden { opacity: 0; pointer-events: none; transform: translateY(-6px); }
      `}</style>

      {/* Video feed */}
      <div ref={feedRef} className="feed" onScroll={handleScroll}>
        {loading ? (
          <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px", fontFamily: "'Outfit', sans-serif" }}>
            Loading clips...
          </div>
        ) : clips.length === 0 ? (
          <div style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "20px", fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>No clips yet — be the first to upload</div>
            <button onClick={() => router.push("/upload")} style={{ background: "#4da862", border: "none", borderRadius: "10px", padding: "12px 28px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Upload the first clip
            </button>
          </div>
        ) : (
          clips.map((clip, i) => (
            <div key={clip.id} className="feed-item">
              <VideoCard
                clip={clip}
                isActive={i === activeIndex}
                immersive={immersive}
                onToggleImmersive={() => setImmersive(v => !v)}
                onTapCourse={() => router.push(`/courses/${clip.courseId}`)}
                onTapHole={() => router.push(`/courses/${clip.courseId}/holes`)}
              />
            </div>
          ))
        )}
      </div>

      {/* Top overlay — hides in immersive */}
      <div className={`top-overlay${immersive ? " hidden" : ""}`} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20, background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 60%, transparent 100%)", padding: "10px 16px 20px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TourItLogo size={26} />
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>Tour It</div>
              <div style={{ fontSize: "7px", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.65)", marginTop: "1px" }}>Scout before you play</div>
            </div>
          </div>

        </div>

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

        <button
          onClick={() => router.push("/search")}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", background: "rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.18)", borderRadius: "12px", padding: "10px 14px", backdropFilter: "blur(16px)", marginBottom: "8px", cursor: "pointer", textAlign: "left" }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.45, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.38)" }}>
            Find a course or hole — name, city, state...
          </span>
        </button>

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
      </div>

      {/* Bottom nav — always visible, Home / Search / Upload / Saved only */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "linear-gradient(to top, rgba(7,16,10,0.97) 0%, rgba(7,16,10,0.5) 100%)" }}>
        {[
          { label: "Home", path: "/", active: true, icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "Search", path: "/search", active: false, icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z" },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={item.active ? "#4da862" : "rgba(255,255,255,0.35)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span style={{ fontSize: "9px", color: item.active ? "#4da862" : "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
          </button>
        ))}

        {/* Upload FAB */}
        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>

        {/* Saved */}
        <button onClick={() => router.push("/saved")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Saved</span>
        </button>

        {/* Profile — tap avatar at top instead, but keep as 4th item for balance */}
        <button onClick={() => router.push(user ? "/profile" : "/login")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
          {userProfile?.avatarUrl ? (
            <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(77,168,98,0.4)" }}>
              <img src={userProfile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )}
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Outfit', sans-serif" }}>Profile</span>
        </button>
      </nav>
    </main>
  );
}

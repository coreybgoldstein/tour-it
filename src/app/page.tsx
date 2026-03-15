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
  isFromOtherCourse?: boolean;
};

function TourItLogo({ size = 28 }: { size?: number }) {
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

function VideoCard({ clip, onTap, isActive }: { clip: FeedClip; onTap: () => void; isActive: boolean }) {
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
    <div style={{ position: "relative", width: "100%", height: "100svh", background: "#07100a", overflow: "hidden", flexShrink: 0 }}>
      {clip.mediaType === "VIDEO" ? (
        <video
          ref={videoRef}
          src={clip.mediaUrl}
          loop
          muted={muted}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onClick={onTap}
        />
      ) : (
        <img
          src={clip.mediaUrl}
          alt="clip"
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
          onClick={onTap}
        />
      )}

      {/* Gradients */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none" }} />

      {/* Other course banner */}
      {clip.isFromOtherCourse && (
        <div style={{ position: "absolute", top: 80, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(180,145,60,0.85)", borderRadius: "99px", padding: "5px 14px", fontSize: "11px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, color: "#fff" }}>
            From {clip.courseName}
          </div>
        </div>
      )}

      {/* Mute */}
      {clip.mediaType === "VIDEO" && (
        <button
          onClick={() => setMuted(m => !m)}
          style={{ position: "absolute", top: 80, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          )}
        </button>
      )}

      {/* Right actions */}
      <div style={{ position: "absolute", right: 16, bottom: 120, display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
        <button
          onClick={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: `1px solid ${liked ? "rgba(77,168,98,0.6)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "#4da862" : "none"} stroke={liked ? "#4da862" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'Outfit', sans-serif" }}>{likeCount}</span>
        </button>

        <button
          onClick={onTap}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'Outfit', sans-serif" }}>Hole</span>
        </button>
      </div>

      {/* Bottom info */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 60, padding: "0 16px 80px", pointerEvents: "none" }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.55)", marginBottom: "4px" }}>
          @{clip.username}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "6px", lineHeight: 1.2 }}>
          {clip.courseName}
        </div>
        {clip.strategyNote && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.75)", marginBottom: "10px", lineHeight: 1.5 }}>
            {clip.strategyNote}
          </div>
        )}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {clip.shotType && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: "99px", padding: "3px 9px" }}>
              {formatShotType(clip.shotType)}
            </span>
          )}
          {clip.clubUsed && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "99px", padding: "3px 9px" }}>
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

      setClips(enriched);
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

  return (
    <main style={{ height: "100svh", background: "#07100a", overflow: "hidden", position: "relative", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; overflow: hidden; }
        .feed { height: 100svh; overflow-y: scroll; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .feed::-webkit-scrollbar { display: none; }
        .feed-item { scroll-snap-align: start; scroll-snap-stop: always; }
        .trend-chip { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 99px; padding: 6px 12px; cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0; }
        .trend-chip:hover { background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.4); }
        .trend-chip span { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.75); }
        .trend-chip small { font-size: 10px; color: rgba(255,255,255,0.3); }
        .trends-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .trends-row::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Pinned top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "10px 16px 10px", background: "linear-gradient(to bottom, rgba(7,16,10,0.95) 0%, rgba(7,16,10,0.7) 75%, transparent 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TourItLogo size={28} />
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>Tour It</div>
              <div style={{ fontSize: "8px", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.55)", marginTop: "1px" }}>Scout before you play</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => router.push("/search")}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
            <button
              onClick={() => router.push(user ? "/profile" : "/login")}
              style={{ width: 36, height: 36, borderRadius: "50%", background: userProfile?.avatarUrl ? "transparent" : "rgba(77,168,98,0.2)", border: "2px solid rgba(77,168,98,0.45)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", padding: 0 }}
            >
              {userProfile?.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#4da862" }}>
                  {user ? (userProfile?.displayName?.[0] || user.email?.[0] || "?").toUpperCase() : "?"}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="trends-row">
          {trendingCourses.map(c => (
            <button key={c.id} className="trend-chip" onClick={() => router.push(`/courses/${c.id}`)}>
              <span>{c.name.split(" ").slice(0, 2).join(" ")}</span>
              <small>{c.uploadCount || 0} clips</small>
            </button>
          ))}
        </div>
      </div>

      {/* Video feed */}
      <div ref={feedRef} className="feed" onScroll={handleScroll}>
        {loading ? (
          <div style={{ height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
            Loading clips...
          </div>
        ) : clips.length === 0 ? (
          <div style={{ height: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "20px" }}>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>No clips yet — be the first to upload</div>
            <button
              onClick={() => router.push("/upload")}
              style={{ background: "#4da862", border: "none", borderRadius: "10px", padding: "12px 28px", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              Upload the first clip
            </button>
          </div>
        ) : (
          clips.map((clip, i) => (
            <div key={clip.id} className="feed-item">
              <VideoCard
                clip={clip}
                isActive={i === activeIndex}
                onTap={() => router.push(`/courses/${clip.courseId}/holes`)}
              />
            </div>
          ))
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px 18px", background: "linear-gradient(to top, rgba(7,16,10,0.95) 0%, rgba(7,16,10,0.6) 70%, transparent 100%)" }}>
        {[
          { label: "Home", path: "/", active: true, icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "Search", path: "/search", active: false, icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z" },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={item.active ? "#4da862" : "rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span style={{ fontSize: "9px", color: item.active ? "#4da862" : "rgba(255,255,255,0.35)", fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
          </button>
        ))}

        <button onClick={() => router.push("/upload")} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", marginTop: "-18px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.04em" }}>UPLOAD</span>
        </button>

        {[
          { label: "Saved", path: "/saved", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
          { label: "Profile", path: "/profile", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11A4 4 0 1 0 12 3a4 4 0 0 0 0 8z" },
        ].map(item => (
          <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "'Outfit', sans-serif" }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

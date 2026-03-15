"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const DESTINATIONS = [
  { name: "Scottsdale", courses: 34 },
  { name: "Pinehurst", courses: 28 },
  { name: "Bandon", courses: 19 },
  { name: "Myrtle Beach", courses: 41 },
  { name: "Pebble Beach", courses: 22 },
  { name: "Kohler", courses: 15 },
  { name: "Kiawah", courses: 11 },
  { name: "Sea Island", courses: 9 },
];

const STATS = [
  { value: "4,200+", label: "Courses scouted" },
  { value: "38K+", label: "Holes covered" },
  { value: "112K+", label: "Clips uploaded" },
];

type TrendingCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  uploadCount: number;
  holeCount: number;
};

type DiscoveryUpload = {
  id: string;
  mediaUrl: string;
  mediaType: string;
  courseId: string;
  strategyNote: string | null;
  clubUsed: string | null;
  shotType: string | null;
  createdAt: string;
  userId: string;
  courseName?: string;
  username?: string;
};

function TourItLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="#0d2318" stroke="rgba(77,168,98,0.35)" strokeWidth="1.5" />
      <path d="M12 54 Q40 46 68 54" stroke="rgba(77,168,98,0.18)" strokeWidth="1" fill="none" />
      <path d="M18 60 Q40 53 62 60" stroke="rgba(77,168,98,0.12)" strokeWidth="1" fill="none" />
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

export default function Home() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [discoveryUploads, setDiscoveryUploads] = useState<DiscoveryUpload[]>([]);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    // Trending courses — real from DB
    supabase
      .from("Course")
      .select("id, name, city, state, uploadCount, holeCount")
      .order("uploadCount", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) setTrendingCourses(data);
      });

    // Discovery uploads — real from DB
    supabase
      .from("Upload")
      .select("id, mediaUrl, mediaType, courseId, strategyNote, clubUsed, shotType, createdAt, userId")
      .order("createdAt", { ascending: false })
      .limit(6)
      .then(async ({ data: uploads }) => {
        if (!uploads || uploads.length === 0) return;
        const courseIds = [...new Set(uploads.map((u: any) => u.courseId))];
        const userIds = [...new Set(uploads.map((u: any) => u.userId))];
        const [{ data: courses }, { data: users }] = await Promise.all([
          supabase.from("Course").select("id, name").in("id", courseIds),
          supabase.from("User").select("id, username").in("id", userIds),
        ]);
        const enriched = uploads.map((u: any) => ({
          ...u,
          courseName: courses?.find((c: any) => c.id === u.courseId)?.name || "Unknown Course",
          username: users?.find((usr: any) => usr.id === u.userId)?.username || "golfer",
        }));
        setDiscoveryUploads(enriched);
      });
  }, []);

  const formatShotType = (s: string | null) => {
    if (!s) return null;
    return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .f-display { font-family: 'Playfair Display', serif; }
        .f-body { font-family: 'Outfit', sans-serif; }
        .bg-texture { position: fixed; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px); background-size: 28px 28px; }
        .bg-glow-top { position: fixed; top: -300px; left: 50%; transform: translateX(-50%); width: 900px; height: 600px; pointer-events: none; z-index: 0; background: radial-gradient(ellipse, rgba(56,140,76,0.13) 0%, transparent 68%); }
        .bg-glow-bottom { position: fixed; bottom: -200px; right: -100px; width: 500px; height: 400px; pointer-events: none; z-index: 0; background: radial-gradient(ellipse, rgba(180,140,60,0.06) 0%, transparent 70%); }
        .rel { position: relative; z-index: 1; }
        .nav { position: sticky; top: 0; z-index: 99; display: flex; align-items: center; justify-content: space-between; padding: 12px 22px; background: rgba(7,16,10,0.88); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(255,255,255,0.055); }
        .logo-wrap { display: flex; align-items: center; gap: 10px; font-family: 'Playfair Display', serif; font-size: 21px; font-weight: 900; letter-spacing: 0.01em; color: #fff; }
        .logo-tagline { font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(77,168,98,0.55); margin-top: -2px; }
        .nav-links { display: flex; align-items: center; gap: 6px; }
        .btn-ghost { background: none; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.42); padding: 7px 12px; border-radius: 8px; transition: color 0.15s, background 0.15s; }
        .btn-ghost:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.04); }
        .btn-cta { background: #2d7a42; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; color: #fff; padding: 8px 20px; border-radius: 99px; transition: background 0.15s, transform 0.1s; box-shadow: 0 2px 12px rgba(45,122,66,0.3); }
        .btn-cta:hover { background: #256936; transform: translateY(-1px); }
        .btn-cta:active { transform: translateY(0); }
        .page { max-width: 650px; margin: 0 auto; padding: 0 20px 110px; }
        .hero { padding: 48px 0 32px; }
        .hero-title { font-family: 'Playfair Display', serif; font-size: clamp(40px, 10vw, 58px); font-weight: 900; line-height: 1.04; letter-spacing: -0.015em; color: #fff; margin-bottom: 18px; }
        .hero-title .italic { font-style: italic; font-weight: 700; color: rgba(255,255,255,0.38); }
        .hero-title .green { color: #4da862; }
        .hero-sub { font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 300; line-height: 1.7; color: rgba(255,255,255,0.42); max-width: 420px; }
        .hero-sub strong { color: rgba(255,255,255,0.7); font-weight: 500; }
        .stats-bar { display: flex; margin: 30px 0 38px; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.02); }
        .stat-item { flex: 1; padding: 14px 12px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06); }
        .stat-item:last-child { border-right: none; }
        .stat-value { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 2px; }
        .stat-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 0.06em; color: rgba(255,255,255,0.28); text-transform: uppercase; }
        .search-outer { margin-bottom: 38px; }
        .search-box { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 15px 18px; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
        .search-box:focus-within { background: rgba(255,255,255,0.055); border-color: rgba(77,168,98,0.5); box-shadow: 0 0 0 4px rgba(77,168,98,0.08); }
        .search-input { background: none; border: none; outline: none; width: 100%; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 400; color: #fff; }
        .search-input::placeholder { color: rgba(255,255,255,0.22); }
        .search-hint { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.18); margin-top: 8px; padding-left: 4px; }
        .section { margin-bottom: 38px; }
        .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .section-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.28); }
        .section-link { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500; color: #4da862; background: none; border: none; cursor: pointer; transition: opacity 0.15s; }
        .section-link:hover { opacity: 0.65; }
        .dest-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
        .dest-pill { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 99px; padding: 8px 16px; cursor: pointer; transition: all 0.15s; font-family: 'Outfit', sans-serif; }
        .dest-pill:hover { background: rgba(77,168,98,0.09); border-color: rgba(77,168,98,0.35); }
        .dest-name { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.68); }
        .dest-count { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.05); border-radius: 99px; padding: 1px 7px; }
        .rule { height: 1px; margin: 4px 0 38px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent); }
        .course-card { width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-radius: 12px; margin-bottom: 4px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.055); transition: all 0.15s; }
        .course-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(77,168,98,0.28); transform: translateX(2px); }
        .c-left { display: flex; align-items: center; gap: 14px; }
        .c-num { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.08); width: 26px; text-align: center; flex-shrink: 0; }
        .c-name { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.88); margin-bottom: 3px; }
        .c-meta { display: flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.3); font-weight: 300; }
        .c-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .c-clips { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); border-radius: 99px; padding: 3px 10px; }
        .discovery-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.055); border-radius: 14px; overflow: hidden; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
        .discovery-card:hover { border-color: rgba(77,168,98,0.28); }
        .discovery-media { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #0d2318; }
        .discovery-body { padding: 14px 16px; }
        .discovery-course { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); margin-bottom: 3px; }
        .discovery-user { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.28); margin-bottom: 8px; }
        .discovery-note { font-family: 'Playfair Display', serif; font-size: 13px; font-style: italic; color: rgba(255,255,255,0.38); line-height: 1.6; margin-bottom: 10px; }
        .discovery-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .d-tag { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500; color: #4da862; background: rgba(77,168,98,0.1); border: 1px solid rgba(77,168,98,0.2); border-radius: 99px; padding: 2px 8px; }
        .d-tag-gray { color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        .empty-discovery { padding: 32px; text-align: center; color: rgba(255,255,255,0.2); font-family: 'Outfit', sans-serif; font-size: 13px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 14px; }
        .cta-box { border-radius: 18px; padding: 28px 24px; text-align: center; background: linear-gradient(145deg, rgba(45,122,66,0.14) 0%, rgba(45,122,66,0.04) 100%); border: 1px solid rgba(77,168,98,0.2); position: relative; overflow: hidden; }
        .cta-box::before { content: '19TH HOLE'; position: absolute; top: 12px; right: 16px; font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: rgba(77,168,98,0.25); }
        .cta-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 900; margin-bottom: 8px; color: #fff; }
        .cta-sub { font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.38); line-height: 1.6; margin-bottom: 20px; max-width: 340px; margin-left: auto; margin-right: auto; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; z-index: 99; display: flex; align-items: center; justify-content: space-around; padding: 10px 8px 18px; background: rgba(7,16,10,0.94); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.055); }
        .nav-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; padding: 4px 16px; }
        .nav-lbl { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 0.04em; }
        .nav-upload-btn { background: linear-gradient(135deg, #2d7a42, #1d5a30); border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 11px 22px; border-radius: 16px; margin-top: -22px; box-shadow: 0 4px 20px rgba(45,122,66,0.4); font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.85); letter-spacing: 0.06em; text-transform: uppercase; transition: transform 0.15s, box-shadow 0.15s; }
        .nav-upload-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(45,122,66,0.5); }
        .u-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-block; }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .a1 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0s both; }
        .a2 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.07s both; }
        .a3 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.13s both; }
        .a4 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.19s both; }
        .a5 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.25s both; }
        .a6 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.31s both; }
        .a7 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.37s both; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow-top" />
      <div className="bg-glow-bottom" />

      <div className="rel">

        {/* Nav */}
        <nav className="nav">
          <div className="logo-wrap">
            <TourItLogo size={34} />
            <div>
              <div>Tour It</div>
              <div className="logo-tagline">Scout before you play</div>
            </div>
          </div>
          <div className="nav-links">
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                  @{user.user_metadata?.username || user.email?.split("@")[0]}
                </span>
                <button className="btn-ghost" onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUser(null);
                }}>
                  Log out
                </button>
              </div>
            ) : (
              <>
                <button className="btn-ghost" onClick={() => router.push("/login")}>Log in</button>
                <button className="btn-cta" onClick={() => router.push("/signup")}>Join free</button>
              </>
            )}
          </div>
        </nav>

        <div className="page">

          {/* Hero */}
          <div className="hero a1">
            <h1 className="hero-title">
              Know the course<br />
              <span className="italic">before you </span>
              <span className="green">tee it up.</span>
            </h1>
            <p className="hero-sub">
              <strong>Preview any course, one hole at a time.</strong> Real videos and tips from golfers who&apos;ve already played it.
            </p>
          </div>

          {/* Stats */}
          <div className="stats-bar a2">
            {STATS.map(s => (
              <div key={s.label} className="stat-item">
                <div className="stat-value f-display">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="search-outer a3">
            <div className="search-box">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="search-input f-body"
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  if (e.target.value.trim()) {
                    router.push(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && query.trim()) {
                    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                  }
                }}
                placeholder="Find a course — name, city, or state..."
              />
            </div>
            <p className="search-hint f-body">Search 4,200+ courses across the US</p>
          </div>

          {/* Destinations */}
          <div className="section a4">
            <div className="section-head">
              <span className="section-label">Top Trip Destinations</span>
              <button className="section-link" onClick={() => router.push("/search")}>View all</button>
            </div>
            <div className="dest-wrap">
              {DESTINATIONS.map(d => (
                <button key={d.name} className="dest-pill" onClick={() => router.push(`/search?q=${encodeURIComponent(d.name)}`)}>
                  <span className="dest-name">{d.name}</span>
                  <span className="dest-count">{d.courses} courses</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rule" />

          {/* Trending — real from DB */}
          <div className="section a5">
            <div className="section-head">
              <span className="section-label">Trending This Week</span>
              <button className="section-link" onClick={() => router.push("/search")}>See all</button>
            </div>
            {trendingCourses.map((c, i) => (
              <button key={c.id} className="course-card" onClick={() => router.push(`/courses/${c.id}`)}>
                <div className="c-left">
                  <span className="c-num">{i + 1}</span>
                  <div>
                    <div className="c-name">{c.name}</div>
                    <div className="c-meta">
                      <span>{c.city}, {c.state}</span>
                      <span className="u-dot" />
                      <span>{c.holeCount || 18} holes</span>
                    </div>
                  </div>
                </div>
                <div className="c-right">
                  <span className="c-clips">{c.uploadCount || 0} clips</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <div className="rule" />

          {/* Discovery feed — real uploads */}
          <div className="section a6">
            <div className="section-head">
              <span className="section-label">Fresh Scouting Intel</span>
            </div>
            {discoveryUploads.length === 0 ? (
              <div className="empty-discovery">
                No clips yet — be the first to upload
              </div>
            ) : (
              discoveryUploads.map((u) => (
                <div
                  key={u.id}
                  className="discovery-card"
                  onClick={() => router.push(`/courses/${u.courseId}/holes`)}
                >
                  {u.mediaType === "VIDEO" ? (
                    <video
                      src={u.mediaUrl}
                      className="discovery-media"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img src={u.mediaUrl} alt="clip" className="discovery-media" />
                  )}
                  <div className="discovery-body">
                    <div className="discovery-course">{u.courseName}</div>
                    <div className="discovery-user">@{u.username}</div>
                    {u.strategyNote && (
                      <p className="discovery-note">&ldquo;{u.strategyNote}&rdquo;</p>
                    )}
                    <div className="discovery-tags">
                      {u.shotType && <span className="d-tag">{formatShotType(u.shotType)}</span>}
                      {u.clubUsed && <span className="d-tag d-tag-gray">{u.clubUsed}</span>}
                      <span className="d-tag d-tag-gray">{u.mediaType === "VIDEO" ? "Video" : "Photo"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CTA */}
          <div className="cta-box a7">
            <p className="cta-title">Just played somewhere great?</p>
            <p className="cta-sub">
              Share what you know hole by hole. Your footage helps every golfer who plays it next.
            </p>
            <button className="btn-cta" style={{ fontSize: "14px", padding: "11px 28px" }} onClick={() => router.push("/upload")}>
              Upload your footage
            </button>
          </div>

        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[
            { label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", active: true, path: "/" },
            { label: "Search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z", active: false, path: "/search" },
          ].map(item => (
            <button key={item.label} className="nav-btn" onClick={() => router.push(item.path)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={item.active ? "#4da862" : "rgba(255,255,255,0.3)"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span className="nav-lbl" style={{ color: item.active ? "#4da862" : "rgba(255,255,255,0.25)" }}>
                {item.label}
              </span>
            </button>
          ))}

          <button className="nav-upload-btn" onClick={() => router.push("/upload")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
            Upload
          </button>

          {[
            { label: "Saved", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z", path: "/saved" },
            { label: "Profile", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11A4 4 0 1 0 12 3a4 4 0 0 0 0 8z", path: "/profile" },
          ].map(item => (
            <button key={item.label} className="nav-btn" onClick={() => router.push(item.path)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span className="nav-lbl" style={{ color: "rgba(255,255,255,0.25)" }}>{item.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </main>
  );
}

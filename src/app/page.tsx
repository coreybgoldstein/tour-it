"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const TRENDING_COURSES = [
  { name: "Pebble Beach Golf Links", location: "Pebble Beach, CA", uploads: 142, par: 72, tag: "Bucket List" },
  { name: "Pinehurst No. 2", location: "Pinehurst, NC", uploads: 98, par: 70, tag: "Classic" },
  { name: "Bandon Dunes", location: "Bandon, OR", uploads: 87, par: 72, tag: "Links" },
  { name: "TPC Scottsdale", location: "Scottsdale, AZ", uploads: 76, par: 71, tag: "Trip Favorite" },
  { name: "Kiawah Island Ocean", location: "Kiawah Island, SC", uploads: 64, par: 72, tag: "Coastal" },
];

const RECENT_UPLOADS = [
  { course: "Pebble Beach", hole: 7, par: 3, type: "VIDEO", user: "jgoldstein", note: "Wind off the ocean kills you here. Aim two clubs left of the pin and let it work back.", club: "8-iron" },
  { course: "Pinehurst No. 2", hole: 18, par: 4, type: "VIDEO", user: "trevorm", note: "Crowned green sheds everything right. Go at the middle flag every single time.", club: "Driver" },
  { course: "Bandon Dunes", hole: 4, par: 4, type: "PHOTO", user: "links_scout", note: "Layup to 100 yards is the play. That bunker short right has swallowed a hundred rounds.", club: "3-wood" },
];

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

function TourItLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="40" cy="40" r="38" fill="#0d2318" stroke="rgba(77,168,98,0.35)" strokeWidth="1.5"/>

      {/* Fairway / horizon lines — subtle */}
      <path d="M12 54 Q40 46 68 54" stroke="rgba(77,168,98,0.18)" strokeWidth="1" fill="none"/>
      <path d="M18 60 Q40 53 62 60" stroke="rgba(77,168,98,0.12)" strokeWidth="1" fill="none"/>

      {/* Flag pole */}
      <line x1="40" y1="18" x2="40" y2="54" stroke="#4da862" strokeWidth="2.2" strokeLinecap="round"/>

      {/* Flag waving */}
      <path d="M40 18 Q54 22 52 30 Q54 36 40 34 Z" fill="#4da862"/>

      {/* Golf ball */}
      <circle cx="40" cy="57" r="5" fill="#fff"/>
      {/* Ball dimples */}
      <circle cx="38.5" cy="55.5" r="0.9" fill="rgba(0,0,0,0.12)"/>
      <circle cx="41.5" cy="55.5" r="0.9" fill="rgba(0,0,0,0.12)"/>
      <circle cx="40" cy="57.8" r="0.9" fill="rgba(0,0,0,0.12)"/>

      {/* Hole / cup line */}
      <ellipse cx="40" cy="54" rx="6" ry="1.5" fill="#0a1a10"/>
    </svg>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&family=Outfit:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }

        .f-display { font-family: 'Playfair Display', serif; }
        .f-body    { font-family: 'Outfit', sans-serif; }

        .bg-texture {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .bg-glow-top {
          position: fixed; top: -300px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 600px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(56,140,76,0.13) 0%, transparent 68%);
        }

        .bg-glow-bottom {
          position: fixed; bottom: -200px; right: -100px;
          width: 500px; height: 400px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(180,140,60,0.06) 0%, transparent 70%);
        }

        .rel { position: relative; z-index: 1; }

        /* Nav */
        .nav {
          position: sticky; top: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 22px;
          background: rgba(7,16,10,0.88);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }

        .logo-wrap {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Playfair Display', serif;
          font-size: 21px; font-weight: 900; letter-spacing: 0.01em; color: #fff;
        }

        .logo-tagline {
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 500; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(77,168,98,0.55);
          margin-top: -2px;
        }

        .nav-links { display: flex; align-items: center; gap: 6px; }

        .btn-ghost {
          background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 400;
          color: rgba(255,255,255,0.42); padding: 7px 12px; border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .btn-ghost:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.04); }

        .btn-cta {
          background: #2d7a42; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          color: #fff; padding: 8px 20px; border-radius: 99px;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 2px 12px rgba(45,122,66,0.3);
        }
        .btn-cta:hover { background: #256936; transform: translateY(-1px); }
        .btn-cta:active { transform: translateY(0); }

        .page { max-width: 650px; margin: 0 auto; padding: 0 20px 110px; }

        /* Hero */
        .hero { padding: 48px 0 32px; }

        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(40px, 10vw, 58px);
          font-weight: 900; line-height: 1.04; letter-spacing: -0.015em;
          color: #fff; margin-bottom: 18px;
        }

        .hero-title .italic {
          font-style: italic; font-weight: 700;
          color: rgba(255,255,255,0.38);
        }

        .hero-title .green { color: #4da862; }

        .hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 15px; font-weight: 300; line-height: 1.7;
          color: rgba(255,255,255,0.42); max-width: 420px;
        }

        .hero-sub strong {
          color: rgba(255,255,255,0.7);
          font-weight: 500;
        }

        /* Stats */
        .stats-bar {
          display: flex; margin: 30px 0 38px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; overflow: hidden;
          background: rgba(255,255,255,0.02);
        }

        .stat-item {
          flex: 1; padding: 14px 12px; text-align: center;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .stat-item:last-child { border-right: none; }

        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 2px;
        }

        .stat-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 400; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.28); text-transform: uppercase;
        }

        /* Search */
        .search-outer { margin-bottom: 38px; }

        .search-box {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 16px; padding: 15px 18px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .search-box:focus-within {
          background: rgba(255,255,255,0.055);
          border-color: rgba(77,168,98,0.5);
          box-shadow: 0 0 0 4px rgba(77,168,98,0.08);
        }

        .search-input {
          background: none; border: none; outline: none; width: 100%;
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 400; color: #fff;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.22); }

        .search-hint {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(255,255,255,0.18); margin-top: 8px; padding-left: 4px;
        }

        /* Section */
        .section { margin-bottom: 38px; }

        .section-head {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
        }

        .section-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 600; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(255,255,255,0.28);
        }

        .section-link {
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 500; color: #4da862;
          background: none; border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .section-link:hover { opacity: 0.65; }

        /* Destinations */
        .dest-wrap { display: flex; flex-wrap: wrap; gap: 8px; }

        .dest-pill {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px; padding: 8px 16px;
          cursor: pointer; transition: all 0.15s; font-family: 'Outfit', sans-serif;
        }
        .dest-pill:hover {
          background: rgba(77,168,98,0.09); border-color: rgba(77,168,98,0.35);
        }

        .dest-name { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.68); }
        .dest-count {
          font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.05); border-radius: 99px; padding: 1px 7px;
        }

        .rule {
          height: 1px; margin: 4px 0 38px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.07) 70%, transparent);
        }

        /* Course cards */
        .course-card {
          width: 100%; text-align: left; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px; border-radius: 12px; margin-bottom: 4px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.055);
          transition: all 0.15s;
        }
        .course-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(77,168,98,0.28);
          transform: translateX(2px);
        }

        .c-left { display: flex; align-items: center; gap: 14px; }

        .c-num {
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.08);
          width: 26px; text-align: center; flex-shrink: 0;
        }

        .c-name {
          font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.88); margin-bottom: 3px;
        }

        .c-meta {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(255,255,255,0.3); font-weight: 300;
        }

        .c-tag {
          font-size: 10px; font-weight: 500; letter-spacing: 0.04em;
          color: rgba(180,145,60,0.8);
          background: rgba(180,145,60,0.1);
          border: 1px solid rgba(180,145,60,0.18);
          border-radius: 99px; padding: 1px 7px;
        }

        .c-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .c-clips {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04); border-radius: 99px; padding: 3px 10px;
        }

        /* Upload cards */
        .upload-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.055);
          border-radius: 14px; padding: 16px; margin-bottom: 8px; transition: border-color 0.15s;
        }
        .upload-card:hover { border-color: rgba(255,255,255,0.1); }

        .u-top {
          display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px;
        }

        .u-course {
          font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); margin-bottom: 3px;
        }

        .u-meta {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(255,255,255,0.28); font-weight: 300;
        }

        .u-badge {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          padding: 3px 10px; border-radius: 99px; flex-shrink: 0;
        }
        .badge-video { background: rgba(77,168,98,0.12); color: #4da862; border: 1px solid rgba(77,168,98,0.22); }
        .badge-photo { background: rgba(100,160,220,0.1); color: rgba(130,185,240,0.85); border: 1px solid rgba(100,160,220,0.18); }

        .u-note {
          font-family: 'Playfair Display', serif;
          font-size: 13px; font-style: italic; font-weight: 400;
          color: rgba(255,255,255,0.38); line-height: 1.6;
        }

        .u-club {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 10px;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04); border-radius: 99px; padding: 3px 10px;
        }

        /* CTA */
        .cta-box {
          border-radius: 18px; padding: 28px 24px; text-align: center;
          background: linear-gradient(145deg, rgba(45,122,66,0.14) 0%, rgba(45,122,66,0.04) 100%);
          border: 1px solid rgba(77,168,98,0.2);
          position: relative; overflow: hidden;
        }

        .cta-box::before {
          content: '19TH HOLE';
          position: absolute; top: 12px; right: 16px;
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 600; letter-spacing: 0.2em;
          color: rgba(77,168,98,0.25);
        }

        .cta-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 900; margin-bottom: 8px; color: #fff;
        }

        .cta-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.38);
          line-height: 1.6; margin-bottom: 20px; max-width: 340px; margin-left: auto; margin-right: auto;
        }

        /* Bottom nav */
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-around;
          padding: 10px 8px 18px;
          background: rgba(7,16,10,0.94);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.055);
        }

        .nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          background: none; border: none; cursor: pointer; padding: 4px 16px;
        }

        .nav-lbl {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 400; letter-spacing: 0.04em;
        }

        .nav-upload-btn {
          background: linear-gradient(135deg, #2d7a42, #1d5a30);
          border: none; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 11px 22px; border-radius: 16px; margin-top: -22px;
          box-shadow: 0 4px 20px rgba(45,122,66,0.4);
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,0.85); letter-spacing: 0.06em; text-transform: uppercase;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .nav-upload-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(45,122,66,0.5); }

        .u-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-block; }

        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .a1 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0s both; }
        .a2 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.07s both; }
        .a3 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.13s both; }
        .a4 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.19s both; }
        .a5 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.25s both; }
        .a6 { animation: rise 0.55s cubic-bezier(.22,1,.36,1) 0.31s both; }
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
    <button className="btn-ghost" onClick={() => window.location.href = "/login"}>Log in</button>
    <button className="btn-cta" onClick={() => window.location.href = "/signup"}>Join free</button>
  </>
)}          </div>
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
              <strong>Preview any course, one hole at a time.</strong> Real videos and tips from golfers who've already played it.
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
  onKeyDown={e => { if (e.key === "Enter" && query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`); }}
  placeholder="Find a course — name, city, or state..."
/>
            </div>
            <p className="search-hint f-body">Search 4,200+ courses across the US</p>
          </div>

          {/* Destinations */}
          <div className="section a4">
            <div className="section-head">
              <span className="section-label">Top Trip Destinations</span>
              <button className="section-link">View all</button>
            </div>
            <div className="dest-wrap">
              {DESTINATIONS.map(d => (
                <button key={d.name} className="dest-pill">
                  <span className="dest-name">{d.name}</span>
                  <span className="dest-count">{d.courses} courses</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rule" />

          {/* Trending */}
          <div className="section a5">
            <div className="section-head">
              <span className="section-label">Trending This Week</span>
              <button className="section-link">See all</button>
            </div>
            {TRENDING_COURSES.map((c, i) => (
              <button key={c.name} className="course-card">
                <div className="c-left">
                  <span className="c-num">{i + 1}</span>
                  <div>
                    <div className="c-name">{c.name}</div>
                    <div className="c-meta">
                      <span>{c.location}</span>
                      <span className="u-dot" />
                      <span>Par {c.par}</span>
                      <span className="u-dot" />
                      <span className="c-tag">{c.tag}</span>
                    </div>
                  </div>
                </div>
                <div className="c-right">
                  <span className="c-clips">{c.uploads} clips</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <div className="rule" />

          {/* Recent uploads */}
          <div className="section a6">
            <div className="section-head">
              <span className="section-label">Fresh Scouting Intel</span>
              <button className="section-link">See all</button>
            </div>
            {RECENT_UPLOADS.map((u, i) => (
              <div key={i} className="upload-card">
                <div className="u-top">
                  <div>
                    <div className="u-course">{u.course} &mdash; Hole {u.hole} &middot; Par {u.par}</div>
                    <div className="u-meta">@{u.user}</div>
                  </div>
                  <span className={`u-badge ${u.type === 'VIDEO' ? 'badge-video' : 'badge-photo'}`}>
                    {u.type}
                  </span>
                </div>
                <p className="u-note">&ldquo;{u.note}&rdquo;</p>
                <div className="u-club">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L8 18l4-3 4 3L12 2z"/>
                  </svg>
                  {u.club}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="cta-box a6">
            <p className="cta-title">Just played somewhere great?</p>
            <p className="cta-sub">
              Share what you know hole by hole. Your footage helps every golfer who plays it next.
            </p>
            <button className="btn-cta" style={{ fontSize: '14px', padding: '11px 28px' }}>
              Upload your footage
            </button>
          </div>

        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[
            { label: 'Home', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', active: true },
            { label: 'Search', icon: 'M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z', active: false },
          ].map(item => (
            <button key={item.label} className="nav-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={item.active ? '#4da862' : 'rgba(255,255,255,0.3)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
              <span className="nav-lbl" style={{ color: item.active ? '#4da862' : 'rgba(255,255,255,0.25)' }}>
                {item.label}
              </span>
            </button>
          ))}

          <button className="nav-upload-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
            Upload
          </button>

          {[
            { label: 'Saved', icon: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
            { label: 'Profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11A4 4 0 1 0 12 3a4 4 0 0 0 0 8z' },
          ].map(item => (
            <button key={item.label} className="nav-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
              <span className="nav-lbl" style={{ color: 'rgba(255,255,255,0.25)' }}>{item.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </main>
  );
}

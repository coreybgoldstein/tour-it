"use client";

import { useState } from "react";

const HOLE = {
  number: 7,
  par: 3,
  yards: { black: 120, blue: 106, white: 95, red: 78 },
  handicap: 18,
  course: "Pebble Beach Golf Links",
  courseAbbr: "PB",
  courseColor: "#1a4a6e",
  courseAccent: "#4a9fd4",
  description: "The most photographed hole in golf. A short par 3 that plays directly toward the Pacific Ocean. Club selection is everything — the wind off the water can turn a wedge into a 6-iron in seconds.",
};

const UPLOADS = [
  {
    id: "1",
    user: "jgoldstein",
    handicap: "Mid",
    type: "VIDEO",
    shotType: "Tee Shot",
    club: "9-iron",
    tee: "Blue",
    distance: 106,
    wind: "Into",
    strategy: "Aim at the left third of the green. Wind will push it right. Never go at the flag when it's on the right — it's a guaranteed ocean ball.",
    landingZone: "Left-center of green, let it release to the hole.",
    hidden: "The green slopes hard back-to-front. Anything long is a nightmare chip back toward the cliff.",
    likes: 84,
    views: 412,
    watchCompletion: 0.91,
    rankScore: 98,
    daysAgo: 3,
    thumbnail: null,
  },
  {
    id: "2",
    user: "trevorm",
    handicap: "Low",
    type: "VIDEO",
    shotType: "Tee Shot",
    club: "PW",
    tee: "Blue",
    distance: 106,
    wind: "Calm",
    strategy: "On calm days this hole is gettable. Fire right at the flag. One of the only times you can be aggressive here.",
    landingZone: "Middle of the green. Soft landing — green is receptive when wind is down.",
    hidden: "Pin positions on the right side are traps. That portion of the green has almost no margin.",
    likes: 61,
    views: 298,
    watchCompletion: 0.85,
    rankScore: 87,
    daysAgo: 8,
    thumbnail: null,
  },
  {
    id: "3",
    user: "links_scout",
    handicap: "Scratch",
    type: "PHOTO",
    shotType: "Full Hole",
    club: null,
    tee: "Black",
    distance: 120,
    wind: "Left to Right",
    strategy: "From the tips this plays as a full 8-iron or even 7. Don't be fooled by the short number. Budget an extra club minimum.",
    landingZone: "Aim at the back-left and let the wind work it in.",
    hidden: "The tee box is elevated more than it looks. Ball tends to fly further than you expect from the tips.",
    likes: 47,
    views: 201,
    watchCompletion: 0.78,
    rankScore: 74,
    daysAgo: 14,
    thumbnail: null,
  },
  {
    id: "4",
    user: "weekendwarrior88",
    handicap: "High",
    type: "VIDEO",
    shotType: "Tee Shot",
    club: "8-iron",
    tee: "White",
    distance: 95,
    wind: "Moderate",
    strategy: "Take more club than you think. I hit 8-iron from 95 yards playing into the wind. Just get it on the green and two-putt — bogey here is a win.",
    landingZone: "Front-center. Don't try to be a hero.",
    hidden: "The ocean view messes with your depth perception. The green feels closer than it is.",
    likes: 39,
    views: 188,
    watchCompletion: 0.72,
    rankScore: 61,
    daysAgo: 21,
    thumbnail: null,
  },
];

const TEE_OPTIONS = ["All", "Black", "Blue", "White", "Red"];
const SORT_OPTIONS = ["Top Rated", "Most Recent", "Most Watched"];

const WIND_COLORS: Record<string, string> = {
  "Into":          "rgba(200,80,80,0.8)",
  "Calm":          "rgba(77,168,98,0.8)",
  "Left to Right": "rgba(100,160,220,0.8)",
  "Right to Left": "rgba(100,160,220,0.8)",
  "Downwind":      "rgba(180,145,60,0.8)",
  "Moderate":      "rgba(200,140,60,0.8)",
};

const HANDICAP_COLORS: Record<string, string> = {
  "Scratch": "rgba(210,175,80,0.85)",
  "Low":     "rgba(77,168,98,0.85)",
  "Mid":     "rgba(100,160,220,0.85)",
  "High":    "rgba(180,120,80,0.85)",
};

export default function HolePage() {
  const [activeTee, setActiveTee]   = useState("All");
  const [activeSort, setActiveSort] = useState("Top Rated");
  const [likedIds, setLikedIds]     = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>("1");

  const filtered = UPLOADS.filter(u => activeTee === "All" || u.tee === activeTee);

  const sorted = [...filtered].sort((a, b) => {
    if (activeSort === "Top Rated")    return b.rankScore - a.rankScore;
    if (activeSort === "Most Recent")  return a.daysAgo - b.daysAgo;
    if (activeSort === "Most Watched") return b.views - a.views;
    return 0;
  });

  const toggleLike = (id: string) => {
    setLikedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const activeYards = HOLE.yards[activeTee.toLowerCase() as keyof typeof HOLE.yards] || HOLE.yards.blue;

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .bg-texture {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .rel { position: relative; z-index: 1; }

        /* Nav */
        .nav {
          position: sticky; top: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px;
          background: rgba(7,16,10,0.92); backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }
        .nav-back {
          display: flex; align-items: center; gap: 8px; background: none; border: none;
          cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.45); transition: color 0.15s;
        }
        .nav-back:hover { color: rgba(255,255,255,0.8); }
        .nav-center { text-align: center; }
        .nav-hole {
          font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 900; color: #fff;
        }
        .nav-course {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 400;
          color: rgba(255,255,255,0.3); letter-spacing: 0.04em;
        }
        .upload-btn {
          display: flex; align-items: center; gap: 6px;
          background: #2d7a42; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: #fff; padding: 8px 14px; border-radius: 99px;
          transition: background 0.15s;
        }
        .upload-btn:hover { background: #256936; }

        .page { max-width: 650px; margin: 0 auto; padding: 0 0 110px; }

        /* Hole hero */
        .hole-hero {
          padding: 20px 20px 16px;
          background: linear-gradient(180deg, rgba(26,74,110,0.15) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }

        .hole-hero-top {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px;
        }

        .hole-number-block { flex-shrink: 0; }
        .hole-big-num {
          font-family: 'Playfair Display', serif;
          font-size: 64px; font-weight: 900; line-height: 1;
          color: rgba(255,255,255,0.9); letter-spacing: -0.02em;
        }
        .hole-word {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25);
          margin-top: -2px;
        }

        .hole-stats-block { flex: 1; padding-top: 6px; }
        .hole-stat-row {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
        }
        .hole-chip {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px; padding: 4px 11px;
        }
        .hole-chip.par3  { color: rgba(100,180,220,0.9); background: rgba(60,140,180,0.1); border-color: rgba(60,140,180,0.2); }
        .hole-chip.par4  { color: rgba(77,168,98,0.9);   background: rgba(77,168,98,0.1);  border-color: rgba(77,168,98,0.2); }
        .hole-chip.par5  { color: rgba(210,175,80,0.9);  background: rgba(180,145,60,0.1); border-color: rgba(180,145,60,0.2); }
        .hole-chip.yards { color: rgba(255,255,255,0.7); }

        .hole-desc {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.35); line-height: 1.65;
        }

        /* Tee + sort bar */
        .controls {
          padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.055);
          display: flex; flex-direction: column; gap: 10px;
        }

        .filter-row {
          display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
        }
        .filter-row::-webkit-scrollbar { display: none; }

        .filter-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.22);
          align-self: center; flex-shrink: 0; margin-right: 2px;
        }

        .tee-pill {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 99px; padding: 5px 12px; cursor: pointer; flex-shrink: 0;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.4); transition: all 0.15s;
        }
        .tee-pill:hover { border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.65); }
        .tee-pill.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.24); color: #fff; }
        .tee-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

        .sort-pill {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 99px; padding: 5px 12px; cursor: pointer; flex-shrink: 0;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.35); transition: all 0.15s;
        }
        .sort-pill:hover { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.15); }
        .sort-pill.active { background: rgba(77,168,98,0.1); border-color: rgba(77,168,98,0.3); color: #4da862; }

        /* Upload cards */
        .uploads-wrap { padding: 16px 20px; }

        .uploads-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
        }
        .uploads-count {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25);
        }

        .upload-card {
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; margin-bottom: 10px; overflow: hidden;
          transition: border-color 0.15s;
        }
        .upload-card:hover { border-color: rgba(255,255,255,0.1); }
        .upload-card.top-ranked {
          border-color: rgba(77,168,98,0.25);
          background: rgba(77,168,98,0.03);
        }

        /* Video placeholder */
        .video-thumb {
          width: 100%; aspect-ratio: 16/9; cursor: pointer;
          background: linear-gradient(135deg, #0d1f12, #0a1a10);
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }
        .video-thumb-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .play-btn {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(255,255,255,0.12); backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1; transition: all 0.15s; cursor: pointer;
        }
        .play-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

        .video-meta-overlay {
          position: absolute; bottom: 10px; left: 12px; right: 12px;
          display: flex; align-items: center; justify-content: space-between;
          z-index: 1;
        }
        .video-tee-badge {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          padding: 3px 9px; border-radius: 99px;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7);
        }
        .top-badge {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          background: #4da862; color: #fff; padding: 3px 9px; border-radius: 99px;
        }

        /* Card body */
        .card-body { padding: 14px 16px; }

        .card-top {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
        }
        .card-user-row { display: flex; align-items: center; gap: 8px; }
        .user-avatar {
          width: 28px; height: 28px; border-radius: 99px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.6); flex-shrink: 0;
        }
        .user-name {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.8);
        }
        .user-hcp {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500;
          padding: 2px 7px; border-radius: 99px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
        }
        .days-ago {
          font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.22);
        }

        /* Metadata chips */
        .meta-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
        .meta-chip {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500;
          padding: 3px 9px; border-radius: 99px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.45);
          display: flex; align-items: center; gap: 4px;
        }
        .meta-chip.club  { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.12); }
        .meta-chip.wind  { border-color: rgba(255,255,255,0.1); }
        .meta-chip.type-video { color: #4da862; background: rgba(77,168,98,0.08); border-color: rgba(77,168,98,0.2); }
        .meta-chip.type-photo { color: rgba(130,185,240,0.85); background: rgba(100,160,220,0.08); border-color: rgba(100,160,220,0.18); }

        /* Intel sections */
        .intel-wrap { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }

        .intel-block {
          background: rgba(255,255,255,0.025); border-radius: 10px;
          padding: 10px 12px; border-left: 2px solid transparent;
        }
        .intel-block.strategy { border-left-color: #4da862; }
        .intel-block.landing  { border-left-color: rgba(100,160,220,0.6); }
        .intel-block.hidden   { border-left-color: rgba(210,175,80,0.6); }

        .intel-label {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px;
        }
        .intel-label.strategy { color: #4da862; }
        .intel-label.landing  { color: rgba(100,160,220,0.8); }
        .intel-label.hidden   { color: rgba(210,175,80,0.7); }

        .intel-text {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 300;
          color: rgba(255,255,255,0.6); line-height: 1.6;
        }

        /* Collapsed preview */
        .collapsed-preview {
          font-family: 'Playfair Display', serif; font-style: italic;
          font-size: 13px; color: rgba(255,255,255,0.38); line-height: 1.5;
          margin-bottom: 10px; cursor: pointer;
        }

        /* Card actions */
        .card-actions {
          display: flex; align-items: center; gap: 12px;
          padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.055);
        }
        .action-btn {
          display: flex; align-items: center; gap: 5px;
          background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 400;
          color: rgba(255,255,255,0.35); transition: color 0.15s; padding: 0;
        }
        .action-btn:hover { color: rgba(255,255,255,0.65); }
        .action-btn.liked { color: #4da862; }
        .expand-btn {
          margin-left: auto; background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.3); transition: color 0.15s; padding: 0;
        }
        .expand-btn:hover { color: rgba(255,255,255,0.6); }

        /* Upload CTA */
        .upload-cta {
          margin: 0 20px 20px; padding: 18px 20px;
          background: linear-gradient(135deg, rgba(45,122,66,0.12), rgba(45,122,66,0.04));
          border: 1px solid rgba(77,168,98,0.2); border-radius: 16px; text-align: center;
        }
        .cta-title {
          font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700;
          color: #fff; margin-bottom: 6px;
        }
        .cta-sub {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.35); margin-bottom: 16px; line-height: 1.5;
        }
        .btn-cta {
          background: #2d7a42; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          color: #fff; padding: 10px 26px; border-radius: 99px; transition: background 0.15s;
        }
        .btn-cta:hover { background: #256936; }

        /* Bottom nav */
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-around;
          padding: 10px 8px 18px;
          background: rgba(7,16,10,0.94); backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.055);
        }
        .nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          background: none; border: none; cursor: pointer; padding: 4px 16px;
        }
        .nav-lbl { font-family: 'Outfit', sans-serif; font-size: 10px; letter-spacing: 0.04em; }
        .nav-upload-btn {
          background: linear-gradient(135deg, #2d7a42, #1d5a30); border: none; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 11px 22px; border-radius: 16px; margin-top: -22px;
          box-shadow: 0 4px 20px rgba(45,122,66,0.4);
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,0.85); letter-spacing: 0.06em; text-transform: uppercase;
          transition: transform 0.15s;
        }
        .nav-upload-btn:hover { transform: translateY(-2px); }

        @keyframes rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .a1 { animation: rise 0.4s ease 0s both; }
        .a2 { animation: rise 0.4s ease 0.06s both; }
        .a3 { animation: rise 0.4s ease 0.12s both; }
        .card-rise { animation: rise 0.35s ease both; }
      `}</style>

      <div className="bg-texture" />

      <div className="rel">
        {/* Nav */}
        <nav className="nav">
          <button className="nav-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Course
          </button>
          <div className="nav-center">
            <div className="nav-hole">Hole {HOLE.number}</div>
            <div className="nav-course">{HOLE.course}</div>
          </div>
          <button className="upload-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
            Upload
          </button>
        </nav>

        <div className="page">

          {/* Hole hero */}
          <div className="hole-hero a1">
            <div className="hole-hero-top">
              <div className="hole-number-block">
                <div className="hole-big-num">{HOLE.number}</div>
                <div className="hole-word">Hole</div>
              </div>
              <div className="hole-stats-block">
                <div className="hole-stat-row">
                  <span className={`hole-chip par${HOLE.par}`}>Par {HOLE.par}</span>
                  <span className="hole-chip yards">
                    {activeTee !== "All" ? activeYards : HOLE.yards.blue} yds
                  </span>
                  <span className="hole-chip">Hdcp {HOLE.handicap}</span>
                  <span className="hole-chip" style={{ color: '#4da862' }}>{sorted.length} clips</span>
                </div>
              </div>
            </div>
            <p className="hole-desc">{HOLE.description}</p>
          </div>

          {/* Controls */}
          <div className="controls a2">
            <div className="filter-row">
              <span className="filter-label">Tees</span>
              {TEE_OPTIONS.map(tee => {
                const teeColors: Record<string, string> = { All: "#555", Black: "#111", Blue: "#2a6db5", White: "#e8e8e8", Red: "#c0392b" };
                return (
                  <button key={tee} className={`tee-pill ${activeTee === tee ? "active" : ""}`} onClick={() => setActiveTee(tee)}>
                    {tee !== "All" && <span className="tee-dot" style={{ background: teeColors[tee], border: tee === "White" ? "1px solid rgba(255,255,255,0.3)" : "none" }} />}
                    {tee}
                  </button>
                );
              })}
            </div>
            <div className="filter-row">
              <span className="filter-label">Sort</span>
              {SORT_OPTIONS.map(s => (
                <button key={s} className={`sort-pill ${activeSort === s ? "active" : ""}`} onClick={() => setActiveSort(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Upload cards */}
          <div className="uploads-wrap a3">
            <div className="uploads-header">
              <span className="uploads-count">{sorted.length} clip{sorted.length !== 1 ? "s" : ""}{activeTee !== "All" ? ` · ${activeTee} tees` : ""}</span>
            </div>

            {sorted.map((upload, i) => {
              const isExpanded = expandedId === upload.id;
              const isLiked    = likedIds.includes(upload.id);
              const isTop      = i === 0;
              const initials   = upload.user.slice(0, 2).toUpperCase();

              return (
                <div key={upload.id} className={`upload-card card-rise ${isTop ? "top-ranked" : ""}`} style={{ animationDelay: `${i * 0.06}s` }}>

                  {/* Video/Photo thumbnail */}
                  {upload.type === "VIDEO" && (
                    <div className="video-thumb">
                      <div className="video-thumb-grid" />
                      <div className="play-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                      <div className="video-meta-overlay">
                        <span className="video-tee-badge">{upload.tee} · {upload.distance} yds</span>
                        {isTop && <span className="top-badge">Top Rated</span>}
                      </div>
                    </div>
                  )}

                  <div className="card-body">
                    {/* User row */}
                    <div className="card-top">
                      <div className="card-user-row">
                        <div className="user-avatar">{initials}</div>
                        <span className="user-name">@{upload.user}</span>
                        <span className="user-hcp" style={{ color: HANDICAP_COLORS[upload.handicap] }}>
                          {upload.handicap}
                        </span>
                      </div>
                      <span className="days-ago">{upload.daysAgo}d ago</span>
                    </div>

                    {/* Metadata chips */}
                    <div className="meta-chips">
                      <span className={`meta-chip ${upload.type === "VIDEO" ? "type-video" : "type-photo"}`}>
                        {upload.type === "VIDEO" ? "▶ Video" : "Photo"}
                      </span>
                      <span className="meta-chip">{upload.shotType}</span>
                      {upload.club && <span className="meta-chip club">{upload.club}</span>}
                      {upload.wind && (
                        <span className="meta-chip wind" style={{ color: WIND_COLORS[upload.wind] || "rgba(255,255,255,0.45)" }}>
                          {upload.wind} wind
                        </span>
                      )}
                    </div>

                    {/* Intel — expanded or collapsed */}
                    {isExpanded ? (
                      <div className="intel-wrap">
                        <div className="intel-block strategy">
                          <div className="intel-label strategy">Strategy</div>
                          <div className="intel-text">{upload.strategy}</div>
                        </div>
                        <div className="intel-block landing">
                          <div className="intel-label landing">Landing Zone</div>
                          <div className="intel-text">{upload.landingZone}</div>
                        </div>
                        <div className="intel-block hidden">
                          <div className="intel-label hidden">What the Camera Doesn't Show</div>
                          <div className="intel-text">{upload.hidden}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="collapsed-preview" onClick={() => setExpandedId(upload.id)}>
                        &ldquo;{upload.strategy.slice(0, 90)}&hellip;&rdquo;
                      </div>
                    )}

                    {/* Actions */}
                    <div className="card-actions">
                      <button className={`action-btn ${isLiked ? "liked" : ""}`} onClick={() => toggleLike(upload.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {upload.likes + (isLiked ? 1 : 0)}
                      </button>
                      <button className="action-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {upload.views}
                      </button>
                      <button className="action-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Comment
                      </button>
                      <button className="expand-btn" onClick={() => setExpandedId(isExpanded ? null : upload.id)}>
                        {isExpanded ? "Show less ↑" : "Full intel ↓"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Upload CTA */}
            <div className="upload-cta">
              <p className="cta-title">Played this hole?</p>
              <p className="cta-sub">Add your clip and help the next golfer know exactly what they're walking into.</p>
              <button className="btn-cta">Upload your footage</button>
            </div>
          </div>

        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[
            { label: "Home",   icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", active: false },
            { label: "Search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z", active: false },
          ].map(item => (
            <button key={item.label} className="nav-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
              <span className="nav-lbl" style={{ color: "rgba(255,255,255,0.25)" }}>{item.label}</span>
            </button>
          ))}

          <button className="nav-upload-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
            Upload
          </button>

          {[
            { label: "Saved",   icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
            { label: "Profile", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11A4 4 0 1 0 12 3a4 4 0 0 0 0 8z" },
          ].map(item => (
            <button key={item.label} className="nav-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
              <span className="nav-lbl" style={{ color: "rgba(255,255,255,0.25)" }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";

const COURSE = {
  id: "1",
  name: "Pebble Beach Golf Links",
  abbr: "PB",
  color: "#1a4a6e",
  accent: "#4a9fd4",
  city: "Pebble Beach",
  state: "CA",
  country: "US",
  par: 72,
  holes: 18,
  rating: 75.5,
  slope: 145,
  tag: "Bucket List",
  public: true,
  description: "Perched on the cliffs of the Monterey Peninsula, Pebble Beach is the most celebrated public golf course in America. Dramatic ocean views, brutal winds, and iconic risk-reward holes make every round unforgettable.",
  uploads: 142,
  saves: 3200,
};

const HOLES = [
  { number: 1,  par: 4, yards: 381, handicap: 8,  uploads: 12, hotUploads: true  },
  { number: 2,  par: 5, yards: 502, handicap: 14, uploads: 6,  hotUploads: false },
  { number: 3,  par: 4, yards: 390, handicap: 10, uploads: 8,  hotUploads: false },
  { number: 4,  par: 4, yards: 331, handicap: 16, uploads: 5,  hotUploads: false },
  { number: 5,  par: 3, yards: 188, handicap: 12, uploads: 9,  hotUploads: false },
  { number: 6,  par: 5, yards: 516, handicap: 2,  uploads: 14, hotUploads: true  },
  { number: 7,  par: 3, yards: 106, handicap: 18, uploads: 22, hotUploads: true  },
  { number: 8,  par: 4, yards: 428, handicap: 4,  uploads: 11, hotUploads: true  },
  { number: 9,  par: 4, yards: 466, handicap: 6,  uploads: 7,  hotUploads: false },
  { number: 10, par: 4, yards: 446, handicap: 1,  uploads: 9,  hotUploads: false },
  { number: 11, par: 4, yards: 380, handicap: 13, uploads: 4,  hotUploads: false },
  { number: 12, par: 3, yards: 202, handicap: 17, uploads: 6,  hotUploads: false },
  { number: 13, par: 4, yards: 399, handicap: 9,  uploads: 5,  hotUploads: false },
  { number: 14, par: 5, yards: 572, handicap: 3,  uploads: 8,  hotUploads: false },
  { number: 15, par: 4, yards: 397, handicap: 15, uploads: 6,  hotUploads: false },
  { number: 16, par: 4, yards: 403, handicap: 5,  uploads: 7,  hotUploads: false },
  { number: 17, par: 3, yards: 178, handicap: 7,  uploads: 18, hotUploads: true  },
  { number: 18, par: 5, yards: 543, handicap: 11, uploads: 15, hotUploads: true  },
];

const TEE_OPTIONS = ["Black", "Blue", "White", "Red"];

const frontNine  = HOLES.slice(0, 9);
const backNine   = HOLES.slice(9, 18);
const frontPar   = frontNine.reduce((s, h) => s + h.par, 0);
const backPar    = backNine.reduce((s, h) => s + h.par, 0);
const frontYards = frontNine.reduce((s, h) => s + h.yards, 0);
const backYards  = backNine.reduce((s, h) => s + h.yards, 0);

export default function CoursePage() {
  const [saved, setSaved]       = useState(false);
  const [activeTee, setActiveTee] = useState("Blue");
  const [activeTab, setActiveTab] = useState<"holes" | "info">("holes");

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
          display: flex; align-items: center; gap: 8px;
          background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.45); transition: color 0.15s;
        }
        .nav-back:hover { color: rgba(255,255,255,0.8); }
        .nav-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 900; color: #fff;
          max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .save-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: 1px solid rgba(255,255,255,0.12);
          border-radius: 99px; padding: 7px 14px; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.55); transition: all 0.15s;
        }
        .save-btn:hover { border-color: rgba(77,168,98,0.4); color: #4da862; }
        .save-btn.saved {
          background: rgba(77,168,98,0.14); border-color: rgba(77,168,98,0.45); color: #4da862;
        }

        .page { max-width: 650px; margin: 0 auto; padding: 0 0 110px; }

        /* Hero header */
        .course-hero {
          padding: 24px 20px 20px;
          background: linear-gradient(180deg, rgba(26,74,110,0.18) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }

        .hero-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }

        .club-logo {
          width: 52px; height: 52px; border-radius: 13px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif; font-weight: 900;
          font-size: 16px; position: relative; overflow: hidden;
        }
        .club-logo-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
        }

        .hero-info { flex: 1; }
        .hero-name {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; line-height: 1.1;
          color: #fff; margin-bottom: 5px;
        }
        .hero-location {
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.38); font-weight: 300;
          display: flex; align-items: center; gap: 5px;
        }

        .hero-stats {
          display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
        }
        .hero-stat {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px; padding: 4px 11px;
        }
        .hero-stat.green {
          color: #4da862; background: rgba(77,168,98,0.1); border-color: rgba(77,168,98,0.2);
        }
        .hero-stat.gold {
          color: rgba(210,175,80,0.85); background: rgba(180,145,60,0.1); border-color: rgba(180,145,60,0.2);
        }

        .hero-desc {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.35); line-height: 1.65;
        }

        /* Tee selector */
        .tee-row {
          display: flex; align-items: center; gap: 8px; padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.055);
          overflow-x: auto; scrollbar-width: none;
        }
        .tee-row::-webkit-scrollbar { display: none; }
        .tee-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25);
          flex-shrink: 0; margin-right: 4px;
        }
        .tee-pill {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px; padding: 6px 14px; cursor: pointer; flex-shrink: 0;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.45); transition: all 0.15s;
        }
        .tee-pill:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .tee-pill.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.25); color: #fff; }
        .tee-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        /* Tabs */
        .tabs {
          display: flex; border-bottom: 1px solid rgba(255,255,255,0.055);
          padding: 0 20px;
        }
        .tab {
          background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.3); padding: 14px 16px 12px;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          transition: all 0.15s;
        }
        .tab:hover { color: rgba(255,255,255,0.6); }
        .tab.active { color: #fff; border-bottom-color: #4da862; }

        /* Hole grid section */
        .scorecard { padding: 20px; }

        .nine-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.25); margin-bottom: 10px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .nine-summary {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 400;
          color: rgba(255,255,255,0.2);
        }

        .hole-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 20px;
        }

        .hole-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.055);
          border-radius: 12px; padding: 12px 12px 10px;
          cursor: pointer; transition: all 0.15s; text-align: left;
          position: relative; overflow: hidden;
        }
        .hole-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(77,168,98,0.3);
          transform: translateY(-1px);
        }
        .hole-card.hot {
          border-color: rgba(77,168,98,0.25);
          background: rgba(77,168,98,0.04);
        }

        .hole-top {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
        }
        .hole-number {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 900; color: rgba(255,255,255,0.85); line-height: 1;
        }
        .hole-par {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.06); border-radius: 99px; padding: 2px 7px;
        }

        .hole-yards {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 400;
          color: rgba(255,255,255,0.45); margin-bottom: 8px;
        }

        .hole-footer {
          display: flex; align-items: center; justify-content: space-between;
        }

        .hole-clips {
          display: flex; align-items: center; gap: 4px;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 400;
          color: rgba(255,255,255,0.28);
        }
        .hole-clips.has-clips { color: #4da862; }

        .hot-badge {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(210,175,80,0.8); background: rgba(180,145,60,0.1);
          border: 1px solid rgba(180,145,60,0.2); border-radius: 99px; padding: 1px 6px;
        }

        .no-clips-bar {
          height: 2px; border-radius: 99px;
          background: rgba(255,255,255,0.05); margin-top: 6px;
        }
        .clips-bar {
          height: 2px; border-radius: 99px; background: #4da862;
          transition: width 0.4s ease;
        }

        /* Divider */
        .rule {
          height: 1px; margin: 4px 0 20px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent);
        }

        /* Info tab */
        .info-section { padding: 20px; }
        .info-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .info-row:last-child { border-bottom: none; }
        .info-key {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 300;
          color: rgba(255,255,255,0.35);
        }
        .info-val {
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.8);
        }

        /* CTA strip */
        .upload-strip {
          margin: 0 20px 20px; padding: 16px 18px;
          background: linear-gradient(135deg, rgba(45,122,66,0.12), rgba(45,122,66,0.04));
          border: 1px solid rgba(77,168,98,0.2); border-radius: 14px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .upload-strip-text { font-family: 'Outfit', sans-serif; }
        .upload-strip-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 2px; }
        .upload-strip-sub { font-size: 12px; font-weight: 300; color: rgba(255,255,255,0.35); }
        .btn-upload-sm {
          background: #2d7a42; border: none; cursor: pointer; flex-shrink: 0;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: #fff; padding: 9px 18px; border-radius: 99px;
          transition: background 0.15s; white-space: nowrap;
        }
        .btn-upload-sm:hover { background: #256936; }

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
        .hole-anim { animation: rise 0.35s ease both; }
      `}</style>

      <div className="bg-texture" />

      <div className="rel">
        {/* Nav */}
        <nav className="nav">
          <button className="nav-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Search
          </button>
          <span className="nav-title">{COURSE.name}</span>
          <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => setSaved(!saved)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "#4da862" : "none"} stroke={saved ? "#4da862" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            {saved ? "Saved" : "Save"}
          </button>
        </nav>

        <div className="page">

          {/* Hero */}
          <div className="course-hero a1">
            <div className="hero-top">
              <div
                className="club-logo"
                style={{ background: `linear-gradient(145deg, ${COURSE.color}, ${COURSE.color}dd)`, border: `1px solid ${COURSE.accent}44` }}
              >
                <div className="club-logo-shimmer" />
                <span style={{ color: COURSE.accent, position: "relative", zIndex: 1 }}>{COURSE.abbr}</span>
              </div>
              <div className="hero-info">
                <div className="hero-name">{COURSE.name}</div>
                <div className="hero-location">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {COURSE.city}, {COURSE.state}
                </div>
              </div>
            </div>

            <div className="hero-stats">
              <span className="hero-stat">Par {COURSE.par}</span>
              <span className="hero-stat">{COURSE.holes} holes</span>
              <span className="hero-stat">Rating {COURSE.rating}</span>
              <span className="hero-stat">Slope {COURSE.slope}</span>
              <span className="hero-stat green">{COURSE.uploads} clips</span>
              <span className="hero-stat gold">{COURSE.tag}</span>
              {COURSE.public && <span className="hero-stat">Public</span>}
            </div>

            <p className="hero-desc">{COURSE.description}</p>
          </div>

          {/* Tee selector */}
          <div className="tee-row a2">
            <span className="tee-label">Tees</span>
            {TEE_OPTIONS.map(tee => {
              const teeColors: Record<string, string> = { Black: "#111", Blue: "#2a6db5", White: "#e8e8e8", Red: "#c0392b" };
              return (
                <button key={tee} className={`tee-pill ${activeTee === tee ? "active" : ""}`} onClick={() => setActiveTee(tee)}>
                  <span className="tee-dot" style={{ background: teeColors[tee], border: tee === "White" ? "1px solid rgba(255,255,255,0.3)" : "none" }} />
                  {tee}
                </button>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="tabs a3">
            <button className={`tab ${activeTab === "holes" ? "active" : ""}`} onClick={() => setActiveTab("holes")}>
              Hole Guide
            </button>
            <button className={`tab ${activeTab === "info" ? "active" : ""}`} onClick={() => setActiveTab("info")}>
              Course Info
            </button>
          </div>

          {activeTab === "holes" && (
            <div className="scorecard">

              {/* Upload CTA */}
              <div className="upload-strip" style={{ marginBottom: 20, marginLeft: 0, marginRight: 0 }}>
                <div className="upload-strip-text">
                  <div className="upload-strip-title">Played here recently?</div>
                  <div className="upload-strip-sub">Add your hole-by-hole footage</div>
                </div>
                <button className="btn-upload-sm">Upload</button>
              </div>

              {/* Front nine */}
              <div className="nine-label">
                <span>Front Nine</span>
                <span className="nine-summary">Par {frontPar} &middot; {frontYards.toLocaleString()} yds</span>
              </div>
              <div className="hole-grid">
                {frontNine.map((hole, i) => {
                  const maxUploads = 22;
                  const barWidth = Math.round((hole.uploads / maxUploads) * 100);
                  return (
                    <button
                      key={hole.number}
                      className={`hole-card hole-anim ${hole.hotUploads ? "hot" : ""}`}
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      <div className="hole-top">
                        <span className="hole-number">{hole.number}</span>
                        <span className="hole-par">Par {hole.par}</span>
                      </div>
                      <div className="hole-yards">{hole.yards} yds</div>
                      <div className="hole-footer">
                        <span className={`hole-clips ${hole.uploads > 0 ? "has-clips" : ""}`}>
                          {hole.uploads > 0 ? (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              {hole.uploads}
                            </>
                          ) : "No clips"}
                        </span>
                        {hole.hotUploads && <span className="hot-badge">Hot</span>}
                      </div>
                      <div className="no-clips-bar">
                        <div className="clips-bar" style={{ width: `${barWidth}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rule" />

              {/* Back nine */}
              <div className="nine-label">
                <span>Back Nine</span>
                <span className="nine-summary">Par {backPar} &middot; {backYards.toLocaleString()} yds</span>
              </div>
              <div className="hole-grid">
                {backNine.map((hole, i) => {
                  const maxUploads = 22;
                  const barWidth = Math.round((hole.uploads / maxUploads) * 100);
                  return (
                    <button
                      key={hole.number}
                      className={`hole-card hole-anim ${hole.hotUploads ? "hot" : ""}`}
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      <div className="hole-top">
                        <span className="hole-number">{hole.number}</span>
                        <span className="hole-par">Par {hole.par}</span>
                      </div>
                      <div className="hole-yards">{hole.yards} yds</div>
                      <div className="hole-footer">
                        <span className={`hole-clips ${hole.uploads > 0 ? "has-clips" : ""}`}>
                          {hole.uploads > 0 ? (
                            <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              {hole.uploads}
                            </>
                          ) : "No clips"}
                        </span>
                        {hole.hotUploads && <span className="hot-badge">Hot</span>}
                      </div>
                      <div className="no-clips-bar">
                        <div className="clips-bar" style={{ width: `${barWidth}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {activeTab === "info" && (
            <div className="info-section">
              {[
                { key: "Location",      val: `${COURSE.city}, ${COURSE.state}` },
                { key: "Access",        val: COURSE.public ? "Public" : "Private" },
                { key: "Holes",         val: String(COURSE.holes) },
                { key: "Par",           val: String(COURSE.par) },
                { key: "Course Rating", val: String(COURSE.rating) },
                { key: "Slope",         val: String(COURSE.slope) },
                { key: "Total Clips",   val: `${COURSE.uploads} uploaded` },
                { key: "Saves",         val: `${COURSE.saves.toLocaleString()} golfers` },
              ].map(row => (
                <div key={row.key} className="info-row">
                  <span className="info-key">{row.key}</span>
                  <span className="info-val">{row.val}</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[
            { label: "Home",   icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", active: false },
            { label: "Search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z", active: false },
          ].map(item => (
            <button key={item.label} className="nav-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={item.active ? "#4da862" : "rgba(255,255,255,0.3)"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
              <span className="nav-lbl" style={{ color: item.active ? "#4da862" : "rgba(255,255,255,0.25)" }}>{item.label}</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

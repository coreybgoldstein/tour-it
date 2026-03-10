"use client";
import { Suspense } from "react";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const ALL_COURSES = [
  { id: "1",  name: "Pebble Beach Golf Links",    abbr: "PB",  color: "#1a4a6e", accent: "#4a9fd4", city: "Pebble Beach",      state: "CA", par: 72, holes: 18, uploads: 142, tag: "Bucket List",    public: true },
  { id: "2",  name: "Pinehurst No. 2",            abbr: "P2",  color: "#3d2b1a", accent: "#c8a96e", city: "Pinehurst",         state: "NC", par: 70, holes: 18, uploads: 98,  tag: "Classic",        public: true },
  { id: "3",  name: "Bandon Dunes",               abbr: "BD",  color: "#1a3a2a", accent: "#4da862", city: "Bandon",            state: "OR", par: 72, holes: 18, uploads: 87,  tag: "Links",          public: true },
  { id: "4",  name: "TPC Scottsdale",             abbr: "TPC", color: "#3a1a10", accent: "#d4724a", city: "Scottsdale",        state: "AZ", par: 71, holes: 18, uploads: 76,  tag: "Trip Favorite",  public: true },
  { id: "5",  name: "Kiawah Island Ocean Course", abbr: "KI",  color: "#0e2e3a", accent: "#4ab8d4", city: "Kiawah Island",    state: "SC", par: 72, holes: 18, uploads: 64,  tag: "Coastal",        public: true },
  { id: "6",  name: "Bethpage Black",             abbr: "BPB", color: "#1a1a1a", accent: "#888888", city: "Farmingdale",       state: "NY", par: 71, holes: 18, uploads: 58,  tag: "Challenge",      public: true },
  { id: "7",  name: "Torrey Pines South",         abbr: "TP",  color: "#1a3020", accent: "#5db86a", city: "La Jolla",          state: "CA", par: 72, holes: 18, uploads: 54,  tag: "Public Classic", public: true },
  { id: "8",  name: "Augusta National",           abbr: "AN",  color: "#0d2e18", accent: "#2db84a", city: "Augusta",           state: "GA", par: 72, holes: 18, uploads: 41,  tag: "Legendary",      public: false },
  { id: "9",  name: "Whistling Straits",          abbr: "WS",  color: "#1a2a3a", accent: "#6a9fd4", city: "Kohler",            state: "WI", par: 72, holes: 18, uploads: 39,  tag: "Links",          public: true },
  { id: "10", name: "Sea Island Seaside",         abbr: "SI",  color: "#0e2a2e", accent: "#4accd4", city: "St. Simons Island", state: "GA", par: 70, holes: 18, uploads: 33,  tag: "Coastal",        public: false },
  { id: "11", name: "Chambers Bay",               abbr: "CB",  color: "#2a2a1a", accent: "#b8b44a", city: "University Place",  state: "WA", par: 72, holes: 18, uploads: 28,  tag: "Links",          public: true },
  { id: "12", name: "Shadow Creek",               abbr: "SC",  color: "#1a0e2e", accent: "#9a6ad4", city: "North Las Vegas",   state: "NV", par: 72, holes: 18, uploads: 22,  tag: "Resort",         public: false },
  { id: "13", name: "Streamsong Red",             abbr: "SR",  color: "#2e1a10", accent: "#d4824a", city: "Bowling Green",     state: "FL", par: 72, holes: 18, uploads: 31,  tag: "Hidden Gem",     public: true },
  { id: "14", name: "TPC Sawgrass",               abbr: "SAW", color: "#0e2a1a", accent: "#4ab870", city: "Ponte Vedra Beach", state: "FL", par: 72, holes: 18, uploads: 88,  tag: "Iconic",         public: true },
  { id: "15", name: "Wolf Creek Golf Club",       abbr: "WC",  color: "#2e1a0e", accent: "#d4a44a", city: "Mesquite",          state: "NV", par: 72, holes: 18, uploads: 19,  tag: "Desert",         public: true },
];

const STATES = ["All", "AZ", "CA", "FL", "GA", "NC", "NV", "NY", "OR", "SC", "WA", "WI"];

const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "Bucket List":    { bg: "rgba(180,145,60,0.1)",  color: "rgba(210,175,80,0.85)",  border: "rgba(180,145,60,0.2)" },
  "Classic":        { bg: "rgba(200,170,100,0.1)", color: "rgba(220,190,120,0.85)", border: "rgba(200,170,100,0.2)" },
  "Links":          { bg: "rgba(60,140,180,0.1)",  color: "rgba(90,170,210,0.85)",  border: "rgba(60,140,180,0.2)" },
  "Trip Favorite":  { bg: "rgba(77,168,98,0.1)",   color: "rgba(77,168,98,0.85)",   border: "rgba(77,168,98,0.2)" },
  "Coastal":        { bg: "rgba(60,160,200,0.1)",  color: "rgba(90,190,230,0.85)",  border: "rgba(60,160,200,0.2)" },
  "Challenge":      { bg: "rgba(140,140,140,0.1)", color: "rgba(180,180,180,0.85)", border: "rgba(140,140,140,0.2)" },
  "Public Classic": { bg: "rgba(77,168,98,0.1)",   color: "rgba(77,168,98,0.85)",   border: "rgba(77,168,98,0.2)" },
  "Legendary":      { bg: "rgba(180,145,60,0.1)",  color: "rgba(210,175,80,0.85)",  border: "rgba(180,145,60,0.2)" },
  "Resort":         { bg: "rgba(160,100,180,0.1)", color: "rgba(190,130,210,0.85)", border: "rgba(160,100,180,0.2)" },
  "Hidden Gem":     { bg: "rgba(77,168,98,0.1)",   color: "rgba(77,168,98,0.85)",   border: "rgba(77,168,98,0.2)" },
  "Iconic":         { bg: "rgba(180,145,60,0.1)",  color: "rgba(210,175,80,0.85)",  border: "rgba(180,145,60,0.2)" },
  "Desert":         { bg: "rgba(200,140,60,0.1)",  color: "rgba(230,170,90,0.85)",  border: "rgba(200,140,60,0.2)" },
};

function SearchPageInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedState, setSelectedState] = useState("All");
  const [results, setResults]           = useState(ALL_COURSES);
  const [focused, setFocused]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    let filtered = ALL_COURSES;
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      );
    }
    if (selectedState !== "All") {
      filtered = filtered.filter(c => c.state === selectedState);
    }
    setResults(filtered);
  }, [query, selectedState]);

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
        .bg-glow {
          position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
          width: 700px; height: 500px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(56,140,76,0.1) 0%, transparent 68%);
        }
        .rel { position: relative; z-index: 1; }

        .nav {
          position: sticky; top: 0; z-index: 99;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 22px;
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
          font-size: 18px; font-weight: 900; color: #fff;
        }
        .nav-count {
          font-family: 'Outfit', sans-serif; font-size: 12px;
          color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.05);
          padding: 4px 10px; border-radius: 99px;
        }

        .page { max-width: 650px; margin: 0 auto; padding: 0 20px 110px; }

        .search-header { padding: 24px 0 20px; }

        .search-box {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 15px 18px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-box.focused {
          border-color: rgba(77,168,98,0.5);
          box-shadow: 0 0 0 4px rgba(77,168,98,0.08);
        }
        .search-input {
          background: none; border: none; outline: none; width: 100%;
          font-family: 'Outfit', sans-serif; font-size: 16px; color: #fff;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.2); }
        .clear-btn {
          background: rgba(255,255,255,0.08); border: none; cursor: pointer;
          color: rgba(255,255,255,0.5); border-radius: 99px;
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .clear-btn:hover { background: rgba(255,255,255,0.14); }

        .filter-wrap {
          display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-top: 14px;
          scrollbar-width: none;
        }
        .filter-wrap::-webkit-scrollbar { display: none; }
        .filter-pill {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 99px; padding: 6px 14px; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.45); white-space: nowrap;
          transition: all 0.15s; flex-shrink: 0;
        }
        .filter-pill:hover { border-color: rgba(77,168,98,0.3); color: rgba(255,255,255,0.7); }
        .filter-pill.active {
          background: rgba(77,168,98,0.14); border-color: rgba(77,168,98,0.45); color: #4da862;
        }

        .results-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.25); margin-bottom: 12px;
        }

        /* Course card */
        .course-card {
          width: 100%; text-align: left; cursor: pointer;
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px; margin-bottom: 6px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.055);
          transition: all 0.15s;
        }
        .course-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(77,168,98,0.3);
          transform: translateX(3px);
        }

        /* Club logo badge */
        .club-logo {
          width: 46px; height: 46px; border-radius: 11px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-weight: 900; letter-spacing: -0.02em;
          position: relative; overflow: hidden;
        }
        .club-logo-inner {
          position: relative; z-index: 1;
          font-size: 13px; line-height: 1; text-align: center;
        }
        .club-logo-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
        }

        .course-info { flex: 1; min-width: 0; }
        .course-name {
          font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500;
          color: rgba(255,255,255,0.9); margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .course-meta {
          display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
          font-family: 'Outfit', sans-serif; font-size: 11px;
          color: rgba(255,255,255,0.3); font-weight: 300;
        }
        .meta-dot { width: 2px; height: 2px; border-radius: 50%; background: rgba(255,255,255,0.18); flex-shrink: 0; }

        .course-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .tag-badge {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500;
          letter-spacing: 0.04em; padding: 2px 8px; border-radius: 99px;
        }
        .clips-count { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.22); }

        /* Empty */
        .empty { text-align: center; padding: 60px 20px; }
        .empty-icon {
          width: 56px; height: 56px; border-radius: 16px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .empty-title {
          font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700;
          color: rgba(255,255,255,0.6); margin-bottom: 8px;
        }
        .empty-sub {
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.25); font-weight: 300; line-height: 1.6;
        }

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
        .nav-lbl { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 0.04em; }
        .nav-upload-btn {
          background: linear-gradient(135deg, #2d7a42, #1d5a30); border: none; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 11px 22px; border-radius: 16px; margin-top: -22px;
          box-shadow: 0 4px 20px rgba(45,122,66,0.4);
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,0.85); letter-spacing: 0.06em; text-transform: uppercase;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .nav-upload-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(45,122,66,0.5); }

        @keyframes rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-anim { animation: rise 0.3s ease both; }
      `}</style>

      <div className="bg-texture" />
      <div className="bg-glow" />

      <div className="rel">
        <nav className="nav">
          <button className="nav-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Home
          </button>
          <span className="nav-title">Find a Course</span>
          <span className="nav-count">{results.length} courses</span>
        </nav>

        <div className="page">
          <div className="search-header">
            <div className={`search-box ${focused ? "focused" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Course name, city, or state..."
              />
              {query && (
                <button className="clear-btn" onClick={() => setQuery("")}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="filter-wrap">
              {STATES.map(s => (
                <button key={s} className={`filter-pill ${selectedState === s ? "active" : ""}`} onClick={() => setSelectedState(s)}>
                  {s === "All" ? "All States" : s}
                </button>
              ))}
            </div>
          </div>

          {results.length > 0 ? (
            <>
              <p className="results-label">
                {query ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"` : "All Courses"}
              </p>
              {results.map((course, i) => {
                const ts = TAG_COLORS[course.tag] || { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.1)" };
                return (
                  <button key={course.id} className="course-card card-anim" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => router.push(`/courses/${course.id}`)}>

                    {/* Club logo */}
                    <div
                      className="club-logo"
                      style={{ background: `linear-gradient(145deg, ${course.color}, ${course.color}dd)`, border: `1px solid ${course.accent}44` }}
                    >
                      <div className="club-logo-shimmer" />
                      <div className="club-logo-inner" style={{ color: course.accent }}>
                        {course.abbr}
                      </div>
                    </div>

                    <div className="course-info">
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        <span>{course.city}, {course.state}</span>
                        <span className="meta-dot" />
                        <span>Par {course.par}</span>
                        <span className="meta-dot" />
                        <span>{course.holes} holes</span>
                        {!course.public && (
                          <>
                            <span className="meta-dot" />
                            <span style={{ color: "rgba(180,145,60,0.7)" }}>Private</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="course-right">
                      <span className="tag-badge" style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                        {course.tag}
                      </span>
                      <span className="clips-count">{course.uploads} clips</span>
                    </div>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p className="empty-title">No courses found</p>
              <p className="empty-sub">Try a different name, city, or state.<br/>Can't find your course? Add it to Tour It.</p>
            </div>
          )}
        </div>

        <nav className="bottom-nav">
          {[
            { label: "Home",   icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", active: false },
            { label: "Search", icon: "M21 21l-4.35-4.35M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z", active: true },
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
export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
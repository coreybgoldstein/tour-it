"use client";
import { Suspense } from "react";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import UserAvatarButton from "@/components/UserAvatarButton";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
  isPublic: boolean;
  uploadCount: number;
  tag?: string;
};

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
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [results, setResults] = useState<Course[]>([]);
  const [focused, setFocused] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, uploadCount")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setAllCourses(data);
        }
        setLoadingCourses(false);
      });
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // KEY FIX: allCourses added to dependency array so filter runs after DB loads
  useEffect(() => {
    let filtered = allCourses;
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
  }, [query, selectedState, allCourses]);

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

        .loading-text {
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.25); text-align: center; padding: 40px 0;
        }

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
        .clips-count { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.22); }

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
          <button className="nav-back" onClick={() => router.push("/")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Home
          </button>
          <span className="nav-title">Find a Course</span>
          <UserAvatarButton />
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

          {loadingCourses ? (
            <p className="loading-text">Loading courses...</p>
          ) : results.length > 0 ? (
            <>
              <p className="results-label">
                {query ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"` : "All Courses"}
              </p>
              {results.map((course, i) => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <button key={course.id} className="course-card card-anim" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => router.push(`/courses/${course.id}`)}>
                    <div className="club-logo" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <div className="club-logo-shimmer" />
                      <div className="club-logo-inner" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {abbr}
                      </div>
                    </div>
                    <div className="course-info">
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        <span>{course.city}, {course.state}</span>
                        <span className="meta-dot" />
                        <span>{course.holeCount || 18} holes</span>
                        {!course.isPublic && (
                          <>
                            <span className="meta-dot" />
                            <span style={{ color: "rgba(180,145,60,0.7)" }}>Private</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="course-right">
                      <span className="clips-count">{course.uploadCount || 0} clips</span>
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

                <BottomNav />
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

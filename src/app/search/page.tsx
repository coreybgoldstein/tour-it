"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
  isPublic: boolean;
  uploadCount: number;
};

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<Course[]>([]);
  const [popular, setPopular] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  // Load popular courses once on mount (courses with most clips)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, uploadCount")
      .gt("uploadCount", 0)
      .order("uploadCount", { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data) setPopular(data); });
  }, []);

  // Autofocus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Search-as-you-type — debounced Supabase query
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, holeCount, isPublic, uploadCount")
        .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
        .order("uploadCount", { ascending: false })
        .limit(30);

      setResults(data || []);
      setLoading(false);
    }, 280);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  const showResults = query.trim().length >= 2;
  const displayList = showResults ? results : [];

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }

        .search-wrap { max-width: 600px; margin: 0 auto; padding: 0 20px 120px; }

        .search-box {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 15px 18px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-box.focused {
          border-color: rgba(77,168,98,0.5);
          box-shadow: 0 0 0 4px rgba(77,168,98,0.07);
        }
        .search-input {
          background: none; border: none; outline: none; width: 100%;
          font-family: 'Outfit', sans-serif; font-size: 16px; color: #fff;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.22); }
        .clear-btn {
          background: rgba(255,255,255,0.08); border: none; cursor: pointer;
          color: rgba(255,255,255,0.5); border-radius: 99px;
          width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .section-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.25); margin-bottom: 10px; margin-top: 24px;
        }

        .course-row {
          display: flex; align-items: center; gap: 14px;
          padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          cursor: pointer; transition: opacity 0.15s;
        }
        .course-row:last-child { border-bottom: none; }
        .course-row:active { opacity: 0.7; }

        .course-badge {
          width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
          background: rgba(77,168,98,0.1); border: 1px solid rgba(77,168,98,0.2);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700;
          color: rgba(77,168,98,0.7);
        }
        .course-badge.has-clips {
          background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.35);
          color: #4da862;
        }

        .course-name {
          font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500;
          color: rgba(255,255,255,0.9);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .course-meta {
          font-family: 'Outfit', sans-serif; font-size: 11px;
          color: rgba(255,255,255,0.3); margin-top: 2px;
        }
        .clip-count { color: #4da862; margin-left: 8px; }

        .empty-hint {
          text-align: center; padding: 48px 20px 0;
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.2); line-height: 1.6;
        }
        .spinner {
          display: flex; justify-content: center; padding: 32px 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="search-wrap">
        {/* Header */}
        <div style={{ padding: "56px 0 20px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
            Find a Course
          </div>
          <div className={`search-box ${focused ? "focused" : ""}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              autoComplete="off"
            />
            {query && (
              <button className="clear-btn" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="spinner">
            <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
        )}

        {!loading && showResults && displayList.length === 0 && (
          <div className="empty-hint">
            No courses found for &ldquo;{query}&rdquo;<br/>
            <span style={{ fontSize: 12 }}>Try a different spelling or city name</span>
          </div>
        )}

        {!loading && showResults && displayList.length > 0 && (
          <>
            <p className="section-label">{displayList.length} result{displayList.length !== 1 ? "s" : ""}</p>
            {displayList.map(course => {
              const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
              return (
                <div key={course.id} className="course-row" onClick={() => router.push(`/courses/${course.id}`)}>
                  <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`}>{abbr}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="course-name">{course.name}</div>
                    <div className="course-meta">
                      {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                      {course.uploadCount > 0 && <span className="clip-count">{course.uploadCount} clips</span>}
                    </div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              );
            })}
          </>
        )}

        {/* Default: popular courses (before typing) */}
        {!showResults && popular.length > 0 && (
          <>
            <p className="section-label">Popular on Tour It</p>
            {popular.map(course => {
              const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
              return (
                <div key={course.id} className="course-row" onClick={() => router.push(`/courses/${course.id}`)}>
                  <div className="course-badge has-clips">{abbr}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="course-name">{course.name}</div>
                    <div className="course-meta">
                      {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                      <span className="clip-count">{course.uploadCount} clips</span>
                    </div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              );
            })}
          </>
        )}

        {!showResults && popular.length === 0 && (
          <div className="empty-hint">
            Search from 11,000+ courses across the US<br/>
            <span style={{ fontSize: 12 }}>Type at least 2 characters to search</span>
          </div>
        )}
      </div>

      <BottomNav />
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

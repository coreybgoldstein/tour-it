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
  logoUrl: string | null;
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
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newHoles, setNewHoles] = useState("18");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // AI search tab
  const [searchTab, setSearchTab] = useState<"courses" | "people" | "ai">("courses");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<Course[]>([]);
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDistances, setAiDistances] = useState<Record<string, number>>({});
  const [aiSearchLogId, setAiSearchLogId] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const [aiExamples] = useState(() => {
    const pool = [
      "Best golf trip destinations in the Midwest",
      "Links style courses in the Southeast",
      "Courses within 10 miles of JFK airport",
      "Public courses in Scottsdale AZ",
      "Bucket list courses in Florida",
      "Best courses for a guys golf trip",
      "Top rated courses in the Carolinas",
      "Courses near Pebble Beach CA",
      "Hidden gem courses in the Northeast",
      "Best public courses in Texas",
    ];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  });

  // People tab
  async function runAiSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAiLoading(true); setAiError(""); setAiResults([]); setAiExplanation(""); setAiDistances({}); setAiSearchLogId(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUserId) headers["x-user-id"] = currentUserId;
      const res = await fetch("/api/ai-search", { method: "POST", headers, body: JSON.stringify({ query: trimmed }) });
      const json = await res.json();
      if (!res.ok || json.error) { setAiError(json.error || "Something went wrong"); }
      else {
        setAiResults(json.courses || []);
        setAiExplanation(json.explanation || "");
        setAiSearchLogId(json.searchLogId || null);
        const dists: Record<string, number> = {};
        (json.courses || []).forEach((c: any) => { if (c.distanceMiles != null) dists[c.id] = c.distanceMiles; });
        setAiDistances(dists);
      }
    } catch (e: any) { setAiError(e.message || "Network error"); }
    setAiLoading(false);
  }

  function trackAiClick(courseId: string, courseName: string, position: number) {
    if (!aiSearchLogId) return;
    fetch("/api/ai-search/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchLogId: aiSearchLogId, courseId, courseName, position, userId: currentUserId }),
    }).catch(() => {});
  }

  type Person = { id: string; username: string; displayName: string; avatarUrl: string | null; uploadCount: number };
  const [peopleResults, setPeopleResults] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const peopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load popular courses once on mount (courses with most clips)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, uploadCount, logoUrl")
      .gt("uploadCount", 0)
      .order("uploadCount", { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data) setPopular(data); });
  }, []);

  // Autofocus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load current user + who they already follow
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from("Follow").select("followingId").eq("followerId", user.id).eq("status", "ACTIVE");
      setFollowingIds(new Set((data || []).map((r: any) => r.followingId)));
    });
  }, []);

  // People search
  useEffect(() => {
    if (searchTab !== "people") return;
    if (peopleDebounceRef.current) clearTimeout(peopleDebounceRef.current);
    if (!query.trim()) { setPeopleResults([]); return; }
    setPeopleLoading(true);
    peopleDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, uploadCount")
        .or(`username.ilike.%${query.replace(/^@/, "")}%,displayName.ilike.%${query}%`)
        .limit(20);
      setPeopleResults((data || []).filter((u: Person) => u.id !== currentUserId));
      setPeopleLoading(false);
    }, 280);
  }, [query, searchTab, currentUserId]);

  // Search-as-you-type — debounced Supabase query
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, holeCount, isPublic, uploadCount, logoUrl")
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

  async function toggleFollow(targetId: string) {
    if (!currentUserId || followingInProgress.has(targetId)) return;
    setFollowingInProgress(prev => new Set(prev).add(targetId));
    const supabase = createClient();
    const isFollowing = followingIds.has(targetId);
    if (isFollowing) {
      await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", targetId);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    } else {
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: targetId, createdAt: new Date().toISOString() });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
    setFollowingInProgress(prev => { const s = new Set(prev); s.delete(targetId); return s; });
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newCity.trim() || !newState.trim()) {
      setCreateError("Name, city, and state are required."); return;
    }
    setCreating(true); setCreateError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreateError("You must be logged in."); setCreating(false); return; }
    const slug = `${newName}-${newCity}-${newState}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("Course").insert({
      id: crypto.randomUUID(),
      name: newName.trim(), city: newCity.trim(), state: newState.trim().toUpperCase(),
      country: "US", holeCount: parseInt(newHoles) || 18, isPublic: newPublic,
      slug, uploadCount: 0, saveCount: 0, viewCount: 0,
      createdAt: now, updatedAt: now,
    }).select("id").single();
    setCreating(false);
    if (error) { setCreateError(error.message); return; }
    router.push(`/courses/${data.id}`);
  };

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
          width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0;
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
        <div style={{ padding: "56px 0 16px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
            Search
          </div>
          {/* Unified search bar */}
          <div className={`search-box ${focused ? "focused" : ""}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); if (aiResults.length > 0 || aiExplanation) { setAiResults([]); setAiExplanation(""); setAiError(""); } }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === "Enter" && searchTab === "courses") runAiSearch(query); }}
              placeholder={searchTab === "courses" ? "Search courses or ask anything…" : "Name or @username"}
              autoComplete="off"
            />
            {/* ✦ AI trigger — only on courses tab */}
            {searchTab === "courses" && query.trim() && !aiLoading && (
              <button
                onClick={() => runAiSearch(query)}
                title="Search with AI"
                style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: aiResults.length > 0 ? "rgba(77,168,98,0.2)" : "rgba(77,168,98,0.1)", border: `1px solid ${aiResults.length > 0 ? "rgba(77,168,98,0.5)" : "rgba(77,168,98,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4da862", fontSize: 14, fontWeight: 700, transition: "all 0.15s" }}
              >✦</button>
            )}
            {searchTab === "courses" && aiLoading && (
              <div style={{ flexShrink: 0, display: "flex", gap: 3, alignItems: "center", paddingRight: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#4da862", animation: `ai-pulse 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
              </div>
            )}
            <style>{`@keyframes ai-pulse { 0%,100%{opacity:0.2;transform:scale(0.75)} 50%{opacity:1;transform:scale(1)} }`}</style>
            {query && !aiLoading && (
              <button className="clear-btn" onClick={() => { setQuery(""); setAiResults([]); setAiExplanation(""); setAiError(""); inputRef.current?.focus(); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Tab toggle: Courses + People only */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {(["courses", "people"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setSearchTab(tab); setQuery(""); setAiResults([]); setAiExplanation(""); setAiError(""); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{ padding: "7px 18px", borderRadius: 99, border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", background: searchTab === tab ? "#2d7a42" : "rgba(255,255,255,0.07)", color: searchTab === tab ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.15s" }}
              >
                {tab === "courses" ? "Courses" : "People"}
              </button>
            ))}
          </div>

          {/* AI prompt examples — shown when Courses tab, no query yet */}
          {searchTab === "courses" && !query && !aiLoading && aiResults.length === 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.6)", marginBottom: 10 }}>✦ Ask anything</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {aiExamples.map(example => (
                  <button
                    key={example}
                    onClick={() => { setQuery(example); runAiSearch(example); }}
                    style={{ width: "100%", textAlign: "left", background: "rgba(77,168,98,0.04)", border: "1px solid rgba(77,168,98,0.12)", borderRadius: 11, padding: "10px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}
                  >
                    <span style={{ color: "#4da862", fontSize: 11, flexShrink: 0 }}>✦</span>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── AI results (inside Courses tab) ── */}
        {searchTab === "courses" && (aiLoading || aiExplanation || aiError) && (
          <>
            {!aiLoading && aiError && (
              <div style={{ margin: "24px 0", padding: "14px 16px", background: "rgba(220,60,60,0.08)", border: "1px solid rgba(220,60,60,0.2)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(240,120,120,0.9)" }}>
                {aiError}
              </div>
            )}
            {!aiLoading && aiExplanation && (
              <div style={{ margin: "18px 0 4px", padding: "11px 13px", background: "rgba(77,168,98,0.07)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 9 }}>
                <span style={{ color: "#4da862", fontSize: 13, flexShrink: 0, marginTop: 1 }}>✦</span>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, flex: 1 }}>{aiExplanation}</div>
                <button onClick={() => { setAiResults([]); setAiExplanation(""); setAiError(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            )}
            {!aiLoading && aiResults.length > 0 && (
              <>
                <p className="section-label">{aiResults.length} AI result{aiResults.length !== 1 ? "s" : ""}</p>
                {aiResults.map((course, idx) => {
                  const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                  const dist = aiDistances[course.id];
                  return (
                    <div key={course.id} className="course-row" onClick={() => { trackAiClick(course.id, course.name, idx); router.push(`/courses/${course.id}`); }}>
                      <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                        {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} /> : abbr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="course-name">{course.name}</div>
                        <div className="course-meta">
                          {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                          {dist != null && <span style={{ color: "rgba(77,168,98,0.8)", marginLeft: 8 }}>{dist} mi away</span>}
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
            {!aiLoading && !aiError && aiExplanation && aiResults.length === 0 && (
              <div className="empty-hint">No courses matched.<br/><span style={{ fontSize: 12 }}>Try rephrasing or a broader region</span></div>
            )}
          </>
        )}

        {/* ── People tab ── */}
        {searchTab === "people" && (
          <>
            {peopleLoading && (
              <div className="spinner">
                <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
            )}

            {!peopleLoading && query.trim() && peopleResults.length === 0 && (
              <div className="empty-hint">No golfers found for &ldquo;{query}&rdquo;</div>
            )}

            {!peopleLoading && !query.trim() && (
              <div className="empty-hint">Search by name or @username</div>
            )}

            {!peopleLoading && peopleResults.map(person => (
              <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div
                  onClick={() => router.push(`/profile/${person.id}`)}
                  style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {person.avatarUrl
                    ? <img src={person.avatarUrl} alt={person.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#4da862" }}>{(person.displayName || person.username)[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => router.push(`/profile/${person.id}`)}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.displayName}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{person.username}{person.uploadCount > 0 ? ` · ${person.uploadCount} clips` : ""}</div>
                </div>
                {currentUserId && (
                  <button
                    onClick={() => toggleFollow(person.id)}
                    disabled={followingInProgress.has(person.id)}
                    style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 99, border: followingIds.has(person.id) ? "1px solid rgba(255,255,255,0.15)" : "none", background: followingIds.has(person.id) ? "transparent" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: followingIds.has(person.id) ? "rgba(255,255,255,0.5)" : "#fff", cursor: "pointer", opacity: followingInProgress.has(person.id) ? 0.5 : 1 }}
                  >
                    {followingIds.has(person.id) ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Courses tab (regular results — hidden while AI results showing or loading) ── */}
        {searchTab === "courses" && aiResults.length === 0 && !aiExplanation && !aiLoading && <>

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
                  <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                    {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} /> : abbr}
                  </div>
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
                  <div className="course-badge has-clips" style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                    {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10 }} /> : abbr}
                  </div>
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

        {/* Add course prompt — always visible once user has typed something */}
        {showResults && !loading && (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Don&apos;t see your course?</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Add it so others can scout it</div>
            </div>
            <button
              onClick={() => { setNewName(query); setAddOpen(true); }}
              style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 10, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Add Course
            </button>
          </div>
        )}

        {/* close courses tab wrapper */}
        </>}
      </div>

      {/* Create course bottom sheet */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#0d2318", border: "1px solid rgba(77,168,98,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 48px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Add a Course</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>Help the community scout it</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Course Name", value: newName, set: setNewName, placeholder: "e.g. Pebble Beach Golf Links" },
                { label: "City", value: newCity, set: setNewCity, placeholder: "e.g. Pebble Beach" },
                { label: "State", value: newState, set: setNewState, placeholder: "e.g. CA" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Holes</label>
                  <select value={newHoles} onChange={e => setNewHoles(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}>
                    {["9","18","27","36"].map(n => <option key={n} value={n} style={{ background: "#0d2318" }}>{n} holes</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Access</label>
                  <button onClick={() => setNewPublic(p => !p)}
                    style={{ width: "100%", background: newPublic ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${newPublic ? "rgba(77,168,98,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: newPublic ? "#4da862" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                    {newPublic ? "Public" : "Private"}
                  </button>
                </div>
              </div>

              {createError && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#ef4444" }}>{createError}</div>}

              <button onClick={handleCreate} disabled={creating}
                style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                {creating ? "Creating…" : "Add Course"}
              </button>
            </div>
          </div>
        </>
      )}

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

"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEMO_VIDEO_ID = "5aadf7941cd346f7270361b4c44b7f47";

const MOCK_LEADERS = [
  { rank: 1, name: "TourPro_Mike",    pts: "8,420", color: "#fbbf24", tier: "Legend"     },
  { rank: 2, name: "HampshireAce",    pts: "6,185", color: "#f97316", tier: "Tour Pro"   },
  { rank: 3, name: "LinksBandit",     pts: "5,240", color: "#f97316", tier: "Tour Pro"   },
  { rank: 4, name: "CourseDoc_NY",    pts: "3,890", color: "#a78bfa", tier: "Course Pro" },
  { rank: 5, name: "WestchesterWolf", pts: "2,715", color: "#a78bfa", tier: "Course Pro" },
  { rank: 6, name: "SilentEagle",     pts: "1,840", color: "#60a5fa", tier: "Marshal"    },
];

export default function OnboardingIntroPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [logos, setLogos] = useState<string[]>([]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user));
    createClient()
      .from("Course").select("logoUrl").not("logoUrl", "is", null)
      .order("uploadCount", { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setLogos(data.map((c: any) => c.logoUrl)); });
  }, []);

  const nextDestination = isLoggedIn === false ? "/signup" : "/onboarding/profile";

  function goTo(idx: number) {
    scrollRef.current?.children[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  function handleScroll() {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    setActiveIdx(idx);
  }

  function handleNext() {
    if (activeIdx < 3) goTo(activeIdx + 1);
    else router.push(nextDestination);
  }

  const isLast = activeIdx === 3;

  // ── Staggered logo tile positions for slide 1 ──
  const tileLayout = [
    { top: "6%",  left: "4%",  size: 60, rot: -8  },
    { top: "4%",  left: "30%", size: 52, rot: 5   },
    { top: "5%",  left: "58%", size: 64, rot: -3  },
    { top: "3%",  left: "82%", size: 50, rot: 9   },
    { top: "22%", left: "-2%", size: 56, rot: 6   },
    { top: "24%", left: "24%", size: 62, rot: -7  },
    { top: "20%", left: "52%", size: 54, rot: 4   },
    { top: "22%", left: "78%", size: 60, rot: -5  },
    { top: "58%", left: "2%",  size: 58, rot: 7   },
    { top: "55%", left: "28%", size: 52, rot: -6  },
    { top: "60%", left: "55%", size: 64, rot: 3   },
    { top: "56%", left: "80%", size: 56, rot: -9  },
    { top: "76%", left: "5%",  size: 52, rot: -4  },
    { top: "78%", left: "32%", size: 60, rot: 8   },
    { top: "74%", left: "60%", size: 54, rot: -6  },
    { top: "77%", left: "84%", size: 62, rot: 5   },
  ];

  return (
    <main style={{ height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .intro-scroll { display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; flex: 1; }
        .intro-scroll::-webkit-scrollbar { display: none; }
        .intro-slide { flex-shrink: 0; width: 100%; scroll-snap-align: start; position: relative; overflow: hidden; }
        @keyframes pulse-soft { 0%,100%{opacity:.11} 50%{opacity:.17} }
      `}</style>

      {/* Skip */}
      <div style={{ position: "absolute", top: 0, right: 0, padding: "max(52px, calc(env(safe-area-inset-top) + 16px)) 20px 0", zIndex: 20 }}>
        <button onClick={() => router.push("/onboarding/profile")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "6px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", cursor: "pointer", backdropFilter: "blur(8px)" }}>
          Skip
        </button>
      </div>

      {/* Slides */}
      <div ref={scrollRef} className="intro-scroll" onScroll={handleScroll}>

        {/* ── SLIDE 1: Scout Before You Play ── */}
        <div className="intro-slide">
          {/* Course logo tile wallpaper */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {tileLayout.map((t, i) => (
              logos[i] ? (
                <div key={i} style={{ position: "absolute", top: t.top, left: t.left, width: t.size, height: t.size, borderRadius: 14, overflow: "hidden", transform: `rotate(${t.rot}deg)`, opacity: 0, animation: `pulse-soft ${3 + (i % 4) * 0.7}s ease-in-out ${i * 0.18}s infinite` }}>
                  <img src={logos[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div key={i} style={{ position: "absolute", top: t.top, left: t.left, width: t.size, height: t.size, borderRadius: 14, background: "rgba(77,168,98,0.08)", transform: `rotate(${t.rot}deg)`, opacity: 0.12 }} />
              )
            ))}
          </div>
          {/* Vignette overlay */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(7,16,10,0.35) 0%, rgba(7,16,10,0.82) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.7) 0%, transparent 25%, transparent 70%, rgba(7,16,10,0.8) 100%)" }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "60%", marginBottom: 32, filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18, textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>
              Scout Before<br />You Play
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: 300, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              Browse hole-by-hole clips from golfers who've already played the course. See the layout, hazards, and landing zones before you tee it up.
            </div>
          </div>
        </div>

        {/* ── SLIDE 2: Real Clips, Real Intel ── */}
        <div className="intro-slide" style={{ background: "#000" }}>
          {/* Looping Cloudflare video */}
          <iframe
            src={`https://iframe.videodelivery.net/${DEMO_VIDEO_ID}?autoplay=true&muted=true&loop=true&controls=false&preload=true&poster=`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", objectFit: "cover" }}
            allow="autoplay; fullscreen"
            title="clip preview"
          />
          {/* Dark overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.6) 100%)" }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(96,165,250,0.15)", border: "1.5px solid rgba(96,165,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, backdropFilter: "blur(12px)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18, textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}>
              Real Clips,<br />Real Intel
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 300, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
              Every clip is tagged with club, shot type, wind conditions, and strategy notes. No more guessing on the first tee.
            </div>
          </div>
        </div>

        {/* ── SLIDE 3: Earn Points & Rank Up ── */}
        <div className="intro-slide">
          {/* Leaderboard background */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", filter: "blur(1.5px)", opacity: 0.22, pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: 340, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "rgba(251,191,36,0.1)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbbf24" }}>Monthly Leaderboard</div>
              {MOCK_LEADERS.map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < MOCK_LEADERS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ width: 24, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: i === 0 ? "#fbbf24" : i === 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>#{u.rank}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{u.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: u.color }}>{u.tier}</div>
                  </div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#4da862" }}>{u.pts} pts</div>
                </div>
              ))}
            </div>
          </div>
          {/* Overlay */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(7,16,10,0.5) 0%, rgba(7,16,10,0.88) 100%)" }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(251,191,36,0.12)", border: "1.5px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>
              Earn Points,<br />Rank Up
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: 300 }}>
              Upload clips, tag intel, build scorecards — every contribution earns points. Compete on monthly leaderboards and climb from Caddie to Legend.
            </div>
          </div>
        </div>

        {/* ── SLIDE 4: Share Your Game ── */}
        <div className="intro-slide">
          {/* Upload screen mockup */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 28px", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: 320, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", opacity: 0.28, filter: "blur(1px)" }}>
              {/* Fake video thumbnail */}
              <div style={{ height: 140, background: "linear-gradient(135deg, #1a4a22 0%, #0c1e11 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
                <div style={{ position: "absolute", bottom: 8, left: 12, fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Hampshire CC • Hole 7</div>
              </div>
              {/* Fake form fields */}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[{ label: "COURSE", val: "Hampshire Country Club" }, { label: "HOLE", val: "Hole 7 — Par 4" }, { label: "CLUB", val: "7-Iron" }, { label: "SHOT TYPE", val: "Approach" }].map(f => (
                  <div key={f.label}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{f.label}</div>
                    <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 10px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{f.val}</div>
                  </div>
                ))}
                <div style={{ background: "#2d7a42", borderRadius: 10, padding: "10px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", textAlign: "center", marginTop: 4 }}>Upload Clip</div>
              </div>
            </div>
          </div>
          {/* Overlay */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(7,16,10,0.45) 0%, rgba(7,16,10,0.88) 100%)" }} />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(167,139,250,0.12)", border: "1.5px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>
              Share Your<br />Game
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: 300 }}>
              Been there? Share what you know. Every clip you upload makes the course better for the next golfer — and earns you points.
            </div>
          </div>
        </div>

      </div>

      {/* Dots + CTA — fixed at bottom */}
      <div style={{ padding: "20px 24px", paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 20px))", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, background: "linear-gradient(to bottom, transparent, rgba(7,16,10,0.95) 40%)", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2, 3].map(i => (
            <button key={i} onClick={() => goTo(i)} style={{ width: i === activeIdx ? 22 : 7, height: 7, borderRadius: 99, background: i === activeIdx ? "#4da862" : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", padding: 0, transition: "width 0.25s ease, background 0.25s ease" }} />
          ))}
        </div>
        <button
          onClick={handleNext}
          style={{ width: "100%", maxWidth: 380, padding: "16px", borderRadius: 16, background: isLast ? "#2d7a42" : "rgba(255,255,255,0.1)", border: isLast ? "none" : "1px solid rgba(255,255,255,0.15)", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: isLast ? "0 4px 20px rgba(45,122,66,0.4)" : "none", backdropFilter: isLast ? "none" : "blur(12px)", transition: "all 0.3s ease", letterSpacing: "0.02em" }}
        >
          {isLast ? "Get Started →" : "Next →"}
        </button>
      </div>
    </main>
  );
}

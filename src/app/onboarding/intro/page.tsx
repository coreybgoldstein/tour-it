"use client";

/**
 * Onboarding — educational slides.
 *
 * Rewritten 2026-05-25 per the launch-day direction:
 *   - Vital info (first name, last name, username, email, password)
 *     is collected ONCE at /signup.
 *   - This route shows 3 educational slides that tell the user what
 *     they can DO in Tour It — no data collection.
 *   - Last slide drops them on the home feed. Profile-completion
 *     prompts (avatar, handicap, home course) fire later, when the
 *     user first visits their profile.
 *   - Gamification (points / leaderboards) is hidden until the user
 *     takes a real action and earns their first points.
 *
 * Three slides, in order:
 *   1. Scout — find new courses, prepare for your next round or trip
 *   2. Upload + Intel — share where you've played, what worked
 *   3. Tee Up — plan rounds, set up games, build trips with friends
 */

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEMO_VIDEO_ID = "2f960f5d4c3d7993addb954de8386c41"; // Boca Grove tee shot — used for slide 2 backdrop

export default function OnboardingIntroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Round-trip `next=` through onboarding so post-signup deep links
  // still land where intended.
  const nextParam = searchParams.get("next") || "/";
  const safeNext = nextParam.startsWith("/") ? nextParam : "/";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [logos, setLogos] = useState<string[]>([]);

  // Pull a handful of seeded course logos for the slide 1 wallpaper.
  // Not blocking — slide renders fine with the green-tile fallback.
  useEffect(() => {
    createClient()
      .from("Course").select("logoUrl").not("logoUrl", "is", null)
      .order("uploadCount", { ascending: false }).limit(16)
      .then(({ data }) => { if (data) setLogos(data.map((c: { logoUrl: string }) => c.logoUrl)); });
  }, []);

  function goTo(idx: number) {
    scrollRef.current?.children[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  function handleScroll() {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    setActiveIdx(idx);
  }

  function handleDone() {
    // Mark intro as seen so the home page knows to fire the
    // "explore your home course" follow-up prompt on first paint.
    try {
      localStorage.setItem("tour-it-intro-seen", "1");
      // Also mark the legacy "onboarded" flag so the home page's
      // logged-out-only "Create an account" welcome modal doesn't
      // flash for users who just finished signup + the intro. The
      // beta tester (Leslie) saw the modal AFTER signing up because
      // this flag was never set on the intro-done path.
      localStorage.setItem("tour-it-onboarded", "1");
    } catch {}
    router.replace(safeNext);
  }

  function handleNext() {
    if (activeIdx < 2) goTo(activeIdx + 1);
    else handleDone();
  }

  const isLast = activeIdx === 2;

  // Staggered logo-tile positions for slide 1's wallpaper. Three
  // rows × four-ish columns with slight rotations and pulse delays.
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
        @keyframes pulse-soft { 0%,100%{opacity:.3} 50%{opacity:.48} }
      `}</style>

      {/* Skip — small and out of the way; bypasses the rest of the slides */}
      <div style={{ position: "absolute", top: 0, right: 0, padding: "max(52px, calc(env(safe-area-inset-top) + 16px)) 20px 0", zIndex: 20 }}>
        <button onClick={handleDone} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "6px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", cursor: "pointer", backdropFilter: "blur(8px)" }}>
          Skip
        </button>
      </div>

      <div ref={scrollRef} className="intro-scroll" onScroll={handleScroll}>

        {/* ── SLIDE 1: Find courses, prep for your next round / trip ── */}
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
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(7,16,10,0.2) 0%, rgba(7,16,10,0.68) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.55) 0%, transparent 25%, transparent 65%, rgba(7,16,10,0.65) 100%)" }} />

          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 48, width: "auto", maxWidth: "60%", marginBottom: 32, filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18, textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>
              Scout any course<br />before you play
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, maxWidth: 320, textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
              Find new courses, see hole-by-hole clips from people who&apos;ve been there, and prep for your next round or golf trip.
            </div>
          </div>
        </div>

        {/* ── SLIDE 2: Upload, share where you've played, drop intel ── */}
        <div className="intro-slide" style={{ background: "#000" }}>
          <video
            src={`https://videodelivery.net/${DEMO_VIDEO_ID}/manifest/video.m3u8`}
            autoPlay
            muted
            loop
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.7) 100%)" }} />

          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1.5px solid rgba(77,168,98,0.35)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, backdropFilter: "blur(12px)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18, textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}>
              Upload your<br />swings and intel
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.78)", lineHeight: 1.7, maxWidth: 320, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
              Show the community where you&apos;ve played. Drop a clip, tag the hole, the club, the wind — the stuff you&apos;d want to know before stepping up.
            </div>
          </div>
        </div>

        {/* ── SLIDE 3: Tee Up — plan rounds, set up games, build trips ── */}
        <div className="intro-slide">
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(140deg, #0a2614 0%, #07100a 60%, #0d2318 100%)" }} />

          {/* Decorative card stack — sits behind the text, centered behind
              the headline so the slide reads as one composed unit instead
              of "stuff at the top, words at the bottom" with empty middle. */}
          <div style={{ position: "absolute", top: "14%", left: "50%", transform: "translateX(-50%)", width: "92%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, opacity: 0.55, pointerEvents: "none" }}>
            {/* Round */}
            <div style={{ background: "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 16, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, transform: "rotate(-1.5deg)", boxShadow: "0 6px 24px rgba(0,0,0,0.28)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21h16M12 15V2"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)" }}>Round · Saturday</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 900, color: "#fff" }}>Bethpage Black</div>
              </div>
            </div>
            {/* Game */}
            <div style={{ background: "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 16, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, transform: "rotate(1deg)", boxShadow: "0 6px 24px rgba(0,0,0,0.28)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="13" height="16" rx="2" /><line x1="6.5" y1="8" x2="12.5" y2="8" /><line x1="6.5" y1="11.5" x2="12.5" y2="11.5" /><line x1="6.5" y1="15" x2="10" y2="15" /><path d="M15.5 17.5 L19 14 L21 16 L17.5 19.5 L14.8 20.2 Z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)" }}>Game · Nassau · $5/$5/$5</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 900, color: "#fff" }}>Saturday Match</div>
              </div>
            </div>
            {/* Trip */}
            <div style={{ background: "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 16, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, transform: "rotate(-0.5deg)", boxShadow: "0 6px 24px rgba(0,0,0,0.28)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)" }}>Trip · Aug 20–23</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 900, color: "#fff" }}>Pinehurst Invitational</div>
              </div>
            </div>
          </div>

          {/* Vignette that fades the cards into the headline cleanly. */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0.05) 30%, rgba(7,16,10,0.92) 55%)" }} />

          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", paddingTop: "32%", textAlign: "center" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 14 }}>
              Tee Up
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>
              Plan rounds,<br />start games,<br />book trips
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, maxWidth: 320 }}>
              Tee it up with your crew. Schedule a round, run a Nassau or Skins, plan a multi-day trip — Tour It tracks the stakes, the strokes, and the stories.
            </div>
          </div>
        </div>

      </div>

      {/* Dots + CTA — fixed at bottom */}
      <div style={{ padding: "20px 24px", paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 20px))", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, background: "linear-gradient(to bottom, transparent, rgba(7,16,10,0.95) 40%)", position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2].map(i => (
            <button key={i} onClick={() => goTo(i)} style={{ width: i === activeIdx ? 22 : 7, height: 7, borderRadius: 99, background: i === activeIdx ? "#4da862" : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", padding: 0, transition: "width 0.25s ease, background 0.25s ease" }} />
          ))}
        </div>
        <button
          onClick={handleNext}
          style={{ width: "100%", maxWidth: 380, padding: "16px", borderRadius: 16, background: isLast ? "#2d7a42" : "rgba(255,255,255,0.1)", border: isLast ? "none" : "1px solid rgba(255,255,255,0.15)", fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: isLast ? "0 4px 20px rgba(45,122,66,0.4)" : "none", backdropFilter: isLast ? "none" : "blur(12px)", transition: "all 0.3s ease", letterSpacing: "0.02em" }}
        >
          {isLast ? "Get Started" : "Next"}
        </button>
      </div>
    </main>
  );
}

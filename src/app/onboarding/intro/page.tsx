"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SLIDES = [
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="20"/>
        <path d="M12 2 L19 6 L12 10 Z" fill="#4da862" stroke="none"/>
        <ellipse cx="12" cy="21.5" rx="4" ry="1.2" stroke="#4da862" fill="none"/>
      </svg>
    ),
    title: "Scout Before You Play",
    body: "Browse hole-by-hole clips from golfers who've already played the course. See the layout, landing zones, and hazards before you tee it up.",
    accent: "#4da862",
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    title: "Real Clips, Real Intel",
    body: "Every clip is tagged with club, shot type, wind conditions, and strategy notes. No more guessing on the first tee.",
    accent: "#60a5fa",
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    title: "Earn Points & Rank Up",
    body: "Upload clips, get likes, gain followers — earn points and climb from Caddie all the way to Legend. Your rank lives on your profile.",
    accent: "#fbbf24",
  },
  {
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 16 12 12 8 16"/>
        <line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
      </svg>
    ),
    title: "Share Your Game",
    body: "Been there? Share what you know. Every clip you upload makes the course better for the next golfer.",
    accent: "#a78bfa",
  },
];

export default function OnboardingIntroPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
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
    if (activeIdx < SLIDES.length - 1) {
      goTo(activeIdx + 1);
    } else {
      router.push(nextDestination);
    }
  }

  return (
    <main style={{ height: "100svh", background: "#07100a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .intro-scroll { display: flex; overflow-x: scroll; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .intro-scroll::-webkit-scrollbar { display: none; }
        .intro-slide { flex-shrink: 0; width: 100%; scroll-snap-align: start; }
      `}</style>

      {/* Skip */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "52px 24px 0" }}>
        <button
          onClick={() => router.push("/onboarding/profile")}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", padding: 4 }}
        >
          Skip
        </button>
      </div>

      {/* Slides */}
      <div ref={scrollRef} className="intro-scroll" onScroll={handleScroll} style={{ flex: 1 }}>
        {SLIDES.map((slide, i) => (
          <div key={i} className="intro-slide" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", textAlign: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: `${slide.accent}14`, border: `1.5px solid ${slide.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
              {slide.icon}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
              {slide.title}
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 320 }}>
              {slide.body}
            </div>
          </div>
        ))}
      </div>

      {/* Dots + Next button */}
      <div style={{ padding: "0 24px 52px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{ width: i === activeIdx ? 20 : 8, height: 8, borderRadius: 99, background: i === activeIdx ? "#4da862" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", padding: 0, transition: "width 0.25s ease, background 0.25s ease" }}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          style={{ width: "100%", maxWidth: 360, padding: "15px", borderRadius: 14, background: "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 2px 16px rgba(45,122,66,0.35)" }}
        >
          {activeIdx < SLIDES.length - 1 ? "Next →" : "Get Started →"}
        </button>
      </div>
    </main>
  );
}

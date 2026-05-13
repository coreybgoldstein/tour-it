"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Routes where the bar is hidden — clip-heavy / feed pages, auth, and pages
// that already render their own header (map, notifications, course detail).
const HIDDEN_EXACT = new Set<string>([
  "/",
  "/upload",
  "/map",
  "/notifications",
  "/login",
  "/signup",
]);
const HIDDEN_PREFIXES = ["/courses/", "/onboarding", "/admin"];

export default function TourItTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const hidden =
    !pathname ||
    HIDDEN_EXACT.has(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  // Used to show/hide the Log Out button in the drawer
  useEffect(() => {
    if (hidden) return;
    createClient().auth.getUser().then(({ data: { user } }) => setSignedIn(!!user));
  }, [hidden]);

  if (hidden) return null;

  return (
    <>
      {/* Top bar — sticky so it stays anchored as the page scrolls */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "linear-gradient(180deg, #1c4425 0%, #102916 100%)",
          borderBottom: "1px solid rgba(77,168,98,0.35)",
          flexShrink: 0,
          zIndex: 90,
        }}
      >
        {/* Dot pattern overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(77,168,98,0.07) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            pointerEvents: "none",
          }}
        />
        {/* 3-col row: hamburger | logo | bell */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 44px",
            alignItems: "center",
            paddingTop: "max(10px, env(safe-area-inset-top))",
            paddingBottom: 10,
            paddingLeft: 16,
            paddingRight: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
            <span style={{ width: 16, height: 1.5, background: "rgba(255,255,255,0.85)", borderRadius: 99, display: "block" }} />
          </button>

          <div style={{ display: "flex", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tour-it-logo-full.png"
              alt="Tour It"
              style={{ height: 56, width: "auto", cursor: "pointer" }}
              onClick={() => router.push("/")}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => router.push("/leaderboards")}
              aria-label="Leaderboards"
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: "50%",
                // Match the hamburger's translucent fill so the TopBar's green
                // shows through identically; only the ring color differentiates them
                background: "rgba(255,255,255,0.06)",
                border: "1.5px solid #d4a017",
                boxShadow: "0 0 0 1px rgba(212,160,23,0.25), 0 0 8px rgba(212,160,23,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {/* Masters-style leaderboard — keeps leaderboards one tap away even though it's not in the bottom nav */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="4" cy="3" r="1"/>
                <circle cx="20" cy="3" r="1"/>
                <path d="M4 4 Q12 8 20 4"/>
                <path d="M4 4 L4 17 L20 17 L20 4"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
                <line x1="6" y1="13.5" x2="18" y2="13.5"/>
                <line x1="12" y1="17" x2="12" y2="20"/>
                <line x1="10" y1="20" x2="14" y2="20"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999 }}>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "min(78vw, 340px)",
              background: "#0a1d12",
              borderRight: "1px solid rgba(77,168,98,0.18)",
              display: "flex",
              flexDirection: "column",
              paddingTop: "max(20px, env(safe-area-inset-top))",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
          >
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                position: "absolute",
                top: 18,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div style={{ padding: "12px 24px 18px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 36, width: "auto" }} />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 4 }}>
              {[
                {
                  label: "About Tour It",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/about"); },
                },
                {
                  label: "Leaderboard",
                  icon: (
                    // Masters-style leaderboard — matches the top-right Leaderboards button
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="4" cy="3" r="1"/>
                      <circle cx="20" cy="3" r="1"/>
                      <path d="M4 4 Q12 8 20 4"/>
                      <path d="M4 4 L4 17 L20 17 L20 4"/>
                      <line x1="6" y1="10" x2="18" y2="10"/>
                      <line x1="6" y1="13.5" x2="18" y2="13.5"/>
                      <line x1="12" y1="17" x2="12" y2="20"/>
                      <line x1="10" y1="20" x2="14" y2="20"/>
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/leaderboards"); },
                },
                {
                  label: "Tee Up",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="9" r="6"/>
                      <circle cx="10" cy="7.2" r="0.6" fill="currentColor" stroke="none"/>
                      <circle cx="14" cy="8.4" r="0.6" fill="currentColor" stroke="none"/>
                      <circle cx="11" cy="10.8" r="0.6" fill="currentColor" stroke="none"/>
                      <circle cx="14.4" cy="11.2" r="0.6" fill="currentColor" stroke="none"/>
                      <line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/>
                      <path d="M10.5 15.5 L12 21 L13.5 15.5"/>
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/tee-up"); },
                },
                {
                  label: "Notifications",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/notifications"); },
                },
                {
                  label: "App Feedback",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/feedback"); },
                },
                {
                  label: "Privacy Policy",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/privacy"); },
                },
                {
                  label: "Terms of Service",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/terms"); },
                },
                {
                  label: "Contact Us",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); window.location.href = "mailto:corey@touritgolf.com"; },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 24px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.82)",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 15,
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: "#4da862", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {signedIn && (
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                aria-label="Log out"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 24px",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer",
                  color: "rgba(255,100,100,0.8)",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 15,
                  fontWeight: 500,
                  textAlign: "left",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            )}
          </div>
        </div>
      )}

    </>
  );
}

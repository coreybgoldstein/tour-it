"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsDesktop } from "@/hooks/useIsDesktop";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("User").select("avatarUrl").eq("id", user.id).single();
      if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
    });
  }, []);

  // Hide nav when software keyboard is open (visual viewport shrinks) — mobile only
  useEffect(() => {
    if (isDesktop) return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const threshold = window.innerHeight * 0.75;
    const handler = () => setKeyboardOpen(vv.height < threshold);
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [isDesktop]);

  const isHome = pathname === "/";
  const isSearch = pathname === "/search";
  const isLists = pathname === "/lists";
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  if (!isDesktop && keyboardOpen) return null;

  const navItems = [
    {
      label: "Home",
      active: isHome,
      onClick: () => router.push("/"),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
      ),
    },
    {
      label: "Search",
      active: isSearch,
      onClick: () => {
        if (isSearch) {
          (document.querySelector('input.search-input') as HTMLInputElement | null)?.focus();
        } else {
          // Focus a ghost input synchronously inside the gesture so iOS opens the keyboard.
          // The search page's useEffect then transfers focus to the real input.
          const ghost = document.createElement("input");
          ghost.setAttribute("type", "text");
          Object.assign(ghost.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", fontSize: "16px" });
          document.body.appendChild(ghost);
          ghost.focus();
          router.push("/search");
          setTimeout(() => ghost.remove(), 1000);
        }
      },
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      ),
    },
    {
      label: "Upload",
      active: false,
      onClick: () => router.push("/upload"),
      isUpload: true,
      icon: (_active: boolean) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8 7 12 2 16 7"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
          <path d="M5 15v5h14v-5"/>
        </svg>
      ),
    },
    {
      label: "Lists",
      active: isLists,
      onClick: () => router.push("/lists"),
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      label: "Profile",
      active: isProfile,
      onClick: () => router.push("/profile"),
      isProfile: true,
      icon: (active: boolean) => (
        <div style={{ width: isDesktop ? 28 : 24, height: isDesktop ? 28 : 24, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${active ? "#4da862" : "rgba(255,255,255,0.4)"}`, background: "rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          }
        </div>
      ),
    },
  ];

  // ── Desktop left sidebar ──────────────────────────────────────
  if (isDesktop) {
    return (
      <nav style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 72, zIndex: 110,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 4,
        background: "rgba(4,12,6,0.98)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRight: "1px solid rgba(77,168,98,0.25)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "12px 0", width: "100%",
                borderRadius: 10,
              }}
            >
              {item.isUpload ? (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(45,122,66,0.5)" }}>
                  {item.icon(false)}
                </div>
              ) : (
                item.icon(item.active)
              )}
            </button>
          ))}
        </div>
      </nav>
    );
  }

  // ── Mobile bottom nav ─────────────────────────────────────────
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      padding: "10px 8px 18px",
      background: "rgba(4,12,6,0.98)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(77,168,98,0.25)",
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)",
      willChange: "transform",
    }}>
      {navItems.map(item => (
        <button
          key={item.label}
          onClick={item.onClick}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
            ...(item.isUpload ? { marginTop: "-18px" } : {}),
          }}
        >
          {item.isUpload ? (
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(45,122,66,0.5)" }}>
              {item.icon(false)}
            </div>
          ) : (
            item.icon(item.active)
          )}
          <span style={{ fontSize: "9px", color: item.active ? "#4da862" : "rgba(255,255,255,0.8)", fontFamily: "'Outfit', sans-serif", ...(item.isUpload ? { letterSpacing: "0.04em" } : {}) }}>
            {item.label.toUpperCase() === "UPLOAD" ? "UPLOAD" : item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

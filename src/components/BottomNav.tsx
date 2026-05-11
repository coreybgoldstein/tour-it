"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsDesktop } from "@/hooks/useIsDesktop";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("User").select("avatarUrl").eq("id", user.id).single();
      if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
      const { count } = await supabase
        .from("Notification")
        .select("id", { count: "exact", head: true })
        .eq("userId", user.id)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    });
  }, [pathname]);

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
  const isTeeUp = pathname === "/tee-up" || pathname.startsWith("/tee-up/");
  const isLeaderboards = pathname === "/leaderboards" || pathname.startsWith("/leaderboards/");
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  if (!isDesktop && keyboardOpen) return null;

  const navItems = [
    {
      label: "Home",
      active: isHome,
      onClick: () => {
        if (isHome) {
          document.querySelector<HTMLElement>(".feed")?.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push("/");
        }
      },
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
      ),
    },
    {
      label: "Tee Up",
      active: isTeeUp,
      onClick: () => router.push("/tee-up"),
      icon: (active: boolean) => (
        // Golf flag in a hole — represents future play
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21h16"/>
          <path d="M7 21c0-3.5 2.5-6 5-6s5 2.5 5 6"/>
          <line x1="12" y1="15" x2="12" y2="2"/>
          <path d="M12 2 L19 5 L12 8 Z" fill={active ? "#4da862" : "rgba(255,255,255,0.85)"} stroke="none"/>
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
      label: "Leaderboards",
      active: isLeaderboards,
      onClick: () => router.push("/leaderboards"),
      icon: (active: boolean) => (
        // Trophy
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.85)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        </svg>
      ),
    },
    {
      label: "Profile",
      active: isProfile,
      onClick: () => router.push("/profile"),
      isProfile: true,
      icon: (active: boolean) => (
        <div style={{ position: "relative", width: isDesktop ? 28 : 24, height: isDesktop ? 28 : 24 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", border: `1.8px solid ${active ? "#4da862" : "rgba(255,255,255,0.85)"}`, background: "rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? "#4da862" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
          </div>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, background: "#e8353a", border: "1.5px solid rgba(4,12,6,1)", boxShadow: "0 1px 3px rgba(232,53,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: "-0.2px" }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
            </div>
          )}
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

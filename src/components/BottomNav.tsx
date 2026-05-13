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
  const isSearch = pathname === "/search";
  const isTeeUp = pathname === "/tee-up" || pathname.startsWith("/tee-up/");
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
      label: "Search",
      active: isSearch,
      onClick: () => {
        if (isSearch) {
          (document.querySelector('input.search-input') as HTMLInputElement | null)?.focus();
        } else {
          // Ghost-input trick so iOS opens the keyboard inside the tap gesture
          const ghost = document.createElement("input");
          ghost.setAttribute("type", "text");
          ghost.setAttribute("aria-hidden", "true");
          ghost.setAttribute("tabindex", "-1");
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
      label: "Tee Up",
      active: isTeeUp,
      onClick: () => router.push("/tee-up"),
      icon: (active: boolean) => {
        const c = active ? "#4da862" : "rgba(255,255,255,0.85)";
        return (
          // Golf ball on a tee — ball gets a few scattered dimples so it reads
          // unmistakably as a golf ball at small sizes
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="9" r="6"/>
            <circle cx="10" cy="7.2" r="0.6" fill={c} stroke="none"/>
            <circle cx="14" cy="8.4" r="0.6" fill={c} stroke="none"/>
            <circle cx="11" cy="10.8" r="0.6" fill={c} stroke="none"/>
            <circle cx="14.4" cy="11.2" r="0.6" fill={c} stroke="none"/>
            <line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/>
            <path d="M10.5 15.5 L12 21 L13.5 15.5"/>
          </svg>
        );
      },
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
      display: "flex", alignItems: "center",
      // Bottom padding includes the iOS home-indicator safe area so the
      // tab bar doesn't sit on top of the swipe-up bar in Capacitor.
      padding: "10px 4px calc(18px + env(safe-area-inset-bottom))",
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
            // Each button claims equal share of the nav width so icons + labels
            // align on a fixed grid regardless of label length ("Leaderboards"
            // is much longer than "Home" so without flex: 1 they'd drift).
            flex: 1,
            minWidth: 0,
            padding: 0,
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
            // Fixed-size icon slot so every item's icon visually lines up on the same row
            <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.icon(item.active)}
            </div>
          )}
          <span style={{
            fontSize: "9px",
            color: item.active ? "#4da862" : "rgba(255,255,255,0.8)",
            fontFamily: "'Outfit', sans-serif",
            // Truncate long labels (e.g. "Leaderboards") so they never overflow
            // the per-button slot and push the icon column off-center.
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
            ...(item.isUpload ? { letterSpacing: "0.04em" } : {}),
          }}>
            {item.label.toUpperCase() === "UPLOAD" ? "UPLOAD" : item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

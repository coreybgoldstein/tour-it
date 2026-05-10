"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [authedUser, setAuthedUser] = useState<{ id: string } | null>(null);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  // Load notifications when the drawer opens; mark unread as read on close.
  const loadNotifs = useCallback(async () => {
    if (!authedUser) return;
    setNotifsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("Notification")
      .select("id, type, title, body, linkUrl, read, createdAt")
      .eq("userId", authedUser.id)
      .order("createdAt", { ascending: false })
      .limit(50);
    setNotifs((data ?? []) as NotifRow[]);
    setNotifsLoading(false);
  }, [authedUser]);

  useEffect(() => {
    if (notifOpen && authedUser) {
      loadNotifs();
    }
  }, [notifOpen, authedUser, loadNotifs]);

  // When the drawer closes, mark currently-unread as read and zero the badge.
  useEffect(() => {
    if (notifOpen || !authedUser) return;
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const supabase = createClient();
    supabase
      .from("Notification")
      .update({ read: true, updatedAt: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => {
        setNotifs(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read: true } : n));
        setUnread(0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  const hidden =
    !pathname ||
    HIDDEN_EXACT.has(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setAuthedUser({ id: user.id });
      supabase
        .from("Notification")
        .select("id", { count: "exact", head: true })
        .eq("userId", user.id)
        .eq("read", false)
        .then(({ count }) => setUnread(count ?? 0));
    });
  }, [hidden, pathname]);

  if (hidden) return null;

  return (
    <>
      {/* Top bar */}
      <div
        style={{
          position: "relative",
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
            paddingBottom: 8,
            paddingLeft: 14,
            paddingRight: 14,
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
              style={{ height: 38, width: "auto", cursor: "pointer" }}
              onClick={() => router.push("/")}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unread > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#e8353a",
                    border: "1.5px solid #07100a",
                    boxShadow: "0 1px 5px rgba(232,53,58,0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                  }}
                >
                  <span style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-0.2px" }}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                </div>
              )}
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="18" y="3" width="4" height="18" />
                      <rect x="10" y="8" width="4" height="13" />
                      <rect x="2" y="13" width="4" height="8" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/leaderboards"); },
                },
                {
                  label: "My Trips",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                    </svg>
                  ),
                  onClick: () => { setMenuOpen(false); router.push("/trips"); },
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

            {authedUser && (
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

      {/* Notifications drawer (slides from right) */}
      {notifOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999 }}>
          <div
            onClick={() => setNotifOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: "min(86vw, 380px)",
              background: "#0a1d12",
              borderLeft: "1px solid rgba(77,168,98,0.18)",
              display: "flex",
              flexDirection: "column",
              paddingTop: "max(16px, env(safe-area-inset-top))",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
          >
            <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>Notifications</div>
              <button
                onClick={() => setNotifOpen(false)}
                aria-label="Close notifications"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {notifsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "tourit-spin 0.8s linear infinite" }} />
                  <style>{`@keyframes tourit-spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: "60px 28px", textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>All caught up</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.32)", lineHeight: 1.5 }}>Likes, comments, follows, and clip tags will show up here.</div>
                </div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.linkUrl) return;
                      setNotifOpen(false);
                      if (n.linkUrl.startsWith("/")) router.push(n.linkUrl);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 18px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: n.read ? "transparent" : "rgba(77,168,98,0.06)",
                      cursor: n.linkUrl ? "pointer" : "default",
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "transparent" : "#4da862", marginTop: 6, flexShrink: 0, boxShadow: n.read ? "none" : "0 0 6px rgba(77,168,98,0.6)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.35 }}>{n.title}</div>
                      {n.body && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.45, marginTop: 3 }}>{n.body}</div>
                      )}
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5, letterSpacing: "0.04em" }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifs.length > 0 && (
              <div style={{ padding: "10px 20px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={() => { setNotifOpen(false); router.push("/notifications"); }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "rgba(77,168,98,0.1)",
                    border: "1px solid rgba(77,168,98,0.3)",
                    borderRadius: 10,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4da862",
                    cursor: "pointer",
                  }}
                >
                  Open full notifications →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

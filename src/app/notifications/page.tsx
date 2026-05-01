"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { formatTimeAgo } from "@/lib/formatTimeAgo";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  referenceId: string | null;
  read: boolean;
  createdAt: string;
  tagStatus?: "pending" | "approved" | "denied"; // resolved client-side for clip_tag
}

function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, { bg: string; svg: React.ReactNode }> = {
    clip_tag: {
      bg: "rgba(77,168,98,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    },
    trip_invite: {
      bg: "rgba(100,160,255,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64a0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.9 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.81 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    },
    comment: {
      bg: "rgba(255,200,80,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    mention: {
      bg: "rgba(255,200,80,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc850" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>,
    },
    follow: {
      bg: "rgba(180,120,255,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b478ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
    },
    like: {
      bg: "rgba(255,90,90,0.15)",
      svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff5a5a" stroke="#ff5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    },
  };
  const { bg, svg } = icons[type] ?? {
    bg: "rgba(255,255,255,0.08)",
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  };
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {svg}
    </div>
  );
}


export default function NotificationsPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null); // notif id being acted on

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("Notification")
        .select("id, type, title, body, linkUrl, referenceId, read, createdAt")
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(50);

      const notifs = data ?? [];

      // For clip_tag notifications, look up current approval status
      const tagNotifs = notifs.filter(n => n.type === "clip_tag" && n.referenceId);
      let tagStatusMap: Record<string, "pending" | "approved" | "denied"> = {};
      if (tagNotifs.length > 0) {
        const uploadIds = tagNotifs.map(n => n.referenceId!);
        const { data: tagRows } = await supabase
          .from("UploadTag")
          .select("uploadId, approved")
          .eq("userId", user.id)
          .in("uploadId", uploadIds);
        (tagRows || []).forEach((r: any) => {
          tagStatusMap[r.uploadId] = r.approved === true ? "approved" : r.approved === false ? "denied" : "pending";
        });
      }

      setNotifications(notifs.map(n => ({
        ...n,
        tagStatus: n.type === "clip_tag" && n.referenceId ? (tagStatusMap[n.referenceId] ?? "pending") : undefined,
      })));
      setLoading(false);

      // Mark all as read
      const unreadIds = notifs.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from("Notification").update({ read: true, updatedAt: new Date().toISOString() }).in("id", unreadIds);
      }
    });
  }, [router]);

  async function handleTagAction(notifId: string, uploadId: string, approve: boolean) {
    if (!userId || acting) return;
    setActing(notifId);
    const supabase = createClient();
    const { count } = await supabase.from("UploadTag").update({ approved: approve }, { count: "exact" }).eq("userId", userId).eq("uploadId", uploadId);
    if ((count ?? 0) === 0) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, tagStatus: "denied" } : n));
    } else {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, tagStatus: approve ? "approved" : "denied" } : n));
    }
    setActing(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 100, paddingLeft: isDesktop ? 72 : 0, maxWidth: isDesktop ? 680 : undefined }}>
      {/* Header */}
      <div style={{ padding: "52px 20px 16px", borderBottom: "1px solid rgba(77,168,98,0.15)" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
          Notifications
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, paddingBottom: 32, paddingLeft: 32, paddingRight: 32, gap: 16, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>All caught up</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.6 }}>Likes, comments, follows, and clip tags will show up here.</p>
          </div>
        </div>
      ) : (
        <div>
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{ background: n.read ? "transparent" : "rgba(77,168,98,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 20px" }}
            >
              <div
                onClick={() => { if (n.type !== "clip_tag" && n.linkUrl) { const url = n.linkUrl; if (url.startsWith("/")) router.push(url); } }}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: n.type !== "clip_tag" && n.linkUrl ? "pointer" : "default" }}
              >
                {/* Type icon */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <NotifIcon type={n.type} />
                  {!n.read && <div style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#4da862", border: "1.5px solid #07100a" }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>{n.title}</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{formatTimeAgo(n.createdAt)}</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.4 }}>
                    {n.body}
                  </p>

                  {/* Approve / Deny for pending clip tags */}
                  {n.type === "clip_tag" && n.referenceId && (
                    <div style={{ marginTop: 10 }}>
                      {n.tagStatus === "pending" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleTagAction(n.id, n.referenceId!, true)}
                            disabled={acting === n.id}
                            style={{ flex: 1, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "#4da862", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}
                          >
                            {acting === n.id ? "..." : "Add to my profile"}
                          </button>
                          <button
                            onClick={() => handleTagAction(n.id, n.referenceId!, false)}
                            disabled={acting === n.id}
                            style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", cursor: "pointer", opacity: acting === n.id ? 0.5 : 1 }}
                          >
                            Decline
                          </button>
                        </div>
                      ) : n.tagStatus === "approved" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862" }}>Added to your profile</span>
                          <button onClick={() => { if (n.linkUrl?.startsWith("/")) router.push(n.linkUrl); }} style={{ marginLeft: "auto", background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer", textDecoration: "underline" }}>View clip</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Declined</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <BottomNav />
    </div>
  );
}

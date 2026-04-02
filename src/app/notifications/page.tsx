"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("Notification")
        .select("id, type, title, body, linkUrl, read, createdAt")
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(50);

      setNotifications(data ?? []);
      setLoading(false);

      // Mark all as read
      const unreadIds = (data ?? []).filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("Notification")
          .update({ read: true, updatedAt: new Date().toISOString() })
          .in("id", unreadIds);
      }
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#07100a", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "52px 20px 16px",
        borderBottom: "1px solid rgba(77,168,98,0.15)",
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 700,
          color: "#fff",
          margin: 0,
        }}>
          Notifications
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2px solid rgba(77,168,98,0.3)",
            borderTopColor: "#4da862",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            No notifications yet
          </p>
        </div>
      ) : (
        <div>
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => n.linkUrl && router.push(n.linkUrl)}
              style={{
                width: "100%",
                background: n.read ? "transparent" : "rgba(77,168,98,0.06)",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                cursor: n.linkUrl ? "pointer" : "default",
                textAlign: "left",
              }}
            >
              {/* Icon dot */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: n.read ? "rgba(255,255,255,0.15)" : "#4da862",
                marginTop: 6,
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#fff",
                  }}>
                    {n.title}
                  </span>
                  <span style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    flexShrink: 0,
                  }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                <p style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.55)",
                  margin: "4px 0 0",
                  lineHeight: 1.4,
                }}>
                  {n.body}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

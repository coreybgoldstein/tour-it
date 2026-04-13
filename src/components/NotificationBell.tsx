"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Hide on these routes
  const hidden =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname === "/upload" ||
    pathname === "/notifications" || // already on notifications page
    pathname.startsWith("/admin") ||
    pathname.startsWith("/courses/"); // clips are inside course pages

  const fetchUnread = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { count } = await supabase
      .from("Notification")
      .select("id", { count: "exact", head: true })
      .eq("userId", uid)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchUnread(user.id);
    });
  }, [fetchUnread]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => fetchUnread(userId), 30000);
    return () => clearInterval(interval);
  }, [userId, fetchUnread]);

  if (hidden || !userId) return null;

  return (
    <button
      onClick={() => router.push("/notifications")}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 90,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Notifications"
    >
      <div style={{ position: "relative" }}>
        {/* Bell icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "#4da862",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

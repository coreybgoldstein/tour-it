"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// Returns the current user's unread Notification count, polled every
// 30s. Shared between NotificationBell, the home-page hamburger badge,
// the global TourItTopBar hamburger badge, and the BottomNav profile
// pip — so the "you have unread notifications" affordance is always
// in agreement.
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchUnread = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { count: c } = await supabase
      .from("Notification")
      .select("id", { count: "exact", head: true })
      .eq("userId", uid)
      .eq("read", false);
    setCount(c ?? 0);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchUnread(user.id);
    });
  }, [fetchUnread]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => fetchUnread(userId), 30000);
    return () => clearInterval(interval);
  }, [userId, fetchUnread]);

  return count;
}

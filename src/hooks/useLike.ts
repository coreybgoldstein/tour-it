"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UseLikeOptions = {
  uploadId: string;
  initialLikeCount: number;
};

type UseLikeReturn = {
  liked: boolean;
  likeCount: number;
  toggleLike: () => Promise<void>;
  loading: boolean;
};

// Source-of-truth like hook. All mutation goes through /api/likes/toggle which
// upserts the Like row, then recomputes Upload.likeCount from COUNT(Like) on
// the server. Client never does read-modify-write on the counter — that was
// the root cause of stale counts. UI updates optimistically and reverts on
// error so a network failure can never strand the user in a "liked but not
// saved" state.
export function useLike({ uploadId, initialLikeCount }: UseLikeOptions): UseLikeReturn {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Hydrate the user's current like status on mount. maybeSingle() returns
  // null on no row instead of throwing — single() was logging an error every
  // time someone viewed an unliked clip.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from("Like")
          .select("id")
          .eq("userId", user.id)
          .eq("uploadId", uploadId)
          .maybeSingle();
        if (!cancelled) setLiked(!!data);
      }
      if (!cancelled) setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [uploadId]);

  const toggleLike = useCallback(async () => {
    if (loading) return;
    if (!userId) {
      router.push("/login");
      return;
    }

    const wasLiked = liked;
    const previousCount = likeCount;

    // Optimistic update — flip immediately so the heart animates without
    // waiting on the network. We'll revert if the server call fails.
    setLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    setLoading(true);

    try {
      const res = await fetch("/api/likes/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, action: wasLiked ? "unlike" : "like" }),
      });
      if (!res.ok) throw new Error(`toggle failed: ${res.status}`);
      const data: { liked: boolean; likeCount: number } = await res.json();
      // Sync to the server's authoritative values. If two users liked nearly
      // simultaneously the count may be different from our optimistic +1.
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch (err) {
      // Revert optimistic update so UI matches the server
      setLiked(wasLiked);
      setLikeCount(previousCount);
      console.error("Like toggle failed:", err);
    } finally {
      setLoading(false);
    }
  }, [liked, likeCount, loading, uploadId, userId, router]);

  return {
    liked,
    likeCount,
    toggleLike,
    loading: loading || !initialized,
  };
}

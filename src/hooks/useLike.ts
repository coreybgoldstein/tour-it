"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Module-level cache of (userId, uploadId) -> liked. Hydrated as the user
// browses; subsequent views of any clip set liked=true immediately on
// render so the heart never flickers from unfilled to filled. First view
// of new content still does the Supabase round-trip (cache miss).
const likedCache = new Map<string, Map<string, boolean>>();
function cacheGet(userId: string | null, uploadId: string): boolean | undefined {
  if (!userId) return undefined;
  return likedCache.get(userId)?.get(uploadId);
}
function cacheSet(userId: string | null, uploadId: string, liked: boolean) {
  if (!userId) return;
  if (!likedCache.has(userId)) likedCache.set(userId, new Map());
  likedCache.get(userId)!.set(uploadId, liked);
}

// Parents (feed pages) call this once after fetching the visible clip list
// AND running a single batched SELECT for the current user's likes. Pre-
// seeds the cache so even the first useLike mount has the right state and
// the heart never animates from unfilled → filled on a freshly-loaded clip.
//   const { data } = await supabase.from("Like").select("uploadId")
//     .eq("userId", user.id).in("uploadId", visibleClipIds);
//   seedLikedCache(user.id, data?.map(r => r.uploadId) ?? [], visibleClipIds);
// Pass the FULL visible-clip-id list so unliked clips are also recorded as
// false — otherwise the cache miss path runs and the network round-trip
// stays visible.
export function seedLikedCache(userId: string | null, likedUploadIds: string[], allUploadIds: string[]) {
  if (!userId) return;
  if (!likedCache.has(userId)) likedCache.set(userId, new Map());
  const map = likedCache.get(userId)!;
  const likedSet = new Set(likedUploadIds);
  for (const id of allUploadIds) map.set(id, likedSet.has(id));
}

type UseLikeOptions = {
  uploadId: string;
  initialLikeCount: number;
  // If the parent already knows whether the current user has liked this
  // clip (e.g. it batched a single SELECT for all visible clips), pass it
  // here. The hook will skip its own per-clip auth + Like lookup, which
  // otherwise causes the heart to animate from unfilled → filled on every
  // mount as the round-trip lands. Pass undefined to keep the legacy
  // self-fetch behavior.
  initialLiked?: boolean;
  // Same idea for userId — if the parent already has the auth user, pass
  // it so the hook doesn't make a duplicate auth call.
  currentUserId?: string | null;
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
export function useLike({ uploadId, initialLikeCount, initialLiked, currentUserId }: UseLikeOptions): UseLikeReturn {
  const router = useRouter();
  // Seed with parent-provided initialLiked, otherwise the module cache,
  // otherwise false. Cache hits eliminate the visible heart-fill flicker
  // when the user re-views a clip they've already loved.
  const seededLiked = initialLiked ?? cacheGet(currentUserId ?? null, uploadId) ?? false;
  const [liked, setLiked] = useState(seededLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(currentUserId ?? null);
  // Skip the self-fetch when the parent provided both pieces of state.
  // That's the common case in feed surfaces (home / course / hole) where
  // one batched SELECT covers every visible clip.
  const skipSelfFetch = initialLiked !== undefined && currentUserId !== undefined;
  const [initialized, setInitialized] = useState(skipSelfFetch);

  // Sync local state if the parent updates either prop after first render
  // (it usually doesn't — parents batch on mount — but covers re-fetches).
  useEffect(() => {
    if (initialLiked !== undefined) setLiked(initialLiked);
  }, [initialLiked]);
  useEffect(() => {
    if (currentUserId !== undefined) setUserId(currentUserId);
  }, [currentUserId]);

  // Legacy self-fetch path — only runs when the parent did NOT pass both
  // initialLiked + currentUserId. maybeSingle() returns null on no row
  // instead of throwing.
  useEffect(() => {
    if (skipSelfFetch) return;
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
        if (!cancelled) {
          const isLiked = !!data;
          setLiked(isLiked);
          cacheSet(user.id, uploadId, isLiked);
        }
      }
      if (!cancelled) setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [uploadId, skipSelfFetch]);

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
      cacheSet(userId, uploadId, data.liked);
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

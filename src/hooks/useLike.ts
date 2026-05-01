"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeRankScore } from "@/lib/rankScore";

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

export function useLike({ uploadId, initialLikeCount }: UseLikeOptions): UseLikeReturn {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check if user has liked this upload on mount
  useEffect(() => {
    const supabase = createClient();

    async function checkLikeStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        const { data: existingLike } = await supabase
          .from("Like")
          .select("id")
          .eq("userId", user.id)
          .eq("uploadId", uploadId)
          .single();

        if (existingLike) {
          setLiked(true);
        }
      }
      
      setInitialized(true);
    }

    checkLikeStatus();
  }, [uploadId]);

  const toggleLike = useCallback(async () => {
    if (loading) return;

    // If not logged in, redirect to login
    if (!userId) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch createdAt + commentCount for rankScore recalc
      const { data: uploadMeta } = await supabase
        .from("Upload")
        .select("createdAt, commentCount")
        .eq("id", uploadId)
        .single();

      if (liked) {
        await supabase.from("Like").delete().eq("userId", userId).eq("uploadId", uploadId);
        const newLikeCount = Math.max(0, likeCount - 1);
        const newRank = uploadMeta
          ? computeRankScore(newLikeCount, uploadMeta.commentCount || 0, uploadMeta.createdAt)
          : undefined;
        await supabase.from("Upload").update({
          likeCount: newLikeCount,
          ...(newRank !== undefined && { rankScore: newRank }),
        }).eq("id", uploadId);
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase.from("Like").insert({
          id: crypto.randomUUID(),
          userId,
          uploadId,
          createdAt: new Date().toISOString(),
        });
        const newLikeCount = likeCount + 1;
        const newRank = uploadMeta
          ? computeRankScore(newLikeCount, uploadMeta.commentCount || 0, uploadMeta.createdAt)
          : undefined;
        await supabase.from("Upload").update({
          likeCount: newLikeCount,
          ...(newRank !== undefined && { rankScore: newRank }),
        }).eq("id", uploadId);
        setLiked(true);
        setLikeCount(prev => prev + 1);

        // Notify clip owner (skip if liking own clip)
        const { data: upload } = await supabase.from("Upload").select("userId, courseId, holeNumber").eq("id", uploadId).single();
        if (upload && upload.userId !== userId) {
          const { data: liker } = await supabase.from("User").select("displayName, username").eq("id", userId).single();
          const likerName = liker?.displayName || liker?.username || "Someone";
          const now = new Date().toISOString();
          const linkUrl = upload.holeNumber ? `/courses/${upload.courseId}/holes/${upload.holeNumber}?clip=${uploadId}` : `/courses/${upload.courseId}`;
          await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: upload.userId, type: "like", title: "New like", body: `${likerName} liked your clip`, linkUrl, read: false, createdAt: now, updatedAt: now });
          fetch("/api/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: upload.userId, title: "New like", body: `${likerName} liked your clip`, url: linkUrl }) }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic update would go here if needed
    }

    setLoading(false);
  }, [liked, likeCount, loading, uploadId, userId]);

  return {
    liked,
    likeCount,
    toggleLike,
    loading: loading || !initialized,
  };
}

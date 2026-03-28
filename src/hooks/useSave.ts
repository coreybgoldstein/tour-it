"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type UseSaveOptions = {
  courseId: string;
};

type UseSaveReturn = {
  saved: boolean;
  toggleSave: () => Promise<void>;
  loading: boolean;
};

export function useSave({ courseId }: UseSaveOptions): UseSaveReturn {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check if user has saved this course on mount
  useEffect(() => {
    const supabase = createClient();

    async function checkSaveStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        const { data: existingSave } = await supabase
          .from("Save")
          .select("id")
          .eq("userId", user.id)
          .eq("courseId", courseId)
          .single();

        if (existingSave) {
          setSaved(true);
        }
      }
      
      setInitialized(true);
    }

    checkSaveStatus();
  }, [courseId]);

  const toggleSave = useCallback(async () => {
    if (loading) return;

    // If not logged in, redirect to login
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (saved) {
        // Unsave: delete the save record
        await supabase
          .from("Save")
          .delete()
          .eq("userId", userId)
          .eq("courseId", courseId);

        setSaved(false);
      } else {
        // Save: insert a new save record
        await supabase.from("Save").insert({
          id: crypto.randomUUID(),
          userId: userId,
          courseId: courseId,
          createdAt: new Date().toISOString(),
        });

        setSaved(true);
      }
    } catch (error) {
      console.error("Error toggling save:", error);
    }

    setLoading(false);
  }, [saved, loading, courseId, userId]);

  return {
    saved,
    toggleSave,
    loading: loading || !initialized,
  };
}

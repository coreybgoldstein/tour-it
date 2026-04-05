"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SaveType = "PLAYED" | "BUCKET_LIST";

type UseSaveOptions = {
  courseId: string;
};

type UseSaveReturn = {
  saved: boolean;
  saveType: SaveType | null;
  toggleSave: (type: SaveType) => Promise<void>;
  removeSave: () => Promise<void>;
  loading: boolean;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
};

export function useSave({ courseId }: UseSaveOptions): UseSaveReturn {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [saveType, setSaveType] = useState<SaveType | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Check if user has saved this course on mount
  useEffect(() => {
    const supabase = createClient();

    async function checkSaveStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        const { data: existingSave } = await supabase
          .from("Save")
          .select("id, saveType")
          .eq("userId", user.id)
          .eq("courseId", courseId)
          .single();

        if (existingSave) {
          setSaved(true);
          setSaveType(existingSave.saveType as SaveType);
        }
      }
      
      setInitialized(true);
    }

    checkSaveStatus();
  }, [courseId]);

  const toggleSave = useCallback(async (type: SaveType) => {
    if (loading) return;

    // If not logged in, redirect to login
    if (!userId) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setShowPicker(false);
    const supabase = createClient();

    try {
      if (saved && saveType === type) {
        // Same type clicked — remove the save
        await supabase
          .from("Save")
          .delete()
          .eq("userId", userId)
          .eq("courseId", courseId);

        setSaved(false);
        setSaveType(null);
      } else if (saved) {
        // Different type — update the save
        await supabase
          .from("Save")
          .update({ saveType: type })
          .eq("userId", userId)
          .eq("courseId", courseId);

        setSaveType(type);
      } else {
        // New save
        await supabase.from("Save").insert({
          id: crypto.randomUUID(),
          userId: userId,
          courseId: courseId,
          saveType: type,
          createdAt: new Date().toISOString(),
        });

        setSaved(true);
        setSaveType(type);
      }
    } catch (error) {
      console.error("Error toggling save:", error);
    }

    setLoading(false);
  }, [saved, saveType, loading, courseId, userId]);

  const removeSave = useCallback(async () => {
    if (loading || !userId || !saved) return;

    setLoading(true);
    const supabase = createClient();

    try {
      await supabase
        .from("Save")
        .delete()
        .eq("userId", userId)
        .eq("courseId", courseId);

      setSaved(false);
      setSaveType(null);
    } catch (error) {
      console.error("Error removing save:", error);
    }

    setLoading(false);
  }, [loading, userId, saved, courseId]);

  return {
    saved,
    saveType,
    toggleSave,
    removeSave,
    loading: loading || !initialized,
    showPicker,
    setShowPicker,
  };
}
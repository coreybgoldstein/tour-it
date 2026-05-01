import { createClient } from "@/lib/supabase/server";

/**
 * Awards a badge to a user by badge slug.
 * Idempotent — silently skips if already awarded.
 * Returns true if the badge was newly awarded.
 */
export async function awardBadge(userId: string, badgeSlug: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: badge } = await supabase
    .from("Badge")
    .select("id")
    .eq("slug", badgeSlug)
    .maybeSingle();

  if (!badge) return false;

  const { error } = await supabase.from("UserBadge").insert({
    id: crypto.randomUUID(),
    userId,
    badgeId: badge.id,
    awardedAt: new Date().toISOString(),
  });

  // Unique constraint violation = already has it
  return !error;
}

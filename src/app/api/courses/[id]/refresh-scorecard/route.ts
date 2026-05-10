import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshCourseScorecard } from "@/lib/fetchCourseScorecard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// On-demand fill of a course's scorecard from GolfCourseAPI. Lazy-cached by
// the underlying Hole rows — once filled, future calls are no-ops unless the
// holes are nullified again.
//
// Triggered automatically by:
//   - Trip game-create flow when an incomplete-scorecard course is selected
//   - Course page's "refresh scorecard" admin button (future)
//
// Rate-limited per user (15/min) since it costs a GolfCourseAPI quota call.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (!rateLimit(`refresh-scorecard:${user.id}`, 15, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Slow down — too many scorecard refreshes" }, { status: 429 });
    }
  } else {
    // Anonymous calls allowed but more strictly limited (per-IP harder, fallback to global)
    if (!rateLimit("refresh-scorecard:anon", 30, 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "Server busy" }, { status: 429 });
    }
  }

  // Skip if already 100% filled — saves the API call
  const { data: holes } = await supabase
    .from("Hole")
    .select("yardage")
    .eq("courseId", id);
  const totalHoles = holes?.length ?? 0;
  const filled = (holes ?? []).filter((h) => h.yardage != null).length;
  if (totalHoles > 0 && filled === totalHoles) {
    return NextResponse.json({ ok: true, matched: false, reason: "already complete" });
  }

  const result = await refreshCourseScorecard(id);
  return NextResponse.json(result);
}

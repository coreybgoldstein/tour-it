// Daily sweep that catches under-seeded courses the on-upload trigger
// missed (failed scrape, transient network blip, etc). Limits how many
// courses it touches per run so we're polite to external sites
// (BlueGolf, course's own host).
//
// Schedule: 0 5 * * * (05:00 UTC, one hour after the leaderboard
// resync so they don't pile onto the same minute).
//
// Selection criteria:
//   uploadCount > 0        — only courses with real activity
//   AND (logoUrl IS NULL   — and missing at least one of the two
//        OR coverImageUrl IS NULL)
//
// Sorted by uploadCount DESC so the most-used under-seeded courses
// get attention first.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoSeedCourse } from "@/lib/courseAutoSeed";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Pull a batch of under-seeded active courses. PostgREST .or() handles
  // the "missing at least one image" condition.
  const { data: candidates, error } = await sb
    .from("Course")
    .select("id, name, uploadCount, logoUrl, coverImageUrl")
    .gt("uploadCount", 0)
    .or("logoUrl.is.null,coverImageUrl.is.null")
    .order("uploadCount", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { attempted: 0, logosFilled: 0, coversFilled: 0, perCourse: [] as Array<{ id: string; logo: boolean; cover: boolean }> };
  for (const course of candidates ?? []) {
    const result = await autoSeedCourse(course.id);
    summary.attempted++;
    if (result.logoFilled) summary.logosFilled++;
    if (result.coverFilled) summary.coversFilled++;
    summary.perCourse.push({ id: course.id, logo: result.logoFilled, cover: result.coverFilled });
  }

  return NextResponse.json(summary);
}

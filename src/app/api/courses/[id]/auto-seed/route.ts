// On-upload trigger for the course auto-seed pipeline. The upload page
// calls this fire-and-forget after a clip is created so a brand-new
// course's logo + cover can populate before the user comes back to
// view it. Open to any authenticated user (auto-seed is idempotent and
// only ever fills NULL fields).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autoSeedCourse } from "@/lib/courseAutoSeed";

// Image scraping + storage uploads can run longer than the default 10s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing-course-id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await autoSeedCourse(id);
  return NextResponse.json(result);
}

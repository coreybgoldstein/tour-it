import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseManager } from "@/lib/courseManagerAuth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const supabase = await createClient();
  const { id: courseId, mediaId } = await params;
  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabase
    .from("CourseOfficialMedia")
    .delete()
    .eq("id", mediaId)
    .eq("courseId", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

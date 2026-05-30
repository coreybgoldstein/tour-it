import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseManager } from "@/lib/courseManagerAuth";

// PATCH  /api/courses/[id]/staff/[staffId]  → edit (manager only)
// DELETE /api/courses/[id]/staff/[staffId]  → remove (manager only)

const ALLOWED = new Set(["name", "role", "bio", "photoUrl", "email", "phone", "isPublic", "sortOrder"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; staffId: string }> }) {
  const supabase = await createClient();
  const { id: courseId, staffId } = await params;
  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (!ALLOWED.has(k)) continue;
    const v = body[k];
    if (k === "isPublic") updates[k] = !!v;
    else if (k === "sortOrder") updates[k] = Math.max(0, Math.min(9999, Math.floor(Number(v) || 0)));
    else if (typeof v === "string") {
      const trimmed = v.trim().slice(0, k === "bio" ? 2000 : k === "phone" ? 40 : k === "email" ? 200 : k === "photoUrl" ? 500 : 120);
      updates[k] = trimmed || null;
    } else if (v === null) {
      updates[k] = null;
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  updates.updatedAt = new Date().toISOString();

  const { error } = await supabase
    .from("CourseStaff")
    .update(updates)
    .eq("id", staffId)
    .eq("courseId", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; staffId: string }> }) {
  const supabase = await createClient();
  const { id: courseId, staffId } = await params;
  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabase
    .from("CourseStaff")
    .delete()
    .eq("id", staffId)
    .eq("courseId", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

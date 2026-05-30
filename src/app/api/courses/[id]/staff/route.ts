import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseManager } from "@/lib/courseManagerAuth";

// GET    /api/courses/[id]/staff      → list (public — anyone can read)
// POST   /api/courses/[id]/staff      → create (manager only)

function sanitizeStaff(body: Record<string, unknown>) {
  const str = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) || null : null;
  return {
    name: str(body.name, 120),
    role: str(body.role, 80),
    bio: str(body.bio, 2000),
    photoUrl: str(body.photoUrl, 500),
    email: str(body.email, 200),
    phone: str(body.phone, 40),
    isPublic: typeof body.isPublic === "boolean" ? body.isPublic : true,
    sortOrder: typeof body.sortOrder === "number" ? Math.max(0, Math.min(9999, Math.floor(body.sortOrder))) : 0,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: courseId } = await params;
  if (!courseId) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  const { data, error } = await supabase
    .from("CourseStaff")
    .select("id, name, role, bio, photoUrl, email, phone, isPublic, sortOrder")
    .eq("courseId", courseId)
    .order("sortOrder", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hide non-public staff cards from the public list (still
  // returned to the manager via the manage dashboard which queries
  // directly with the service role/server context).
  return NextResponse.json({ staff: (data ?? []).filter((s: any) => s.isPublic) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: courseId } = await params;
  if (!courseId) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const payload = sanitizeStaff(body);
  if (!payload.name || !payload.role) {
    return NextResponse.json({ error: "Name and role are required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("CourseStaff")
    .insert({ id: crypto.randomUUID(), courseId, ...payload, createdAt: nowIso, updatedAt: nowIso })
    .select("id, name, role, bio, photoUrl, email, phone, isPublic, sortOrder")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}

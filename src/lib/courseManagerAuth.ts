// Authorization helper for the course-operator layer.
//
// A user is authorized to mutate a course's official info, staff, or
// official media if EITHER:
//   - they have an active CourseManager row for that courseId, OR
//   - they're a Tour It admin (User.isAdmin=true) — admins can edit
//     any claimed course's operator layer for support purposes.
//
// Returns { user, isManager, isAdmin } when authorized; throws a
// NextResponse-shaped object the caller can return directly when not.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseManagerAuth = {
  userId: string;
  isManager: boolean;
  isAdmin: boolean;
};

export async function requireCourseManager(
  supabase: SupabaseClient,
  courseId: string
): Promise<CourseManagerAuth | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin OR a CourseManager row for this course.
  const [{ data: profile }, { data: mgr }] = await Promise.all([
    supabase.from("User").select("isAdmin").eq("id", user.id).maybeSingle(),
    supabase.from("CourseManager").select("id").eq("courseId", courseId).eq("userId", user.id).maybeSingle(),
  ]);
  const isAdmin = !!profile?.isAdmin;
  const isManager = !!mgr;

  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Not authorized to manage this course" }, { status: 403 });
  }

  return { userId: user.id, isManager, isAdmin };
}

export async function requireAdmin(supabase: SupabaseClient): Promise<{ userId: string } | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("User").select("isAdmin").eq("id", user.id).maybeSingle();
  if (!profile?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  return { userId: user.id };
}

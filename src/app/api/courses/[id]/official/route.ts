import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCourseManager } from "@/lib/courseManagerAuth";

// PATCH /api/courses/[id]/official
// Manager-only: update the COURSE's operator-layer fields only.
// Distinct from /api/courses/[id]/contribute (UGC field contributions
// to `description`, `coverImageUrl`, etc.). These fields never affect
// CourseContribution points or the UGC search vector.
//
// Allowed: officialDescription, websiteUrl, teeSheetUrl
//
// `websiteUrl` is shared with the UGC contribute pipeline so we
// validate it here the same way (https:// prefix, parseable, max
// 500). Updating it via this route does NOT award points (the
// operator owns the field, not a contributor).
const ALLOWED = new Set(["officialDescription", "websiteUrl", "teeSheetUrl", "membershipInquiryUrl"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: courseId } = await params;
  if (!courseId) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  const auth = await requireCourseManager(supabase, courseId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED.has(key)) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if ("officialDescription" in updates) {
    const v = updates.officialDescription;
    updates.officialDescription = typeof v === "string" ? v.trim().slice(0, 4000) || null : null;
  }
  for (const urlField of ["websiteUrl", "teeSheetUrl", "membershipInquiryUrl"] as const) {
    if (!(urlField in updates)) continue;
    const raw = updates[urlField];
    if (raw == null || raw === "") {
      updates[urlField] = null;
      continue;
    }
    let url = String(raw).trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return NextResponse.json({ error: `${urlField} must be http(s)` }, { status: 400 });
      }
      updates[urlField] = u.toString().slice(0, 500);
    } catch {
      return NextResponse.json({ error: `Invalid ${urlField}` }, { status: 400 });
    }
  }

  const { error } = await supabase.from("Course").update(updates).eq("id", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

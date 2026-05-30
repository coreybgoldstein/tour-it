import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

// POST /api/courses/[id]/claim
// Submits a course-claim request. Body: { claimantName, claimantRole,
// claimantEmail, verificationNote? }. The claim lands as PENDING in
// /admin/claims; verification creates a CourseManager row and flips
// Course.isClaimed.
//
// One PENDING claim per (user, course) at a time — an already-PENDING
// claim from the same user returns 409 so the UI can render the
// "Request submitted" confirmation state instead of double-creating.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: courseId } = await params;
  if (!courseId) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  if (!rateLimit(`course-claim:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many claim attempts — try again later" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const claimantName = String(body.claimantName ?? "").trim().slice(0, 120);
  const claimantRole = String(body.claimantRole ?? "").trim().slice(0, 80);
  const claimantEmail = String(body.claimantEmail ?? "").trim().toLowerCase().slice(0, 200);
  const verificationNote = body.verificationNote
    ? String(body.verificationNote).trim().slice(0, 1000) || null
    : null;

  if (!claimantName || !claimantRole || !claimantEmail) {
    return NextResponse.json({ error: "Name, role, and work email are all required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(claimantEmail)) {
    return NextResponse.json({ error: "Invalid work email" }, { status: 400 });
  }

  // Confirm the course exists + check it isn't already claimed by this
  // user (or stuck PENDING).
  const { data: course } = await supabase
    .from("Course")
    .select("id, isClaimed")
    .eq("id", courseId)
    .single();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("CourseClaim")
    .select("id, status")
    .eq("courseId", courseId)
    .eq("userId", user.id)
    .in("status", ["PENDING", "VERIFIED"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: existing.status === "VERIFIED" ? "You already manage this course" : "You already have a pending request on this course", status: existing.status },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data: insertedRows, error } = await supabase
    .from("CourseClaim")
    .insert({
      id: crypto.randomUUID(),
      courseId,
      userId: user.id,
      status: "PENDING",
      claimantName,
      claimantRole,
      claimantEmail,
      verificationNote,
      requestedAt: nowIso,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, claimId: insertedRows?.id });
}

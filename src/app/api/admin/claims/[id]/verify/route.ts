import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/courseManagerAuth";

// POST /api/admin/claims/[id]/verify
// Admin action: mark a CourseClaim as VERIFIED, create the matching
// CourseManager row, flip Course.isClaimed=true.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth instanceof NextResponse) return auth;

  const { id: claimId } = await params;
  if (!claimId) return NextResponse.json({ error: "Missing claim id" }, { status: 400 });

  const { data: claim } = await supabase
    .from("CourseClaim")
    .select("id, courseId, userId, status, claimantRole")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "PENDING") {
    return NextResponse.json({ error: `Claim is already ${claim.status.toLowerCase()}` }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  // 1) Flip the claim to VERIFIED.
  const { error: updErr } = await supabase
    .from("CourseClaim")
    .update({ status: "VERIFIED", reviewedAt: nowIso, reviewedBy: auth.userId })
    .eq("id", claimId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 2) Upsert a CourseManager row (unique on (courseId, userId)) so
  //    re-verifying the same person on the same course is a no-op.
  const { error: mgrErr } = await supabase
    .from("CourseManager")
    .upsert({
      id: crypto.randomUUID(),
      courseId: claim.courseId,
      userId: claim.userId,
      role: claim.claimantRole,
      createdAt: nowIso,
    }, { onConflict: "courseId,userId" });
  if (mgrErr) return NextResponse.json({ error: mgrErr.message }, { status: 500 });

  // 3) Flip Course.isClaimed=true. Already-claimed courses stay
  //    claimed; this is just an "at least one verified manager
  //    exists" signal.
  await supabase.from("Course").update({ isClaimed: true }).eq("id", claim.courseId);

  // 4) Notify the claimant that their request was approved.
  await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId: claim.userId,
    type: "course_claim_verified",
    title: "Course claim approved",
    body: "You're now a verified manager. Tap to edit your course's official info.",
    linkUrl: `/courses/${claim.courseId}/manage`,
    referenceId: claim.courseId,
    read: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return NextResponse.json({ ok: true });
}

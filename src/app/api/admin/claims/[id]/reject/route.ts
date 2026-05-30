import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/courseManagerAuth";

// POST /api/admin/claims/[id]/reject
// Admin action: mark a CourseClaim as REJECTED. Does NOT touch
// Course.isClaimed (other VERIFIED claims may still exist).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth instanceof NextResponse) return auth;

  const { id: claimId } = await params;
  if (!claimId) return NextResponse.json({ error: "Missing claim id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const reason = body?.reason ? String(body.reason).trim().slice(0, 500) : null;

  const { data: claim } = await supabase
    .from("CourseClaim")
    .select("id, courseId, userId, status")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "PENDING") {
    return NextResponse.json({ error: `Claim is already ${claim.status.toLowerCase()}` }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("CourseClaim")
    .update({
      status: "REJECTED",
      reviewedAt: nowIso,
      reviewedBy: auth.userId,
      verificationNote: reason,
    })
    .eq("id", claimId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the claimant.
  await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId: claim.userId,
    type: "course_claim_rejected",
    title: "Course claim not approved",
    body: reason || "We couldn't verify this request. Reach out to support if you think this is wrong.",
    linkUrl: `/courses/${claim.courseId}`,
    referenceId: claim.courseId,
    read: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return NextResponse.json({ ok: true });
}

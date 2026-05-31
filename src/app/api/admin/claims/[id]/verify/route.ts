import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/courseManagerAuth";

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    .select("id, courseId, userId, status, claimantRole, claimantName, claimantEmail")
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

  // 5) Email the claimant too (best-effort — don't fail the request if email errors).
  if (claim.claimantEmail) {
    const { data: course } = await supabase
      .from("Course")
      .select("name")
      .eq("id", claim.courseId)
      .maybeSingle();
    const courseName = course?.name ?? "your course";
    const firstName = (claim.claimantName ?? "").trim().split(/\s+/)[0] || "there";
    const manageUrl = `https://www.touritgolf.com/courses/${claim.courseId}/manage`;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Tour It <hello@touritgolf.com>",
        to: claim.claimantEmail,
        subject: `You're now managing ${courseName} on Tour It`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="color: #2d7a42;">Your claim was approved</h2>
            <p>Hi ${escapeHtml(firstName)},</p>
            <p>You're now a verified manager of <strong>${escapeHtml(courseName)}</strong> on Tour It. You can edit your official description, upload your logo and cover photo, add staff cards, link a tee sheet, and post media straight into your course's holes.</p>
            <p style="margin: 24px 0;">
              <a href="${manageUrl}" style="background: #2d7a42; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open your manager dashboard</a>
            </p>
            <p style="color: #666; font-size: 13px;">If the button doesn't work, paste this into your browser:<br />${manageUrl}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Claim approval email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

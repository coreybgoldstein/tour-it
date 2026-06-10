import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Hero-tag approval = ownership transfer. The browser flips its OWN
// UploadTag.approved (owner-write RLS) and then calls this route to do
// the cross-user write: reassign Upload.userId to the approver and stamp
// the original uploader on uploadedByUserId for the attribution chip.
// Runs as service_role (owner-only RLS on Upload), and only after
// re-verifying the caller holds an APPROVED hero tag on this upload so
// ownership can't be seized without a real, accepted tag.

type Body = { uploadId: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.uploadId) {
    return NextResponse.json({ error: "uploadId required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: tag } = await admin
    .from("UploadTag")
    .select("id")
    .eq("uploadId", body.uploadId)
    .eq("userId", user.id)
    .eq("isHero", true)
    .eq("approved", true)
    .maybeSingle();
  if (!tag) return NextResponse.json({ error: "no approved hero tag" }, { status: 409 });

  const { data: upload } = await admin
    .from("Upload")
    .select("userId, uploadedByUserId")
    .eq("id", body.uploadId)
    .maybeSingle();
  if (!upload || upload.userId === user.id) {
    return NextResponse.json({ ok: true, applied: false });
  }

  const originalUploader = upload.uploadedByUserId ?? upload.userId;
  await admin
    .from("Upload")
    .update({ userId: user.id, uploadedByUserId: originalUploader, updatedAt: new Date().toISOString() })
    .eq("id", body.uploadId);

  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  // Reward the original uploader for filming for someone else (deduped
  // per uploadId in awardPoints REFERENCE_DEDUPED_ACTIONS).
  fetch(`${origin}/api/points/award`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "clip_uploaded_for_other", recipientUserId: originalUploader, referenceId: body.uploadId }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, applied: true });
}

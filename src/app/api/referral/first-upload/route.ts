import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { awardPoints } from "@/lib/awardPoints";

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId } = await req.json();
  if (!uploadId) return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });

  const sb = serviceDb();

  // Count the user's APPROVED uploads — only trigger on their first one
  const { count: uploadCount } = await sb
    .from("Upload")
    .select("id", { count: "exact", head: true })
    .eq("userId", user.id)
    .eq("moderationStatus", "APPROVED");

  if ((uploadCount ?? 0) !== 1) {
    return NextResponse.json({ ok: true, triggered: false });
  }

  // Look up referral for this invitee
  const { data: referral } = await sb
    .from("Referral")
    .select("id, inviterId, status")
    .eq("inviteeId", user.id)
    .eq("status", "SIGNED_UP")
    .maybeSingle();

  if (!referral) return NextResponse.json({ ok: true, triggered: false });

  const now = new Date().toISOString();

  // Update referral status
  await sb.from("Referral").update({
    status: "FIRST_UPLOAD",
    firstUploadAt: now,
    uploadPointsAwardedAt: now,
    updatedAt: now,
  }).eq("id", referral.id);

  // Award 25 pts to inviter
  await awardPoints({
    userId: referral.inviterId,
    action: "referral_first_upload",
    referenceId: referral.id,
  });

  return NextResponse.json({ ok: true, triggered: true });
}

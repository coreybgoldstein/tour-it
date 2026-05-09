import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { awardPoints } from "@/lib/awardPoints";

const COOKIE = "tour_it_referral";

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const inviterId = jar.get(COOKIE)?.value;

  // No referral cookie — nothing to do
  if (!inviterId) return NextResponse.json({ ok: true, attributed: false });

  // Clear the cookie immediately regardless of outcome
  jar.delete(COOKIE);

  // Self-referral guard
  if (inviterId === user.id) return NextResponse.json({ ok: true, attributed: false, reason: "self" });

  const ip = getIp(req);
  const sb = serviceDb();
  const now = new Date();

  // ── Anti-fraud: inviter account age < 24h → void ─────────────────────────────
  const { data: inviter } = await sb.from("User").select("id, createdAt").eq("id", inviterId).maybeSingle();
  if (!inviter) return NextResponse.json({ ok: true, attributed: false, reason: "inviter_not_found" });

  const inviterAge = now.getTime() - new Date(inviter.createdAt).getTime();
  if (inviterAge < 24 * 60 * 60 * 1000) {
    await sb.from("Referral").insert({
      id: crypto.randomUUID(), inviterId, inviteeId: user.id,
      inviteeUsername: user.user_metadata?.username ?? null,
      status: "VOID", signupAt: now.toISOString(),
      ipAddressAtSignup: ip, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }).catch(() => {});
    return NextResponse.json({ ok: true, attributed: false, reason: "inviter_too_new" });
  }

  // ── Anti-fraud: IP cluster check (>3 referrals from same IP in 24h) ──────────
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: ipCount } = await sb.from("Referral")
    .select("id", { count: "exact", head: true })
    .eq("ipAddressAtSignup", ip)
    .neq("status", "VOID")
    .gte("createdAt", windowStart);

  const flagged = (ipCount ?? 0) >= 3;

  // Check if invitee already has a referral row (shouldn't happen due to unique constraint, but be safe)
  const { data: existingRef } = await sb.from("Referral")
    .select("id, status")
    .eq("inviteeId", user.id)
    .maybeSingle();
  if (existingRef) return NextResponse.json({ ok: true, attributed: false, reason: "already_attributed" });

  // ── Insert referral row ───────────────────────────────────────────────────────
  const referralId = crypto.randomUUID();
  const { error: insertErr } = await sb.from("Referral").insert({
    id: referralId,
    inviterId,
    inviteeId: user.id,
    inviteeUsername: user.user_metadata?.username ?? null,
    status: flagged ? "VOID" : "SIGNED_UP",
    signupAt: now.toISOString(),
    signupPointsAwardedAt: flagged ? null : now.toISOString(),
    ipAddressAtSignup: ip,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  if (insertErr) {
    console.error("[referral/signup] insert failed:", insertErr.message);
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  // ── Award 50 pts to inviter (skip if IP-flagged) ──────────────────────────────
  if (!flagged) {
    await awardPoints({
      userId: inviterId,
      action: "referral_signup",
      referenceId: referralId,
    });
  }

  return NextResponse.json({ ok: true, attributed: !flagged, flagged });
}

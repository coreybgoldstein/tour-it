import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const POINTS: Record<string, number> = {
  PENDING: 0,
  SIGNED_UP: 50,
  FIRST_UPLOAD: 75,
  VOID: 0,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = serviceDb();

  const { data: profile } = await sb.from("User").select("username").eq("id", user.id).maybeSingle();
  const username = profile?.username ?? "";

  const { data: referrals } = await sb
    .from("Referral")
    .select("id, inviteeUsername, status, signupAt, firstUploadAt, createdAt")
    .eq("inviterId", user.id)
    .neq("status", "VOID")
    .order("createdAt", { ascending: false })
    .limit(50);

  const invites = (referrals ?? []).map((r: any) => ({
    inviteeUsername: r.inviteeUsername ?? null,
    status: r.status,
    signupAt: r.signupAt ?? null,
    pointsEarned: POINTS[r.status] ?? 0,
  }));

  const totalPointsEarned = invites.reduce((s: number, r: any) => s + r.pointsEarned, 0);

  return NextResponse.json({
    inviteLink: `https://touritgolf.com/join/${username}`,
    totalPointsEarned,
    invites,
  });
}

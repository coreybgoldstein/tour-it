import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId, subscription } = await req.json();
  if (!userId || !subscription) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await supabase
    .from("User")
    .update({ pushSubscription: JSON.stringify(subscription) })
    .eq("id", userId);

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription) return NextResponse.json({ error: "Missing subscription" }, { status: 400 });

  await supabase
    .from("User")
    .update({ pushSubscription: JSON.stringify(subscription) })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}

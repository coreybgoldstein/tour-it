import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId, title, body, url } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: user } = await supabase
    .from("User")
    .select("pushSubscription")
    .eq("id", userId)
    .single();

  if (!user?.pushSubscription) return NextResponse.json({ ok: false, reason: "no subscription" });

  try {
    const subscription = JSON.parse(user.pushSubscription);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: url || "/" }));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired — clear it
      await supabase.from("User").update({ pushSubscription: null }).eq("id", userId);
    }
    return NextResponse.json({ ok: false, error: err.message });
  }
}

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`push:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const { userId, title, body, url } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: targetUser } = await supabase
    .from("User")
    .select("pushSubscription")
    .eq("id", userId)
    .single();

  if (!targetUser?.pushSubscription) return NextResponse.json({ ok: false, reason: "no subscription" });

  try {
    const subscription = JSON.parse(targetUser.pushSubscription);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url: url || "/" }));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.statusCode === 410) {
      await supabase.from("User").update({ pushSubscription: null }).eq("id", userId);
    }
    return NextResponse.json({ ok: false, error: err.message });
  }
}

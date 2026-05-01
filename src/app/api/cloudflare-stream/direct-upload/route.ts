import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`upload:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Cloudflare credentials not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxDurationSeconds: 300, requireSignedURLs: false }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Cloudflare error: ${text}` }, { status: 502 });
  }

  const { result } = await res.json();
  return NextResponse.json({ uploadUrl: result.uploadURL, uid: result.uid });
}

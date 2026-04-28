import { NextResponse } from "next/server";

export async function POST() {
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
      body: JSON.stringify({ maxDurationSeconds: 3600, requireSignedURLs: false }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Cloudflare error: ${text}` }, { status: 502 });
  }

  const { result } = await res.json();
  return NextResponse.json({ uploadUrl: result.uploadURL, uid: result.uid });
}

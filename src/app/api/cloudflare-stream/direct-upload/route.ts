import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";

// Accept either a web cookie session OR a native Bearer token. The native
// app (Expo) sends `Authorization: Bearer <access_token>` and has no cookies;
// the web app relies on the SSR cookie session. Try the token first (cheap,
// no cookie round-trip) and fall back to the cookie session.
async function getAuthedUser(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (token) {
    const svc = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user } } = await svc.auth.getUser(token);
    if (user) return user;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
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

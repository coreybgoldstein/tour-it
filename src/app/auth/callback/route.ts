import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Code exchange failed — send to target page to show expired message
    return NextResponse.redirect(`${origin}${next}?invalid=1`);
  }

  // No code (hash-based flow) — redirect to target page, tokens in hash will be handled client-side
  return NextResponse.redirect(`${origin}${next}`);
}

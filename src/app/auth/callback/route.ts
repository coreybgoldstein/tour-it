import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Default-avatar pool, kept in sync with /signup. New Google users get
// a random one assigned at provisioning time so the feed avatar slot
// never renders empty before they personalise.
const DEFAULT_AVATARS = [
  "01-coffee","02-burger-messy","03-golf-glove","04-sunscreen","05-rangefinder",
  "06-hotdog","07-protein-bar","08-driver","09-cheeseburger",
  "11-hamburger","12-water-jug","13-bloody-mary","14-cocktail","15-beer-can",
];
function randomAvatar() {
  const name = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-it-photos/default-avatars/${name}.png`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    // No code (hash-based flow) — redirect to target page, tokens in hash will be handled client-side
    return NextResponse.redirect(`${origin}${next}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}${next}?invalid=1`);
  }

  // Post-exchange: for OAuth signups (Google), the auth.users row exists
  // but our public.User row does not — we have to provision it here on
  // the very first callback. Email/password signups handle this in the
  // /signup page itself, so this block is a no-op for them. We also
  // route brand-new users (no username) into /onboarding/intro so the
  // OAuth-only path still collects a handle, display name, handicap,
  // and home course before they land in the feed.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Service-role client to bypass RLS for the User-row read/insert.
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: existing } = await admin
      .from("User")
      .select("id, username")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      // First-time OAuth user. Mirror what we can from Google's profile
      // metadata; leave username null so the onboarding flow forces the
      // user to pick one. displayName falls back to Google's full_name
      // so the profile doesn't render as @unknown before onboarding.
      const meta = user.user_metadata ?? {};
      const fullName: string | undefined = meta.full_name ?? meta.name;
      const firstName: string | undefined = meta.given_name ?? (fullName ? fullName.split(" ")[0] : undefined);
      const lastName: string | undefined = meta.family_name ?? (fullName ? fullName.split(" ").slice(1).join(" ") : undefined);
      const avatarFromGoogle: string | undefined = meta.avatar_url ?? meta.picture;
      const nowIso = new Date().toISOString();

      await admin.from("User").insert({
        id: user.id,
        email: user.email,
        username: null,
        displayName: fullName ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        avatarUrl: avatarFromGoogle ?? randomAvatar(),
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // No username yet — funnel them through onboarding regardless of
      // what next= says. After /onboarding completes the user lands on
      // home automatically.
      return NextResponse.redirect(`${origin}/onboarding/intro`);
    }

    if (!existing.username) {
      // Edge case: User row exists (created earlier) but username never
      // got set — same guardrail as above.
      return NextResponse.redirect(`${origin}/onboarding/intro`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

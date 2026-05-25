"use client";

/**
 * Legacy redirect route.
 *
 * /onboarding/profile used to be the multi-step identity collector,
 * then briefly the single-screen avatar+name page. Both flows are
 * gone now (2026-05-25 rewrite). All vital info — first name, last
 * name, username, email, password — is collected once at /signup,
 * and the educational slides live at /onboarding/intro. Profile-
 * completion (avatar, handicap, home course) is now triggered the
 * first time the user visits their profile, not during onboarding.
 *
 * This page exists only to bounce stale links (older versions of
 * the app, push notifications generated before today, auth-callback
 * redirects that still reference the old route) to /onboarding/intro
 * so users never see a blank flash.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacyOnboardingProfileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const next = searchParams.get("next");
    router.replace(next ? `/onboarding/intro?next=${encodeURIComponent(next)}` : "/onboarding/intro");
  }, [router, searchParams]);
  return null;
}

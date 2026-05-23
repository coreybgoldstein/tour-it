/**
 * Apple App Site Association file — declares which URLs on
 * touritgolf.com / www.touritgolf.com should open in the Tour It iOS
 * app via Universal Links.
 *
 * Served as a Next.js route handler (NOT a static file) so we can pin
 * Content-Type: application/json. Vercel's static-file Content-Type
 * sniffing on extensionless files is unreliable; iOS will reject the
 * AASA file if it isn't served as application/json.
 *
 * Path-matching rules (Apple syntax, evaluated in order, first match
 * wins):
 *   - "NOT /api/*"        → API endpoints stay in the browser/fetch
 *   - "NOT /admin/*"      → admin UI is web-only
 *   - "NOT /login*"       → keep auth flows in the browser; passkey/
 *                           OAuth/email-link redirects misbehave when
 *                           launched into the app sandbox
 *   - "NOT /signup*"      → same as /login
 *   - "NOT /auth/*"       → confirm/reset routes
 *   - "NOT /forgot-password", "NOT /reset-password" → same reasoning
 *   - "NOT /about", "NOT /privacy", "NOT /terms" → static info pages,
 *                           perfectly fine in a browser
 *   - "*"                 → everything else (home feed, courses, holes,
 *                           profiles, trips, tee-up, upload, search,
 *                           leaderboards, map, clip share links) opens
 *                           the iOS app when installed.
 *
 * Pair this file with the App.entitlements
 * "com.apple.developer.associated-domains" key — both must be in place
 * before iOS treats links to touritgolf.com as Universal Links.
 *
 * After updating, Apple's CDN can take 24–48 hours to refresh on
 * existing installs. New installs pick up changes immediately.
 *
 * Validators:
 *   - https://branch.io/resources/aasa-validator/
 *   - app-site-association.cdn-apple.com/a/v1/touritgolf.com
 */

const APP_ID = "47228CWZLX.com.tourit.app"; // TeamID.BundleID
const DOMAIN_PATHS = [
  "NOT /api/*",
  "NOT /admin/*",
  "NOT /login*",
  "NOT /signup*",
  "NOT /auth/*",
  "NOT /forgot-password",
  "NOT /reset-password",
  "NOT /about",
  "NOT /privacy",
  "NOT /terms",
  "*",
];

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: APP_ID,
        paths: DOMAIN_PATHS,
      },
    ],
  },
  // webcredentials.apps — empty for now; populate when we want password
  // autofill from iCloud Keychain to share between web + app.
  webcredentials: {
    apps: [APP_ID],
  },
};

export const runtime = "edge";

export function GET() {
  return new Response(JSON.stringify(AASA), {
    headers: {
      "Content-Type": "application/json",
      // Apple's CDN re-fetches periodically; cache briefly so the file
      // is fresh after edits but not slammed on every device check.
      "Cache-Control": "public, max-age=3600",
    },
  });
}

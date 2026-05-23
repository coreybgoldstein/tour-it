# Mac archive — Version 1.0.4, Build 525

## Version + Build at a glance

| | Value |
|---|---|
| Version (CFBundleShortVersionString) | **1.0.4** |
| Build (CFBundleVersion) | **525** |
| Previous TestFlight | 1.0.4 (450 or higher — your Xcode-local bumps) |

Use 525 or higher in Xcode. If you've gone past 525 locally, just pick
the next number above whatever's already in App Store Connect.

## What this archive does — Universal Links

Once this build is in TestFlight, tapping a `touritgolf.com` link
anywhere on iOS (Messages, Slack, Notes, an email, a Tweet) will open
the Tour It app instead of mobile Safari — IF the user has the app
installed. If they don't, the link opens in Safari, where the new
download banner appears and pushes them to the App Store. Closed loop.

Two-sided setup:

1. **Web side** — `src/app/.well-known/apple-app-site-association/route.ts`
   returns the Apple App Site Association JSON. The `paths` list
   includes everything user-facing (home, courses, holes, profiles,
   trips, tee-up, upload, etc.) and explicitly excludes API endpoints,
   auth flows, admin, and the static legal pages.

2. **iOS side** — `ios/App/App/App.entitlements` declares
   `com.apple.developer.associated-domains` with
   `applinks:touritgolf.com` + `applinks:www.touritgolf.com`
   (Shared Web Credentials too, for future password autofill).

**Capacitor's bridge already forwards `continueUserActivity` to the
WebView via the existing AppDelegate.swift, so no Swift code changes
are needed for cold-start navigation. Warm-start navigation may need
`@capacitor/app` later if you see issues — flag it and we'll patch.**

## ⚠️ ONE-TIME setup on developer.apple.com (do this BEFORE archiving)

If this is the first archive with the Associated Domains capability,
the App ID needs the capability enabled on the developer portal or
Xcode will fail to generate a provisioning profile.

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Find and click `com.tourit.app`
3. Scroll to Capabilities, tick **Associated Domains**, click Save
4. **Don't worry about Shared Web Credentials** — Apple groups it with
   Associated Domains; ticking the one box enables both for AASA.

(If Xcode complains during archive about "missing entitlement" or
"profile doesn't include com.apple.developer.associated-domains",
this step was skipped.)

## Steps

```bash
# 1. Get to the repo
cd ~/path/to/tour-it

# 2. Pull main
git checkout main
git pull origin main

# 3. SANITY CHECKS — every line must print "PRESENT".
#    If any prints "MISSING" or "REGRESSION", stop and let Corey know.

# Universal Links — web side
test -f src/app/.well-known/apple-app-site-association/route.ts \
  && echo "PRESENT: AASA route handler" || echo "MISSING: AASA route handler"

grep -q "47228CWZLX.com.tourit.app" src/app/.well-known/apple-app-site-association/route.ts \
  && echo "PRESENT: AASA appID matches team+bundle" || echo "MISSING: AASA appID mismatch"

# Universal Links — iOS side
test -f ios/App/App/App.entitlements \
  && echo "PRESENT: App.entitlements file" || echo "MISSING: App.entitlements"

grep -q "applinks:touritgolf.com" ios/App/App/App.entitlements \
  && echo "PRESENT: applinks entitlement (apex)" || echo "MISSING: applinks apex"

grep -q "applinks:www.touritgolf.com" ios/App/App/App.entitlements \
  && echo "PRESENT: applinks entitlement (www)" || echo "MISSING: applinks www"

grep -q "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: pbxproj references entitlements" || echo "MISSING: pbxproj entitlements wiring"

# WebView resume fix (still in place from b510)
grep -q "translateZ(0)" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: body-transform nudge is back" \
  || echo "PRESENT: body-transform path stays removed"

grep -q "func nudgeRender" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: nudgeRender stub is back" \
  || echo "PRESENT: nudgeRender stays removed"

# Version + build numbers
grep -q "MARKETING_VERSION = 1.0.4" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: version 1.0.4" || echo "MISSING: version not 1.0.4"

grep -q "CURRENT_PROJECT_VERSION = 525" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: build 525 in repo" \
  || echo "OK if your local Xcode shows a number > 450"

# 4. Sync Capacitor (no new plugins this archive — just web sync)
npx cap sync ios

# 5. Open the workspace
open ios/App/App.xcworkspace
```

## In Xcode

1. **Add the entitlements file to the project navigator if it isn't already.**
   - Right-click the `App` group → "Add Files to App…" → select
     `ios/App/App/App.entitlements`. Make sure "Copy items if needed"
     is OFF and "Add to targets: App" is checked.
   - This is mostly cosmetic — the build setting we already added
     (`CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`) is what
     actually wires the file in during signing. But adding it to the
     project tree keeps everything visible.

2. **Verify the Signing & Capabilities tab.**
   - Click the `App` target → Signing & Capabilities.
   - You should now see an "Associated Domains" section listing both
     `applinks:touritgolf.com` and `applinks:www.touritgolf.com`
     (plus the two `webcredentials:` entries).
   - If those don't show, the entitlements file isn't being picked up
     — re-check step 1 and the SANITY CHECKS above.

3. **Confirm Version 1.0.4 + Build ≥ 525.**

4. **Product → Archive.** Wait 3-5 minutes.

5. **Distribute App → TestFlight & App Store → Upload.** Automatic
   signing. Wait for "Upload Successful."

## Test plan on TestFlight

### Test 1 — AASA file is reachable (do this before installing the build)

From any browser, hit these two URLs and confirm:
- https://touritgolf.com/.well-known/apple-app-site-association
- https://www.touritgolf.com/.well-known/apple-app-site-association

Both should return JSON (not HTML), with a `200` status. Both should
include `"appID": "47228CWZLX.com.tourit.app"`. If either 404s or
returns HTML, the route handler didn't deploy correctly.

You can also paste either URL into Branch's AASA validator:
https://branch.io/resources/aasa-validator/

### Test 2 — Cold-start Universal Link

1. Force-quit the Tour It app (swipe up from app switcher).
2. Open Messages and send yourself this link:
   `https://www.touritgolf.com/courses/somecourseid` (use a real
   course ID — pick any course detail URL you've opened lately).
3. Wait ~5 seconds for the iMessage preview to load.
4. **Long-press the link.** A menu should appear with an
   **"Open in Tour It"** option.
5. Tap it. Expected: Tour It opens directly to the course page.

If "Open in Tour It" doesn't appear in the long-press menu, AASA
isn't loading on the device yet — give Apple's CDN up to 24 hours
to propagate, or do a hard install/reinstall of TestFlight to force
a fresh fetch.

### Test 3 — Warm-start Universal Link

1. Open Tour It normally, browse to any page.
2. Switch to Messages, tap (don't long-press) the same link.
3. Expected: Tour It comes to the foreground and navigates to that
   course. If it foregrounds but stays on the page you were on,
   warm-start navigation isn't wired — flag this to Corey and we'll
   add `@capacitor/app` with an `appUrlOpen` listener.

### Test 4 — Regression check on the dark-screen fix

Same as before — screenshot on Home, tap each bottom tab, scroll on
each. None should go blank.

## What to do based on results

- **All four tests pass → submit 1.0.4 to App Review.** Universal
  Links + the dark-screen fix go live to everyone.
- **Test 1 fails → web didn't deploy. Don't archive yet.** Ping Corey
  to check Vercel.
- **Test 2 fails (no "Open in Tour It" option after 24h) → AASA file
  is being served but iOS can't validate it.** Run it through the
  Branch validator, screenshot the result, ping Corey.
- **Test 3 fails (cold works, warm doesn't) →** warm-start nav isn't
  wired. We'll add `@capacitor/app` and `appUrlOpen` in a follow-up
  archive. Submit 1.0.4 anyway — cold-start is the more common path.
- **Test 4 fails →** dark-screen regression. Don't submit.

## What's in this archive

- New file: `ios/App/App/App.entitlements` with
  `com.apple.developer.associated-domains` for
  `applinks:touritgolf.com`, `applinks:www.touritgolf.com`, and the
  matching `webcredentials:` entries.
- pbxproj wired with `CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`
  on both Debug and Release.
- Build bumped 512 → 525.
- Web side: AASA route at
  `/.well-known/apple-app-site-association` returning the AASA JSON
  with `application/json` Content-Type.
- All previous wins still in place: dark-screen fix (no nudgeRender,
  no body-transform), narrow resume background paint, debug overlay
  unmounted, web-side scorecard OCR / CTP & Longest Drive games /
  winnings leaderboard / comment-button fixes / app download banner.

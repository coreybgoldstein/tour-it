# Mac archive — Version 1.0.4, Build 510

## Version + Build at a glance

| | Value |
|---|---|
| Version (CFBundleShortVersionString) | **1.0.4** |
| Build (CFBundleVersion) | **510** |
| Previous TestFlight | 1.0.4 build 450 (uploaded ~8:20 PM EDT, 2026-05-20) |
| Previous live | 1.0.3 build 444 (live on App Store) |

Use 510 or higher in Xcode. Must be > 450 since b450 is already in
TestFlight under the 1.0.4 slot.

## What this build does

**Removes `nudgeRender()` entirely from AppDelegate.swift.**

Build 450 still had the dark-screen-on-screenshot bug. The diagnostic
overlay (5-tap-to-enable on the phone) confirmed the failure happens
within ~60ms of the JS-side `resume` event — which is exactly when
`evaluateJavaScript` queued from `applicationDidBecomeActive` would run.
That made `nudgeRender` the prime suspect.

Rather than guess at a third version of the "force compositor recompose"
trick, this build deletes the whole path. Both call sites are gone:

- Screenshot notification listener: removed.
- Call from `applicationDidBecomeActive`: removed.
- `nudgeRender(reason:)` method itself: removed.

If the dark-screen bug stops after this build, `nudgeRender` was the
cause and we've proven it. If the bug continues, we've ruled it out and
the next-rank suspect is `applyBrandBackgroundsRecursively` walking into
the WKWebView's internal compositor subviews on every resume — that's
the next experiment, but only if this one doesn't end it.

Everything else is unchanged from b450:

- 60-second `applicationDidBecomeActive` probe-and-reload for the
  long-suspend URLSession-zombie case
- `WebViewDelegateWrapper` and `webViewWebContentProcessDidTerminate`
  hook for iOS Jetsam recovery
- Brand-dark backgrounds re-applied on every resume
- Scroll-bounce kill, splash assets, app icon

## Steps

```bash
# 1. Get to the repo
cd ~/path/to/tour-it

# 2. Make sure you're on main
git checkout main

# 3. PULL — do not skip
git pull origin main

# 4. SANITY CHECKS — every line must print the expected message.
#    If any line is wrong, stop and ping Corey.

# nudgeRender must be GONE — these should all confirm absence:
grep -q "func nudgeRender" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: nudgeRender method still present" \
  || echo "PRESENT: nudgeRender method removed"

grep -q "userDidTakeScreenshotNotification" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: screenshot listener still present" \
  || echo "PRESENT: screenshot listener removed"

grep -q "translateZ(0)" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: body-transform path still present" \
  || echo "PRESENT: body-transform path removed"

# Paths that must STILL be in place:
grep -q "backgroundedThreshold: TimeInterval = 60.0" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: 60s probe threshold" || echo "MISSING: 60s threshold"

grep -q "probeAndRecoverIfNeeded" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: probe path" || echo "MISSING: probe path"

grep -q "WebViewDelegateWrapper" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: nav-delegate wrapper" || echo "MISSING: nav-delegate wrapper"

grep -q "webViewWebContentProcessDidTerminate" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: Jetsam handler" || echo "MISSING: Jetsam handler"

# Version + build in pbxproj:
grep -q "MARKETING_VERSION = 1.0.4" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: version 1.0.4" || echo "MISSING: version not 1.0.4"

# Repo says build 510. If you have a higher build locally that's fine,
# just confirm Xcode shows > 450 before archiving.
grep -q "CURRENT_PROJECT_VERSION = 510" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: build 510 in repo" \
  || echo "OK if your local Xcode shows a number > 450"

# 5. Sync Capacitor
npx cap sync ios

# 6. Open Xcode workspace (NOT the .xcodeproj)
open ios/App/App.xcworkspace
```

## In Xcode

1. Top toolbar: select **Any iOS Device (arm64)** as the destination.
2. App target → General tab. Confirm **Version 1.0.4** and **Build ≥ 510**.
   If Xcode shows a higher local number (e.g. 451 from your last
   archive), bump it to at least 510 to keep us in sync with the repo —
   anything > 450 is technically fine for ASC.
3. **Product → Archive**. Wait 3-5 minutes.
4. Organizer → **Distribute App** → **TestFlight & App Store** → **Upload**.
5. Wait for **"Upload Successful"**.

## Test plan on TestFlight

The bug-fix verification is Test 3. Tests 1, 2, 4 are regression checks.

### Test 0 — Enable diagnostic overlay (do this first)

After installing the new TestFlight build, open the app and **tap
anywhere on the screen 5 times within 1 second**. A small black text bar
should appear at the top showing `debug overlay ready`. Leave it on for
all tests below.

### Test 1 — Splash

Force close. Open. Green Tour It splash, no white flash, smooth
transition.

### Test 2 — Quick app switch

Scroll partway down Home. Press home button. Wait 10s in Messages.
Return to Tour It. **Expected:** lands on the same clip, no reload, no
flash. Overlay shows `vis:hidden → vis:visible → foreground` and the
content stays visible.

### Test 3 — Screenshot + tab navigation (THE BUG FIX)

Open the app on Home. Take a screenshot. Then tap **Search → Lists →
Profile → Tee Up**, scrolling on each.

**Expected on b510:** every tab renders normally, scrolls without
blinking. Overlay shows the lifecycle events but the screen does NOT go
dark.

**Was broken on b450:** screen went dark after screenshot, BottomNav
gone, couldn't navigate.

Repeat with backgrounding instead of screenshot (lock phone briefly,
return).

### Test 4 — Long backgrounding (recovery still works)

Open the app, lock phone for ≥ 2 minutes, return. **Expected:** app
responds. You may see a reload (probe detected dead WebView and
recovered — fine). What you should NOT see: permanently blank screen.

## What to do based on Test 3 outcome

- **All four pass → submit to App Review.** Bug is fixed by removing
  nudgeRender. 1.0.4 ships to everyone.

- **Test 3 fails (screen still goes dark) → DO NOT submit.** Take a
  screenshot of the diagnostic overlay at the moment of failure and
  send it to Corey. nudgeRender wasn't the cause; the next experiment
  is to disable `applyBrandBackgroundsRecursively` from recursing into
  the WKWebView's internal subviews. That's a small targeted change
  Corey will push for the next archive.

- **Test 4 starts taking too long to reload (>2 minutes of blank
  screen):** the probe-and-reload path may have regressed. Send Corey
  a Console.app log filtered on `TourIt`.

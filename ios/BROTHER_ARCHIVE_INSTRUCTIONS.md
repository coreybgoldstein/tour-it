# Mac archive — Version 1.0.2, Build 401

## Version + Build at a glance

| | Value |
|---|---|
| Version (CFBundleShortVersionString) | **1.0.2** |
| Build (CFBundleVersion) | **401** |
| Previous live | 1.0.1 (live on App Store) |

App Store Connect already has a **1.0.2** version slot opened with the
new screenshots and app icon metadata. The archive MUST match — if you
upload a 1.0.1 build now, App Store Connect will reject it (1.0.1 is
already live, can't submit another build under that version).

## What's different about this build

The previous live build (1.0.1 b400) had a fix that overcorrected. It reloaded
the WebView every time the app came back from being backgrounded for
more than 1.5 seconds, AND it reloaded after every screenshot. Net
effect: every quick app switch wiped UI state, and every screenshot
caused a visible stutter.

This build (b401):

- **Drops the screenshot listener entirely.** Screenshots are no longer
  treated as recovery events. Modern iOS does not corrupt the WebView
  on screenshot capture.
- **Raises the background-recovery threshold from 1.5s to 60s.** Quick
  context switches (Messages, Control Center, notification banners)
  no longer trigger a reload.
- **Probes before reloading.** Even after 60s+ of backgrounding, we
  first evaluate a trivial JS expression in the WebView. If it responds
  within 500ms the WebView is alive and we skip the reload. Only a
  failed/timed-out probe triggers reload.
- **Trims the JS-side recovery code** to a heartbeat-only check (event
  loop paused >60s → reload). The visibilitychange/blur/pageshow
  reload paths are gone — they were the JS-side equivalent of the
  same over-aggressive recovery.

Result: the user can leave the app and return without losing scroll
position, video playback state, or modal state. Screenshots no longer
cause a stutter.

## Steps

```bash
# 1. Get to the repo
cd ~/path/to/tour-it

# 2. Make sure you're on main
git checkout main

# 3. PULL — do not skip
git pull origin main

# 4. SANITY CHECKS — every line must print "PRESENT".
#    If any prints "MISSING", stop and let Corey know.

grep -q "backgroundedThreshold: TimeInterval = 60.0" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: 60s threshold" || echo "MISSING: 60s threshold"

grep -q "probeAndRecoverIfNeeded" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: probe path" || echo "MISSING: probe path"

! grep -q "userDidTakeScreenshotNotification" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: screenshot listener removed" || echo "MISSING: screenshot listener still in file"

grep -q "CURRENT_PROJECT_VERSION = 401" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: build 401" || echo "MISSING: build is not 401"

grep -q "MARKETING_VERSION = 1.0.2" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: version 1.0.2" || echo "MISSING: version is not 1.0.2"

ls ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png > /dev/null 2>&1 \
  && echo "PRESENT: new app icon" || echo "MISSING: app icon"

grep -q "heartbeat-only resume-recovery active" src/components/NativeBootstrap.tsx \
  && echo "PRESENT: JS heartbeat-only path" || echo "MISSING: JS still has old reload paths"

ls ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png > /dev/null 2>&1 \
  && echo "PRESENT: Splash asset" || echo "MISSING: Splash asset"

# 5. Sync Capacitor
npx cap sync ios

# 6. Open Xcode workspace (NOT the .xcodeproj)
open ios/App/App.xcworkspace
```

## In Xcode

1. Top toolbar: select **Any iOS Device (arm64)** as the destination.
2. Click the **App** target → **General** tab.
3. Confirm **Version = 1.0.2** and **Build = 401**. Both are already
   bumped in the repo — if the General tab shows 1.0.1 or 373/400,
   something's wrong with the checkout. Stop and let Corey know.
4. **Product → Archive**. Wait 3-5 minutes.
5. Organizer opens → **Distribute App** → **TestFlight & App Store** →
   **Upload**. Use automatic signing.
6. Wait for **"Upload Successful"**.

## Test plan on TestFlight before submitting to App Review

All four tests must pass.

### Test 1 — Splash (unchanged from b400)

Force close the TestFlight app. Open it. Green Tour It splash with the
full logo, smooth transition to the app. No white flash, no wrong
aspect ratio.

### Test 2 — Quick app switch (NEW BEHAVIOR — most important)

Open the app and scroll partway down the home feed. Take note of which
clip is on screen. Press the home button (or swipe up) to leave the
app. Open Messages, wait ~10 seconds, return to Tour It.

**Expected:** the app comes back to the EXACT clip you left on. No
reload, no scroll-jump, no visible flash. This is the test that proves
the over-recovery is gone.

### Test 3 — Screenshot (NEW BEHAVIOR)

With the app open on any screen, press power + volume-up to take a
screenshot. The app should remain on the same screen with no flash,
no reload, no stutter. Just the standard iOS screenshot animation.

### Test 4 — Long backgrounding (recovery still works)

Open the app, then lock the phone or switch to another app and leave
it for at least **two minutes**. Return to Tour It.

**Expected:** the app remains responsive. You may or may not see a
brief reload — that's fine and correct (it means the probe detected
a dead WebView and recovered). What you should NOT see: a permanently
blank screen, a frozen UI, or content that never loads.

### Optional Console.app diagnostic

Plug phone into Mac, open Console.app, filter on `TourIt`. Trigger the
tests above. You should see:

- Test 2 (10s switch): `[TourIt] background gap 10nnnms — below threshold, skipping probe`
- Test 3 (screenshot): no `[TourIt]` recovery log lines at all
- Test 4 (long backgrounding, healthy): `[TourIt] background gap NNNms — probing WebView`
  followed by `[TourIt] probe ok — WebView alive, skip reload`
- Test 4 (long backgrounding, dead): same as above but ends with
  `[TourIt] probe failed — reload` and `[TourIt] recoverWebViews reason=didBecomeActive`

If you see `[TourIt] recoverWebViews` during Test 2 or Test 3, something
is wrong and we need to look at it before submitting to App Review.

## Submitting to App Review

Only submit after all four tests pass. If anything fails, ping Corey.

## What's in this archive

- `e8...` (this commit): probe-before-reload, 60s threshold, screenshot
  listener dropped, JS reduced to heartbeat-only
- Earlier b400 changes that stay in place: brand-dark backgrounds,
  scroll-bounce kill, splash asset regen, app icon
- All web-side improvements come along for free via `server.url`

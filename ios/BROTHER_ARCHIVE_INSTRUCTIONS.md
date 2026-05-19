# Mac archive — Version 1.0.2, Build 424

## Version + Build at a glance

| | Value |
|---|---|
| Version (CFBundleShortVersionString) | **1.0.2** |
| Build (CFBundleVersion) | **424** |
| Previous live | 1.0.1 (live on App Store) |

App Store Connect already has a **1.0.2** version slot opened with the
new screenshots and app icon metadata. The archive MUST match — if you
upload a 1.0.1 build now, App Store Connect will reject it (1.0.1 is
already live, can't submit another build under that version).

## What's different about this build

The previous attempted fix (b401, code lived in the repo) went too far in
the other direction — it dropped the screenshot listener completely and
raised the background threshold to 60s. Result: post-screenshot and
short-backgrounding black-WebView bugs that users have been hitting in
production.

The root cause those builds missed: WKWebView's compositor can hiccup
after iOS captures the screen (screenshot, app-switcher snapshot, brief
backgrounding) — the JS thread keeps running but the visible CALayer
goes black. A JS-execution probe falsely reports the WebView healthy,
so the existing probe+reload path never fires. reloadFromOrigin() WOULD
fix it, but obliterates in-memory state on every screenshot — worse UX
than the bug.

This build (b424) ships TWO fixes in one archive so we cover both
candidate root causes without waiting for diagnosis:

**Fix 1 — Compositor hiccup (most likely cause):**
- Re-adds the screenshot listener, but it no longer reloads. Instead
  it calls `nudgeRender()`: evaluates a tiny JS snippet that appends a
  `translateZ(0)` transform to `document.body`, forces a synchronous
  reflow, then restores the original transform on the next animation
  frame. This forces a GPU layer recomposite without disrupting any
  state. Visually a no-op.
- Also nudges on every `applicationDidBecomeActive` — covers the
  short-backgrounding case the 60s probe threshold deliberately misses.

**Fix 2 — WebContent process Jetsam (less common but real):**
- Installs a `WKNavigationDelegate` forwarding wrapper that intercepts
  `webViewWebContentProcessDidTerminate(_:)`. When iOS kills the
  WebContent render process under memory pressure, we now catch that
  signal and call `reloadFromOrigin()` to spin up a fresh process.
  Without this hook, JS is dead and `nudgeRender` no-ops — the user is
  stuck on a permanently black WebView until they force-quit.
- The wrapper transparently forwards every OTHER navigation-delegate
  message (`decidePolicyFor`, `didStartProvisionalNavigation`, etc.) to
  Capacitor's bridge via Objective-C message forwarding, so plugin
  routing (deep links, URL handlers) keeps working unchanged. No
  swizzling, no Capacitor subclassing — Capacitor never knows we wrapped
  its delegate.

**Unchanged from before:**
- 60s probe+reload path for genuinely-suspended (URLSession zombie) case
- JS-side heartbeat-only resume detection

Result: screenshots, brief backgroundings, AND iOS memory kills all
recover the WebView. The compositor-hiccup paths preserve state; the
Jetsam path has to reload (no choice — the process is dead).

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

grep -q "userDidTakeScreenshotNotification" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: screenshot listener" || echo "MISSING: screenshot listener"

grep -q "func nudgeRender" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: nudgeRender path" || echo "MISSING: nudgeRender path"

grep -q "WebViewDelegateWrapper" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: nav-delegate wrapper class" || echo "MISSING: wrapper class"

grep -q "webViewWebContentProcessDidTerminate" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: Jetsam handler" || echo "MISSING: Jetsam handler"

grep -q "CURRENT_PROJECT_VERSION = 424" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: build 424" || echo "MISSING: build is not 424"

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
3. Confirm **Version = 1.0.2** and **Build = 424**. Both are already
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

### Test 3 — Screenshot (the bug this build is fixing)

With the app open on any screen, press power + volume-up to take a
screenshot. The app should remain on the same screen with no flash,
no reload, no stutter — and critically, **no black WebView**. The
screen content stays visible the whole time; the iOS screenshot
animation plays over it. Repeat 3-5 times in a row to make sure each
screenshot still leaves the WebView visible.

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

- **App launch:** `[TourIt] installed WebContent-process termination handler`
  (proves the Jetsam hook installed correctly — if this line never
  appears, Fix 2 isn't active)
- Test 2 (10s switch): `[TourIt] nudgeRender reason=didBecomeActive` and
  `[TourIt] background gap 10nnnms — below threshold, skipping probe`
- Test 3 (screenshot): `[TourIt] nudgeRender reason=screenshot` per
  screenshot. No `recoverWebViews` lines — those would mean we regressed
  to the state-wiping behavior.
- Test 4 (long backgrounding, healthy): `[TourIt] nudgeRender` +
  `[TourIt] background gap NNNms — probing WebView` followed by
  `[TourIt] probe ok — WebView alive, skip reload`
- Test 4 (long backgrounding, dead): same as above but ends with
  `[TourIt] probe failed — reload` and `[TourIt] recoverWebViews reason=didBecomeActive`
- **If a Jetsam happens (rare, memory-pressure):**
  `[TourIt] WebContent process terminated — reloadFromOrigin` —
  this proves Fix 2 caught it. The WebView will reload (state lost).

If you see `[TourIt] recoverWebViews` during Test 2 or Test 3, something
is wrong and we need to look at it before submitting to App Review.

**If the black-WebView bug still happens** despite this build:
1. Capture the Console.app log from the moment of failure
2. Check for `[TourIt] nudgeRender` lines — if they fire but bug persists,
   the CSS reflow trick isn't strong enough; we'll need to escalate to
   `removeFromSuperview` + re-add
3. Check for `[TourIt] WebContent process terminated` — if it fires but
   the screen doesn't recover, `reloadFromOrigin` isn't working in this
   case and we'll need to investigate the new WebView instance
4. If NEITHER line appears around the failure, our hooks aren't firing
   at all — the bug is something we haven't predicted (e.g., scene
   lifecycle, third-party plugin interaction)

## Submitting to App Review

Only submit after all four tests pass. If anything fails, ping Corey.

## What's in this archive

- b424 (this commit):
  - Screenshot listener re-added with non-destructive `nudgeRender`
    (CSS transform reflow). Also nudges on every
    `applicationDidBecomeActive`.
  - `WebViewDelegateWrapper` class added — transparent forwarder that
    intercepts `webViewWebContentProcessDidTerminate(_:)` so we can
    recover from iOS Jetsam kills. Installs in
    `didFinishLaunchingWithOptions` and re-installs on every
    `applicationDidBecomeActive` as a safety net.
  - Probe-before-reload (60s threshold) and JS heartbeat path unchanged.
- Earlier changes that stay in place: brand-dark backgrounds,
  scroll-bounce kill, splash asset regen, app icon
- All web-side improvements come along for free via `server.url`

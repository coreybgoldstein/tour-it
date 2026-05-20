# Mac archive — Version 1.0.4, Build 500

## Version + Build at a glance

| | Value |
|---|---|
| Version (CFBundleShortVersionString) | **1.0.4** |
| Build (CFBundleVersion) | **500** |
| Previous live | 1.0.3 build 444 (live on App Store) |

Open a **1.0.4** version slot in App Store Connect before archiving if
one doesn't exist. The archive will reject if you try to upload 1.0.4
without the matching ASC slot. If the slot exists with a different
required build number, use that — but it must be > 444.

## What this build fixes

**The bug:** In 1.0.3 build 444, after a screenshot OR a brief
background-and-return, every tab EXCEPT Home goes blank and blinks
rapidly when scrolled. Home stays fine. Hard-close and reopen recovers.

**Root cause:** The `nudgeRender()` we added to fix the post-screenshot
black-WebView issue was appending `translateZ(0)` to `document.body`'s
transform style and restoring it on the next animation frame. On iOS
WKWebView, even a one-frame transform on `<body>` promotes body to its
own composite layer AND makes body the containing block for every
`position: fixed` descendant. WebKit doesn't tear the promotion down
promptly when the transform is restored to empty — fixed elements stay
re-anchored to body for some window after. Home's scroll-snap feed is
layout-invariant under that swap; every other route has full-page
fixed/sticky chrome that breaks.

There was also a re-entrancy bug: if two nudges fired within one frame
(possible on certain screenshot+background sequences), the rAF restore
would capture the stale `translateZ(0)` as its baseline and re-apply it
permanently.

**The fix:** Replaced the body-transform trick with a 1px window scroll
nudge that restores on rAF, plus a 100ms throttle to prevent
accumulation. Same callers, same NSLog telemetry. Window scroll position
is not a stacking-context or containing-block input, so the entire
side-effect class goes away.

Everything else (probe+reload at >60s, WebContent-process Jetsam handler,
brand-dark backgrounds) is unchanged.

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

# The new scroll-based nudge:
grep -q "window.scrollTo(0, y + 1)" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: scroll-based nudgeRender" || echo "MISSING: scroll nudge"

grep -q "__tiLastNudge" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: nudge throttle" || echo "MISSING: nudge throttle"

# The body-transform trick MUST be gone — if this prints PRESENT, the
# checkout is wrong:
grep -q "translateZ(0)" ios/App/App/AppDelegate.swift \
  && echo "REGRESSION: body-transform path still in AppDelegate" \
  || echo "PRESENT: body-transform path removed"

# Unchanged paths still in place:
grep -q "backgroundedThreshold: TimeInterval = 60.0" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: 60s threshold" || echo "MISSING: 60s threshold"

grep -q "probeAndRecoverIfNeeded" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: probe path" || echo "MISSING: probe path"

grep -q "userDidTakeScreenshotNotification" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: screenshot listener" || echo "MISSING: screenshot listener"

grep -q "WebViewDelegateWrapper" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: nav-delegate wrapper class" || echo "MISSING: wrapper class"

grep -q "webViewWebContentProcessDidTerminate" ios/App/App/AppDelegate.swift \
  && echo "PRESENT: Jetsam handler" || echo "MISSING: Jetsam handler"

# Version + build numbers in pbxproj:
grep -q "CURRENT_PROJECT_VERSION = 500" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: build 500" || echo "MISSING: build is not 500"

grep -q "MARKETING_VERSION = 1.0.4" ios/App/App.xcodeproj/project.pbxproj \
  && echo "PRESENT: version 1.0.4" || echo "MISSING: version is not 1.0.4"

# 5. Sync Capacitor
npx cap sync ios

# 6. Open Xcode workspace (NOT the .xcodeproj)
open ios/App/App.xcworkspace
```

## In Xcode

1. Top toolbar: select **Any iOS Device (arm64)** as the destination.
2. Click the **App** target → **General** tab.
3. Confirm **Version = 1.0.4** and **Build = 500**. Both are already
   bumped in the repo — if the General tab shows 1.0.3 or 444 or
   anything lower, something's wrong with the checkout. Stop and let
   Corey know.
4. If you've built locally since the last TestFlight upload and the
   build number ASC expects is higher than 500 (rare but possible),
   bump Build in the General tab to one above the most recent ASC
   build number. Anything > 444 is acceptable as long as it's also
   higher than any prior TestFlight upload under 1.0.4.
5. **Product → Archive**. Wait 3-5 minutes.
6. Organizer opens → **Distribute App** → **TestFlight & App Store** →
   **Upload**. Use automatic signing.
7. Wait for **"Upload Successful"**.

## Test plan on TestFlight before submitting to App Review

All four tests must pass — Test 3 is the bug-fix verification.

### Test 1 — Splash (regression check)

Force close the TestFlight app. Open it. Green Tour It splash with the
full logo, smooth transition to the app. No white flash, no wrong
aspect ratio.

### Test 2 — Quick app switch (regression check)

Open the app and scroll partway down the home feed. Press home / swipe
up to leave. Open Messages, wait ~10 seconds, return to Tour It.

**Expected:** the app comes back to the EXACT clip you left on. No
reload, no scroll-jump, no flash.

### Test 3 — Screenshot, then navigate (THE BUG FIX)

Open the app on Home. Take a screenshot (power + volume-up).
Then tap each bottom-tab in turn: **Search**, **Lists**, **Profile**.

**Expected on 1.0.4 b500:** every tab loads and scrolls normally with no
blinking. Scroll up and down on each tab — no flicker, no blank patches.

**What was broken in 1.0.3 b444:** Search/Lists/Profile/etc. went blank
and blinked rapidly when scrolled. Home was fine. If you see that
behavior on this build, the fix didn't land — capture a Console.app log
and ping Corey.

Repeat the same flow after backgrounding for 5-15 seconds and returning
(this hits the same code path as the screenshot).

### Test 4 — Long backgrounding (recovery still works)

Open the app, then lock the phone or switch to another app and leave
it for at least **two minutes**. Return to Tour It.

**Expected:** the app remains responsive. You may see a brief reload —
that's fine and correct (probe detected a dead WebView and recovered).
What you should NOT see: a permanently blank screen or frozen UI.

### Optional Console.app diagnostic

Plug phone into Mac, open Console.app, filter on `TourIt`. Run the
tests above. Expected lines:

- **App launch:** `[TourIt] installed WebContent-process termination handler`
- **Test 2 (10s switch):** `[TourIt] nudgeRender reason=didBecomeActive` and
  `[TourIt] background gap 10nnnms — below threshold, skipping probe`
- **Test 3 (screenshot):** `[TourIt] nudgeRender reason=screenshot` per
  screenshot. No `recoverWebViews` lines.
- **Test 4 (long bg):** `[TourIt] nudgeRender` +
  `[TourIt] background gap NNNms — probing WebView` followed by either
  `probe ok — WebView alive, skip reload` (healthy) or
  `probe failed — reload` + `recoverWebViews reason=didBecomeActive` (suspended).

**If Test 3 still fails after this build lands:**
1. Capture the Console.app log from the moment Search/Lists/Profile
   blinks.
2. Confirm `[TourIt] nudgeRender reason=screenshot` fires when you take
   the screenshot. If it doesn't, the build wasn't archived from this
   commit — re-check the SANITY CHECKS output.
3. If the nudge fires but the tabs still blink, the second-rank suspect
   is `applyBrandBackgroundsRecursively` walking into the WKWebView's
   internal subviews on every resume. Ping Corey with the log; we'll
   patch that next.

## Submitting to App Review

Only submit after all four tests pass. If anything fails, ping Corey.

## What's in this archive

- b500 (this commit):
  - `nudgeRender` rewritten to use a 1px scroll-and-restore + 100ms
    throttle. Replaces the body.style.transform trick that was making
    Home survive but other tabs go blank after screenshots / brief
    backgroundings.
- Everything else unchanged from b444:
  - Screenshot listener that calls `nudgeRender` (now safe)
  - `nudgeRender` also fires on every `applicationDidBecomeActive`
  - Probe-before-reload at 60s threshold
  - `WebViewDelegateWrapper` for WebContent-process Jetsam recovery
  - Brand-dark backgrounds, scroll-bounce kill, splash assets, app icon
- All web-side improvements (scorecard OCR, username editor + email-as-
  username banner, AI hole detection) come along for free via `server.url`.

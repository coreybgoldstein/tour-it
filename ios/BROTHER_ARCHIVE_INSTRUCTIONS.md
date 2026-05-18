# Mac archive — CRITICAL: must pull main before building

## What went wrong last time

Whatever got archived and shipped to the App Store this round did NOT
include the native AppDelegate WebView-recovery code or the regenerated
splash assets. Result: the public app has the white-screen-on-screenshot
bug and the broken splash. Both fixes have been in `main` for over a week.

The most likely cause is the archive being built from a stale local
checkout that hadn't pulled `main`. Below are foolproof steps + a
sanity check so this can't happen again.

## Steps

```bash
# 1. Get to the repo
cd ~/path/to/tour-it

# 2. Make sure you're on main
git checkout main

# 3. PULL — do not skip this step
git pull origin main

# 4. SANITY CHECK — must print "PRESENT" twice. If either prints
#    "MISSING", stop and let Corey know.
grep -l "recoverWebViews" ios/App/App/AppDelegate.swift && echo "PRESENT: AppDelegate native recovery" || echo "MISSING: AppDelegate native recovery"
ls ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png > /dev/null && echo "PRESENT: Splash asset (446KB)" || echo "MISSING: Splash asset"

# 5. Sync Capacitor (safety, in case Capacitor config drifted)
npx cap sync ios

# 6. Open Xcode workspace (NOT the .xcodeproj file)
open ios/App/App.xcworkspace
```

## In Xcode

1. Top toolbar: select **Any iOS Device (arm64)** as the destination.
2. Click the **App** target in the left sidebar → **General** tab.
3. **Build** number is currently **373** in `project.pbxproj`. Bump to
   **400** to leave headroom (the previously-rejected TestFlight build
   may have used 373 or higher). **Version** stays **1.0.1**.
4. **Product → Archive** (top menu). Wait ~3-5 minutes.
5. When the Organizer window opens, click **Distribute App** →
   **TestFlight & App Store** → **Upload**. Use automatic signing.
6. Wait for the **"Upload Successful"** toast.

## How to verify on your phone before submitting to App Review

1. App Store Connect → TestFlight → wait for the build to finish
   processing (5-15 min, you'll get an email).
2. Install the TestFlight build on your iPhone.
3. **Three tests** — all must pass before submitting to App Review:

   a. **Splash test.** Force close the TestFlight app. Open it. The
      green Tour It splash should display cleanly with the full logo
      visible, then transition smoothly to the app. No white flash, no
      sparkle, no wrong aspect ratio.

   b. **Screenshot test.** With the app open on the home feed, press
      power + volume-up to take a screenshot. The app should briefly
      flash + reload, then come back to a working state. Content area
      should NOT stay blank.

   c. **Background test.** Lock your phone for 30 seconds, then
      unlock and return to the app. Same expected behavior — brief
      reload, content restored.

4. **Optional but recommended diagnostic:** plug your phone into a Mac,
   open **Console.app**, select your iPhone in the left sidebar, filter
   on `TourIt`. Trigger the screenshot/background tests. You should see
   lines like:
   - `[TourIt] recoverWebViews reason=screenshot`
   - `[TourIt] background gap 4823ms — triggering recovery`

   If you see these lines, the native fix is firing correctly. If you
   don't, something is wrong and we need to investigate.

## Submitting to App Review

Only submit to App Review after all three tests above pass on your own
iPhone via TestFlight. The previous round shipped without these fixes
because the binary that got archived didn't have them — so manual
verification before submitting is critical.

## What's in this archive

- Native AppDelegate WebView recovery (`d084e1ec`, refined in
  `810ac11c`): `reloadFromOrigin()` on every WKWebView when the app
  resumes after >1.5s of backgrounding, or on a screenshot. 3s cooldown
  to prevent thrashing.
- Regenerated splash PNGs (`449f9d89`): three 446KB images at
  2732×2732 with the correct logo + no sparkle / inset issues.
- All the JS-side fixes (Supabase fetch timeouts, hero tagging,
  notifications panel, course logos on thumbnails, etc.) come along
  for free since the WebView loads `server.url` from
  https://www.touritgolf.com on each launch.

## If anything else breaks

Let Corey know immediately so he can iterate. Don't submit a build to
App Review that has any of the three test failures above. Submitting a
broken build delays launch further than waiting 24 hours to fix the
issue.

# Mac archive — WebView resume-recovery patch

What this build ships: a native fix in `AppDelegate.swift` that reloads the
WKWebView when the app comes back from being backgrounded or screenshotted.
This recovers from the bug where content goes blank and only force-close
fixes it.

Two triggers handled:

1. App was inactive > 500 ms (backgrounded, app switcher, phone call, etc).
   On return → `reloadFromOrigin()` on the WebView, which tears down the
   stuck URLSession that iOS suspend corrupts.

2. Screenshot taken (`userDidTakeScreenshotNotification`). Same recovery
   path, but with a 250 ms delay so iOS finishes its snapshot capture first.

No Capacitor plugin or config changed. Only `AppDelegate.swift` is new.

## Steps

```bash
# 1. Pull latest from main
cd ~/path/to/tour-it
git pull origin main

# 2. (Optional but safe) sync Capacitor — no-op since no plugin changes,
#    but won't hurt.
npx cap sync ios

# 3. Open Xcode workspace (NOT the project file)
open ios/App/App.xcworkspace
```

In Xcode:

1. Top toolbar: select **Any iOS Device (arm64)** as the destination.
2. Click the **App** target in the left sidebar → **General** tab.
3. Bump **Build** number. The last live App Store build was **346**. Local
   pbxproj is at **347**. **Bump to 400** to leave headroom for any prior
   TestFlight uploads we don't know about. Leave **Version** at **1.0.1**.
4. **Product → Archive** (top menu). Wait ~3-5 min for the archive.
5. When the Organizer window opens, click **Distribute App** →
   **TestFlight & App Store** → **Upload**. Use automatic signing.
6. Wait for the "Upload Successful" toast.

## Verify

1. App Store Connect → TestFlight → wait for the build to finish processing
   (usually 5-15 min, you'll get an email).
2. Build appears in TestFlight on iPhone — install the update.
3. Test:
   - Open the app.
   - Take a screenshot. The app should briefly flash and reload — content
     comes back working, not blank.
   - Lock phone for 10s, unlock, return to app. Same — quick reload,
     working app.
   - Long-background (phone call, app switcher to another app for 30s+).
     Return. Should reload and recover.

## If something goes wrong

- **Archive fails with signing error**: Xcode → Preferences → Accounts →
  re-sign in to Apple ID. Then re-try archive.
- **"Build number must be greater than previous" error on upload**: bump
  to 401, 402, etc. until it accepts.
- **App reloads constantly** (e.g., every time you tap a banner): the 500ms
  threshold in `AppDelegate.swift` is too low. Bump it to 1500 and re-archive.

## What's still JS-side

The web bundle (`src/components/NativeBootstrap.tsx`) still has the older
visibility / blur / focus / heartbeat reload handler. It's harmless — most
of its triggers won't fire for the iOS lifecycle events that the native
fix now handles. They stay as a defense-in-depth for any iOS scenario
the native fix misses (and as the only fallback for older TestFlight
builds that haven't been updated yet).

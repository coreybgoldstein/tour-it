import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tourit.app",
  appName: "Tour It",
  webDir: "out",

  // Live server — loads the Vercel deployment inside the WebView. Use the
  // www subdomain explicitly so we skip the apex → www 307 redirect that
  // was costing ~400ms on cold launch (and showing a flash of nothing on
  // slower networks like the iPad reviewer's).
  // Remove this block for a fully bundled static build.
  server: {
    url: "https://www.touritgolf.com",
    cleartext: false, // HTTPS only
  },

  // Background matches the app's dark brand color so navigation transitions
  // don't flash white between routes. (Previously white for the App Store
  // review fix, but caused visible flashes on every page change.)
  backgroundColor: "#07100a",

  ios: {
    // "never" — HTML content extends to the very top of the WebView, behind
    // the status bar. The CSS side handles the safe-area inset via
    // env(safe-area-inset-top) inside TourItTopBar / FeedTopBar, so the
    // green header gradient runs ALL the way up under the notch instead of
    // leaving a dark (or white) band above it. "always" was producing a
    // visible band on every non-home page.
    contentInset: "never",
    backgroundColor: "#07100a",
    preferredContentMode: "mobile",
    // AppDelegate.swift force-disables WKWebView's scrollView.bounces so
    // there's no "scroll past the top" rubber-band that doesn't exist in
    // real native apps.
  },

  android: {
    backgroundColor: "#07100a",
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    Geolocation: {
      // iOS prompts are configured in Info.plist (set during cap add ios)
    },

    Camera: {
      // Permissions configured natively
    },

    SplashScreen: {
      // Hold the splash for at least 3 seconds so the WebView has time to
      // fully render the home screen before we hand off to it. The web side
      // also waits 3s before calling hide() — both sides agree on the floor.
      // Auto-hide at 5s acts as a final safety net if JS never loads.
      launchShowDuration: 5000,
      launchAutoHide: true,
      // Splash bg matches the app's dark brand color so the launch image and
      // the first-paint background are visually identical (no white flash).
      backgroundColor: "#07100a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      // Spinner removed — it overlapped the wordmark and looked ugly. The
      // splash image alone reads as a clear loading state.
      showSpinner: false,
    },

    StatusBar: {
      style: "Dark", // light text on dark background (#07100a)
      backgroundColor: "#07100a",
      overlaysWebView: true, // full-screen video feed goes edge to edge
    },
  },
};

export default config;

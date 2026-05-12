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

  // White background everywhere so the WebView's pre-paint state on iPad is
  // never the black void that triggered the App Store Review rejection.
  // The web app's own background reapplies once content loads.
  backgroundColor: "#ffffff",

  ios: {
    contentInset: "always", // web content fills behind status bar
    backgroundColor: "#ffffff",
    preferredContentMode: "mobile",
  },

  android: {
    backgroundColor: "#ffffff",
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
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      iosSpinnerStyle: "small",
      spinnerColor: "#4da862",
    },

    StatusBar: {
      style: "Dark", // light text on dark background (#07100a)
      backgroundColor: "#07100a",
      overlaysWebView: true, // full-screen video feed goes edge to edge
    },
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tourit.app",
  appName: "Tour It",
  webDir: "out",

  // Live server — loads the Vercel deployment inside the WebView.
  // Remove this block for a fully bundled static build.
  server: {
    url: "https://tour-it.vercel.app",
    cleartext: false, // HTTPS only
  },

  backgroundColor: "#07100a",

  ios: {
    contentInset: "always", // web content fills behind status bar
    backgroundColor: "#07100a",
    preferredContentMode: "mobile",
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
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#07100a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
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

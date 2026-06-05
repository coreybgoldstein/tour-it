import type { Metadata, Viewport } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import TourItTopBar from "@/components/TourItTopBar";
import HideSplash from "@/components/HideSplash";
import NativeBootstrap from "@/components/NativeBootstrap";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppDownloadBanner from "@/components/AppDownloadBanner";
import KeyboardSync from "@/components/KeyboardSync";
import ToastHost from "@/components/ToastHost";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CANONICAL_HOST, DEFAULT_OG_IMAGE, websiteSchema, organizationSchema, jsonLdScript } from "@/lib/seo";
// b512: import commented out with the unmounted overlay below to avoid
// an unused-import lint error. Component file kept in repo — uncomment
// both lines to restore on-device diagnostics.
// import DebugEventOverlay from "@/components/DebugEventOverlay";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // iOS Safari paints the area behind the notch/status bar using theme-color.
  // Matches the green TopBar gradient so the green visually extends to the
  // very top of the screen on every page.
  themeColor: "#1c4425",
};

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_HOST),
  title: { default: "Tour It — Scout Before You Play", template: "%s | Tour It" },
  description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
  alternates: { canonical: CANONICAL_HOST },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // Google Search Console verification — wired with BOTH methods so
  // ownership verifies regardless of which one Corey clicks in the
  // Search Console UI:
  //   - HTML file:  public/google16842fb000b55941.html
  //   - HTML tag:   emitted by this `verification.google` entry as
  //                 <meta name="google-site-verification" content="…">
  // Either path is sufficient; Google accepts the first one it can
  // confirm. Keep both so removing one doesn't break verification.
  verification: {
    google: "j-ehMKQ7bIqhc7TRk3sGT4AqMd6oNd_K6_EJTqCPvnU",
  },
  openGraph: {
    title: "Tour It — Scout Before You Play",
    description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
    url: CANONICAL_HOST,
    siteName: "Tour It",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 780, height: 370, alt: "Tour It — Scout Before You Play" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tour It — Scout Before You Play",
    description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${outfit.variable} antialiased`}>
        {/* Site-wide JSON-LD — WebSite + SearchAction lets Google render
            the search box in results; Organization enables a Knowledge
            Panel for the Tour It brand once we link social profiles. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript([websiteSchema(), organizationSchema()]) }}
        />
        <HideSplash />
        <NativeBootstrap />
        <ServiceWorkerRegister />
        <AppDownloadBanner />
        <KeyboardSync />
        <ToastHost />
        {/* b512: debug overlay unmounted for ship candidate. Dark-screen bug
            confirmed fixed in b511, flicker fix added in b512. Re-mount this
            line to restore on-device diagnostics if needed. */}
        {/* <DebugEventOverlay /> */}
        <TourItTopBar />
        {/* NotificationBell intentionally NOT rendered here — TourItTopBar
            now has the bell embedded. The component file is preserved for
            re-use on pages where the top bar is hidden. */}
        {children}
        {/* Vercel Web Analytics — visitor counts, top pages, countries,
            devices. No cookies, privacy-friendly. Requires that you also
            flip the toggle in the Vercel dashboard
            (Project → Analytics → Enable Web Analytics) for the data to
            start flowing. The script auto-skips when not running on
            Vercel infra. */}
        <Analytics />
        {/* Vercel Speed Insights — Core Web Vitals (LCP, INP, CLS)
            sampled from real user sessions. Same dashboard toggle
            required. Same script-skip behavior off-Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
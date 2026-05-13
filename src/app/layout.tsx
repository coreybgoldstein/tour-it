import type { Metadata, Viewport } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";
import TourItTopBar from "@/components/TourItTopBar";
import HideSplash from "@/components/HideSplash";
import NativeBootstrap from "@/components/NativeBootstrap";

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
  title: "Tour It — Scout Before You Play",
  description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Tour It — Scout Before You Play",
    description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
    url: "https://touritgolf.com",
    siteName: "Tour It",
    type: "website",
    images: [{ url: "https://touritgolf.com/og-image.png", width: 780, height: 370, alt: "Tour It — Scout Before You Play" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tour It — Scout Before You Play",
    description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
    images: ["https://touritgolf.com/og-image.png"],
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
        <HideSplash />
        <NativeBootstrap />
        <TourItTopBar />
        {/* NotificationBell intentionally NOT rendered here — TourItTopBar
            now has the bell embedded. The component file is preserved for
            re-use on pages where the top bar is hidden. */}
        {children}
      </body>
    </html>
  );
}
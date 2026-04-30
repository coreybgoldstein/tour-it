import type { Metadata, Viewport } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";
import NotificationBell from "@/components/NotificationBell";

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
        <NotificationBell />
        {children}
      </body>
    </html>
  );
}
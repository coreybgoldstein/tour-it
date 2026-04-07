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
  description: "Preview any golf course, one hole at a time. Real videos and tips from golfers who've already played it.",
  openGraph: {
    title: "Tour It — Scout Before You Play",
    description: "Preview any golf course, one hole at a time. Real videos and tips from golfers who've already played it.",
    url: "https://tour-it.vercel.app",
    siteName: "Tour It",
    type: "website",
    images: [{ url: "https://tour-it.vercel.app/tour-it-logo-new.png", width: 600, height: 300, alt: "Tour It" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tour It — Scout Before You Play",
    description: "Preview any golf course, one hole at a time. Real videos and tips from golfers who've already played it.",
    images: ["https://tour-it.vercel.app/tour-it-logo-new.png"],
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
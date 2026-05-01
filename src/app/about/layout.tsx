import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Tour It",
  description: "Built for those who golf. By those who golf. Tour It is the scouting platform built by the golf community.",
  openGraph: {
    title: "About · Tour It",
    description: "Built for those who golf. By those who golf. Tour It is the scouting platform built by the golf community.",
    siteName: "Tour It",
    type: "website",
    // TODO: swap in a real Tour It hole/course screenshot at /public/og-about.jpg (1200×630)
    // images: [{ url: "/og-about.jpg", width: 1200, height: 630, alt: "Tour It — Scout Before You Play" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About · Tour It",
    description: "Built for those who golf. By those who golf.",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

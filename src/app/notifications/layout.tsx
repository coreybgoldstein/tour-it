import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications — Tour It",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

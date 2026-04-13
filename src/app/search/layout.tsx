import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Courses — Tour It",
  description: "Find any golf course on Tour It. Search by name, city, or state to browse hole-by-hole clips and intel.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

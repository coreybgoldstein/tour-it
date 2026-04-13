import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("Course")
    .select("name, city, state, coverImageUrl, logoUrl")
    .eq("id", id)
    .single();

  if (!data) return {};

  const location = [data.city, data.state].filter(Boolean).join(", ");
  const title = `${data.name} — Hole by Hole Preview | Tour It`;
  const description = `Scout ${data.name}${location ? ` in ${location}` : ""} before you play. Watch real hole-by-hole videos and tips from golfers who've already played it.`;
  const image = (data as any).coverImageUrl || (data as any).logoUrl || "https://touritgolf.com/tour-it-logo-new.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://touritgolf.com/courses/${id}`,
      siteName: "Tour It",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: `${data.name} golf course` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    alternates: { canonical: `https://touritgolf.com/courses/${id}` },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

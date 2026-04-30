import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string; number: string }> }): Promise<Metadata> {
  const { id, number } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("Course")
    .select("name, city, state, coverImageUrl, logoUrl")
    .eq("id", id)
    .single();

  if (!data) return {};

  const location = [data.city, data.state].filter(Boolean).join(", ");
  const holeLabel = `Hole ${number}`;
  const title = `${data.name} — ${holeLabel} | Tour It`;
  const description = `Watch real clips of ${holeLabel} at ${data.name}${location ? ` in ${location}` : ""}. Scout the hole before you play.`;
  const image = (data as any).coverImageUrl || (data as any).logoUrl || "https://touritgolf.com/og-image.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://touritgolf.com/courses/${id}/holes/${number}`,
      siteName: "Tour It",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: `${data.name} ${holeLabel}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    alternates: { canonical: `https://touritgolf.com/courses/${id}/holes/${number}` },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

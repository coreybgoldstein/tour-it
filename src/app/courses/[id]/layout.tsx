import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("Course")
    .select("name, city, state")
    .eq("id", id)
    .single();

  if (!data) return {};

  const location = [data.city, data.state].filter(Boolean).join(", ");
  const title = `${data.name} — Tour It`;
  const description = `Scout ${data.name}${location ? ` in ${location}` : ""} before you play. Hole-by-hole clips, tips, and intel from real golfers.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

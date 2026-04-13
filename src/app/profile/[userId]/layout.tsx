import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("User")
    .select("username, displayName")
    .eq("id", userId)
    .single();

  if (!data) return {};

  const name = data.displayName || data.username;
  const title = `${name} (@${data.username}) — Tour It`;
  const description = `See ${name}'s golf clips and course intel on Tour It.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

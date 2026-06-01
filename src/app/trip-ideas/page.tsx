import Link from "next/link";
import type { Metadata } from "next";
import { createClient as createAdminSb } from "@supabase/supabase-js";
import { cdnImage } from "@/lib/cdnImage";

export const metadata: Metadata = {
  title: "Trip Ideas — Tour It",
  description: "Browse golf trip itineraries — curated multi-day routes by region, season, and budget.",
};

type IdeaLite = {
  slug: string;
  name: string;
  tagline: string;
  heroImageUrl: string | null;
  region: string;
  durationDays: number;
  costBand: string;
};

function adminClient() {
  return createAdminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function fetchIdeas(): Promise<IdeaLite[]> {
  const sb = adminClient();
  const { data } = await sb
    .from("TripItinerary")
    .select("slug, name, tagline, heroImageUrl, region, durationDays, costBand")
    .order("region", { ascending: true });
  return (data as IdeaLite[]) ?? [];
}

export default async function TripIdeasIndex() {
  const ideas = await fetchIdeas();

  return (
    <div style={{ background: "#07100a", minHeight: "100svh", color: "#fff", paddingBottom: 120 }}>
      <header style={{ position: "relative", padding: "max(env(safe-area-inset-top, 0px), 12px) 20px 18px", background: "radial-gradient(ellipse at 50% 0%, rgba(45,122,66,0.18) 0%, transparent 65%), #07100a" }}>
        <Link
          href="/tour"
          aria-label="Back"
          style={{ position: "absolute", top: "max(env(safe-area-inset-top, 0px), 16px)", left: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(7,16,10,0.6)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <div style={{ height: 48 }} aria-hidden />
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 }}>Trip Ideas</h1>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.6)", margin: "6px 0 0" }}>Curated multi-day golf routes by region, season, and budget.</p>
      </header>

      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {ideas.map((i) => (
          <Link
            key={i.slug}
            href={`/trip-ideas/${i.slug}`}
            style={{ background: "#0c1c13", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", textDecoration: "none" }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
              {i.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cdnImage(i.heroImageUrl)} alt={i.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, rgba(45,122,66,0.4), rgba(7,16,10,0.9))" }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(7,16,10,0.85))" }} />
              <div style={{ position: "absolute", left: 8, top: 8, fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, color: "rgba(244,236,214,0.85)", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(244,236,214,0.18)" }}>{i.region}</div>
              <div style={{ position: "absolute", right: 8, top: 8, fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, color: "rgba(244,236,214,0.85)", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(244,236,214,0.18)" }}>{i.durationDays}D · {i.costBand}</div>
            </div>
            <div style={{ padding: "10px 12px 12px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>{i.name}</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.tagline}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

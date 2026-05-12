import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

// Public landing page for a shared round. Lives at /round/[id] so we can
// expose rich OG meta (og:image points at the beauty PNG) — iMessage / SMS /
// social previews auto-render that image without us having to attach a file.
// The page itself is server-side rendered with no auth so social crawlers
// can fetch it, but human visitors are forwarded to the regular trip page.

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.touritgolf.com";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtTime12(t: string | null | undefined): string | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
}

async function loadRound(id: string) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const [tripRes, tcRes] = await Promise.all([
    sb.from("GolfTrip").select("id, name, startDate").eq("id", id).maybeSingle(),
    sb.from("GolfTripCourse").select("courseId, playDate, teeTime").eq("tripId", id),
  ]);
  const trip = tripRes.data;
  const tc = tcRes.data?.[0];
  if (!trip) return null;
  let courseName: string | null = null;
  if (tc?.courseId) {
    const { data: course } = await sb.from("Course").select("name").eq("id", tc.courseId).maybeSingle();
    courseName = course?.name ?? null;
  }
  const dateLine = fmtDate(tc?.playDate || trip.startDate);
  const time = fmtTime12(tc?.teeTime);
  return { trip, courseName, dateLine, time };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const round = await loadRound(id);
  const courseName = round?.courseName ?? round?.trip.name ?? "Tour It";
  const subtitle = round?.dateLine
    ? `${round.dateLine}${round.time ? ` · Tee off at ${round.time}` : ""}`
    : "Scout Before You Play";
  const title = `Round at ${courseName}`;
  const description = `${subtitle} — view on Tour It`;
  const imageUrl = `${SITE_URL}/api/round/${id}/beauty`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/round/${id}`,
      siteName: "Tour It",
      images: [{ url: imageUrl, width: 1080, height: 1350, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RoundLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Forward humans to the trip page so they get the real app experience.
  // Social/SMS crawlers stop after reading the metadata above.
  redirect(`/trips/${id}`);
}

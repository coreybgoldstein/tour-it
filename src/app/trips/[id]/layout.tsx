import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const monthShort = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  const year = (d: Date) => d.getUTCFullYear();

  if (!end) return `${monthShort(s)} ${day(s)}, ${year(s)}`;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return `${monthShort(s)} ${day(s)}, ${year(s)}`;

  if (year(s) === year(e) && monthShort(s) === monthShort(e)) {
    return `${monthShort(s)} ${day(s)}–${day(e)}, ${year(s)}`;
  }
  if (year(s) === year(e)) {
    return `${monthShort(s)} ${day(s)} – ${monthShort(e)} ${day(e)}, ${year(s)}`;
  }
  return `${monthShort(s)} ${day(s)}, ${year(s)} – ${monthShort(e)} ${day(e)}, ${year(e)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("GolfTrip")
    .select("name, description, startDate, endDate, imageUrl")
    .eq("id", id)
    .single();

  if (!trip) return {};

  const [{ data: tripCourses }, { count: memberCount }] = await Promise.all([
    supabase
      .from("GolfTripCourse")
      .select("courseId, sortOrder, playDate")
      .eq("tripId", id)
      .order("sortOrder", { ascending: true }),
    supabase
      .from("GolfTripMember")
      .select("*", { count: "exact", head: true })
      .eq("tripId", id),
  ]);

  const courseIds = Array.from(new Set((tripCourses ?? []).map((tc) => tc.courseId)));
  const courseCount = courseIds.length;

  // Pull cover image from the first course as a fallback if trip has no imageUrl
  let courseCoverImage: string | null = null;
  if (!trip.imageUrl && courseIds.length > 0) {
    const { data: firstCourse } = await supabase
      .from("Course")
      .select("coverImageUrl, logoUrl")
      .eq("id", courseIds[0])
      .single();
    courseCoverImage = (firstCourse as { coverImageUrl?: string | null; logoUrl?: string | null } | null)?.coverImageUrl
      ?? (firstCourse as { coverImageUrl?: string | null; logoUrl?: string | null } | null)?.logoUrl
      ?? null;
  }

  const image = trip.imageUrl || courseCoverImage || "https://touritgolf.com/og-image.png";

  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const parts: string[] = [];
  if (courseCount > 0) parts.push(`${courseCount} ${courseCount === 1 ? "course" : "courses"}`);
  if ((memberCount ?? 0) > 0) parts.push(`${memberCount} ${memberCount === 1 ? "golfer" : "golfers"}`);
  if (dateRange) parts.push(dateRange);

  const teaser = parts.join(" · ");
  const description = trip.description?.trim()
    ? `${teaser}${teaser ? " — " : ""}${trip.description.trim()}`
    : teaser || "A golf trip on Tour It.";

  const title = `${trip.name} — Tour It`;
  const url = `https://touritgolf.com/trips/${id}`;

  return {
    title,
    description,
    openGraph: {
      title: trip.name,
      description,
      url,
      siteName: "Tour It",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: trip.name }],
    },
    twitter: { card: "summary_large_image", title: trip.name, description, images: [image] },
    alternates: { canonical: url },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

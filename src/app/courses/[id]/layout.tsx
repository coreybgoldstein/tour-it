import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  CANONICAL_HOST,
  SITE_NAME,
  canonical,
  golfCourseSchema,
  breadcrumbSchema,
  jsonLdScript,
} from "@/lib/seo";

// React's `cache()` dedupes the Supabase fetch between generateMetadata
// (which Next.js calls during head rendering) and the layout's render
// (which uses the same data for JSON-LD). Without this we'd issue two
// identical queries for every course-page request.
const getCourse = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("Course")
    .select("id, name, description, city, state, zipCode, latitude, longitude, coverImageUrl, logoUrl, websiteUrl, yearEstablished, courseType")
    .eq("id", id)
    .single();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getCourse(id);
  if (!data) return {};

  const location = [data.city, data.state].filter(Boolean).join(", ");
  const title = `${data.name} — Hole by Hole Preview | ${SITE_NAME}`;
  const description = data.description
    ? data.description.length > 160 ? data.description.slice(0, 157) + "..." : data.description
    : `Scout ${data.name}${location ? ` in ${location}` : ""} before you play. Watch real hole-by-hole videos and tips from golfers who've already played it.`;
  const url = canonical(`/courses/${id}`);

  // og:image + twitter:image are emitted automatically by the
  // sibling opengraph-image.tsx file convention. Do not duplicate
  // them here — Next.js would emit two competing <meta> tags and
  // social platforms cache whichever they see first.
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);

  const jsonLd = course
    ? [
        golfCourseSchema(course),
        breadcrumbSchema([
          { name: "Tour It", url: CANONICAL_HOST },
          { name: "Courses", url: canonical("/search") },
          { name: course.name, url: canonical(`/courses/${id}`) },
        ]),
      ]
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}

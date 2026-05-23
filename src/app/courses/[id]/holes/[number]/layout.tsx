import type { Metadata } from "next";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  CANONICAL_HOST,
  SITE_NAME,
  canonical,
  breadcrumbSchema,
  jsonLdScript,
} from "@/lib/seo";

const getHolePageData = cache(async (courseId: string, holeNumber: number) => {
  const supabase = await createClient();
  // Single round-trip — pull course + the specific hole's metadata.
  const [{ data: course }, { data: hole }] = await Promise.all([
    supabase.from("Course").select("id, name, city, state, coverImageUrl, logoUrl").eq("id", courseId).single(),
    supabase.from("Hole").select("id, holeNumber, par, yardage").eq("courseId", courseId).eq("holeNumber", holeNumber).maybeSingle(),
  ]);
  return { course, hole };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string; number: string }> }): Promise<Metadata> {
  const { id, number } = await params;
  const holeNum = parseInt(number, 10);
  if (isNaN(holeNum)) return {};
  const { course, hole } = await getHolePageData(id, holeNum);
  if (!course) return {};

  const location = [course.city, course.state].filter(Boolean).join(", ");
  const holeLabel = `Hole ${number}`;
  const parYards = hole ? [hole.par ? `par ${hole.par}` : null, hole.yardage ? `${hole.yardage} yds` : null].filter(Boolean).join(", ") : "";
  const title = `${course.name} — ${holeLabel}${parYards ? ` (${parYards})` : ""} | ${SITE_NAME}`;
  const description = `Watch real clips of ${holeLabel} at ${course.name}${location ? ` in ${location}` : ""}. Scout the hole before you play.`;
  const url = canonical(`/courses/${id}/holes/${number}`);

  // og:image + twitter:image are inherited from the parent course
  // segment's opengraph-image.tsx (Next.js applies file-convention
  // metadata to all routes within a segment). Don't emit images
  // here — would produce duplicate competing meta tags.
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string; number: string }> }) {
  const { id, number } = await params;
  const holeNum = parseInt(number, 10);
  if (isNaN(holeNum)) return <>{children}</>;
  const { course } = await getHolePageData(id, holeNum);

  const jsonLd = course
    ? breadcrumbSchema([
        { name: "Tour It", url: CANONICAL_HOST },
        { name: "Courses", url: canonical("/search") },
        { name: course.name, url: canonical(`/courses/${id}`) },
        { name: `Hole ${number}`, url: canonical(`/courses/${id}/holes/${number}`) },
      ])
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

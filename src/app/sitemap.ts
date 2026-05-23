import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { CANONICAL_HOST } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = CANONICAL_HOST;

  try {
    const supabase = await createClient();

    // All public courses
    const { data: courses } = await supabase
      .from("Course")
      .select("id, updatedAt")
      .eq("isPublic", true);

    // Holes that have at least one upload — fetch uploads with holeId
    const { data: uploads } = await supabase
      .from("Upload")
      .select("holeId, courseId, createdAt")
      .not("holeId", "is", null)
      .order("createdAt", { ascending: false });

    // Build a set of holeIds with uploads so we can filter the Hole
    // table down to only the ones actually worth crawling.
    const uploadHoleIds = new Set((uploads || []).map((u) => u.holeId));
    const courseIds = [...new Set((uploads || []).map((u) => u.courseId))];

    // NOTE: Hole schema field is `holeNumber`, not `number`. Earlier
    // sitemap version selected `number` which silently came back
    // undefined, generating URLs like /courses/.../holes/undefined.
    // Verified against prisma/schema.prisma:252.
    const { data: holes } = courseIds.length
      ? await supabase
          .from("Hole")
          .select("id, holeNumber, courseId, updatedAt")
          .in("courseId", courseIds)
      : { data: [] };

    const holesWithContent = (holes || []).filter((h) => uploadHoleIds.has(h.id));

    const courseUrls: MetadataRoute.Sitemap = (courses || []).map((c) => ({
      url: `${baseUrl}/courses/${c.id}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }));

    const holeUrls: MetadataRoute.Sitemap = holesWithContent.map((h) => ({
      url: `${baseUrl}/courses/${h.courseId}/holes/${h.holeNumber}`,
      lastModified: h.updatedAt ? new Date(h.updatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/search`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      },
      ...courseUrls,
      ...holeUrls,
    ];
  } catch (err) {
    console.error("[sitemap] error:", err);
    // Return minimal sitemap on error so we don't 500 the route
    // (Google will retry; better to serve the homepage than nothing).
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
      { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    ];
  }
}

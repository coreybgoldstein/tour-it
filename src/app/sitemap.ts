import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://touritgolf.com";

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

    // Deduplicate to unique courseId + holeNumber combos
    // We need hole number — fetch holes for courses that have uploads
    const courseIds = [...new Set((uploads || []).map((u) => u.courseId))];
    const { data: holes } = courseIds.length
      ? await supabase
          .from("Hole")
          .select("id, number, courseId, updatedAt")
          .in("courseId", courseIds)
      : { data: [] };

    // Build a set of holeIds that have uploads
    const uploadHoleIds = new Set((uploads || []).map((u) => u.holeId));
    const holesWithContent = (holes || []).filter((h) => uploadHoleIds.has(h.id));

    const courseUrls: MetadataRoute.Sitemap = (courses || []).map((c) => ({
      url: `${baseUrl}/courses/${c.id}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }));

    const holeUrls: MetadataRoute.Sitemap = holesWithContent.map((h) => ({
      url: `${baseUrl}/courses/${h.courseId}/holes/${h.number}`,
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
    // Return minimal sitemap on error
    return [
      { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
      { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    ];
  }
}

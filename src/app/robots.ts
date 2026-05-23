import { MetadataRoute } from "next";
import { CANONICAL_HOST } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Courses and the search surface are the discovery layer we
        // want indexed; the home feed (root) is also fine since the
        // hero / Popular / Near Me rails give crawlers useful entry
        // points into the course graph.
        allow: ["/", "/courses/", "/search", "/leaderboards", "/about", "/privacy", "/terms"],
        disallow: [
          "/profile",
          "/upload",
          "/trips",
          "/lists",
          "/notifications",
          "/onboarding",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/admin",
          "/api/",
          "/settings",
        ],
      },
    ],
    sitemap: `${CANONICAL_HOST}/sitemap.xml`,
    host: CANONICAL_HOST,
  };
}

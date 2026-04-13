import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/courses/", "/search"],
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
    sitemap: "https://touritgolf.com/sitemap.xml",
  };
}

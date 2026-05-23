/**
 * Single source of truth for SEO-relevant constants + JSON-LD helpers.
 *
 * Canonical URL: we standardize on the www subdomain because that's
 * where the live site actually resolves (apex → www 307 redirect on
 * Vercel) and where the Capacitor iOS WebView's server.url points.
 * Mixing apex and www in og:url / sitemap / canonical was splitting
 * Google's signals between the two hostnames.
 */
export const CANONICAL_HOST = "https://www.touritgolf.com";

export const SITE_NAME = "Tour It";

/** Build a fully-qualified canonical URL for a relative path. */
export function canonical(pathOrEmpty: string): string {
  if (!pathOrEmpty || pathOrEmpty === "/") return CANONICAL_HOST;
  const p = pathOrEmpty.startsWith("/") ? pathOrEmpty : `/${pathOrEmpty}`;
  return `${CANONICAL_HOST}${p}`;
}

/** Default OG image used when a page doesn't have its own. */
export const DEFAULT_OG_IMAGE = `${CANONICAL_HOST}/og-image.png`;

// ─── JSON-LD builders ────────────────────────────────────────────────

/**
 * schema.org WebSite — declares the search box action so Google can
 * render Tour It's search bar directly in search results.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: CANONICAL_HOST,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${CANONICAL_HOST}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * schema.org Organization — pairs with the WebSite schema so the
 * Knowledge Panel can render the Tour It brand with logo + sameAs
 * social links once we link them.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: CANONICAL_HOST,
    logo: `${CANONICAL_HOST}/icon.png`,
    description: "Scout any golf course before you play. Real hole-by-hole clips from golfers who've been there.",
  };
}

/**
 * schema.org GolfCourse — eligible for rich Place / LocalBusiness
 * results. Includes geo + address when available.
 */
export interface GolfCourseInput {
  id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  yearEstablished?: number | null;
  courseType?: string | null;
}

export function golfCourseSchema(course: GolfCourseInput) {
  const url = canonical(`/courses/${course.id}`);
  const image = course.coverImageUrl || course.logoUrl || DEFAULT_OG_IMAGE;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "GolfCourse",
    "@id": url,
    name: course.name,
    url,
    image,
  };
  if (course.description) node.description = course.description;
  if (course.websiteUrl) node.sameAs = [course.websiteUrl];
  if (course.yearEstablished) node.foundingDate = String(course.yearEstablished);
  if (course.city || course.state || course.zipCode) {
    node.address = {
      "@type": "PostalAddress",
      addressCountry: "US",
      ...(course.city ? { addressLocality: course.city } : {}),
      ...(course.state ? { addressRegion: course.state } : {}),
      ...(course.zipCode ? { postalCode: course.zipCode } : {}),
    };
  }
  if (course.latitude != null && course.longitude != null) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: course.latitude,
      longitude: course.longitude,
    };
  }
  // openingHoursSpecification could go here if we ever store hours.
  return node;
}

/**
 * schema.org BreadcrumbList — used on course + hole pages so Google
 * can render the hierarchy (Home › Courses › Pine Valley › Hole 7).
 */
export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Helper: inline JSON-LD as a script tag with the right content-type.
 * Use as `<JsonLd data={golfCourseSchema(course)} />` inside a server
 * component / layout.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data);
}

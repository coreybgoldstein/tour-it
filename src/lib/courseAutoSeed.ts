// Best-effort auto-seeder for course logo + cover image. Fires when a clip
// is uploaded to an under-seeded course AND on a daily cron sweep over the
// backlog. Sources are tried in order of reliability; the first success
// wins. Every image is downloaded and re-uploaded to Supabase Storage —
// we never store external URLs in the DB.
//
// LIMITATIONS (intentional for v1)
//   • Logo + cover only. Description / year / zip are skipped because they
//     can't be sourced accurately without paid APIs or LLM scraping —
//     left to the human Contribute flow which earns points.
//   • Best-effort. ~40-50% hit rate expected on the long tail of courses.
//     Failures are silent — the field just stays NULL until a manual seed
//     or the next cron sweep.
//
// Used by:
//   src/app/api/courses/[id]/auto-seed/route.ts   (on-upload trigger)
//   src/app/api/cron/auto-seed-courses/route.ts   (daily sweep)

import { createClient } from "@supabase/supabase-js";

const UA = "Mozilla/5.0 (compatible; tour-it-autoseed/1.0)";
const BUCKET = "tour-it-photos";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Sanitize a course name into a BlueGolf-style slug. */
function bluegolfSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function tryFetchBytes(url: string, contentTypePrefix?: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (contentTypePrefix && !ct.startsWith(contentTypePrefix)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 1024) return null; // junk / placeholder
    return { bytes, contentType: ct || (contentTypePrefix === "image/" ? "image/jpeg" : "application/octet-stream") };
  } catch {
    return null;
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Scrape og:image and apple-touch-icon / favicon links from an HTML page.
 * Returns absolute URLs ready to fetch. Throws on network failure.
 */
async function scrapeHtmlImages(pageUrl: string): Promise<{ ogImage: string | null; favicon: string | null }> {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ogImage: null, favicon: null };
  const html = await res.text();
  const absolutize = (u: string): string => {
    try { return new URL(u, pageUrl).toString(); } catch { return u; }
  };
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const iconMatch = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]+href=["']([^"']+)["']/i)
                   ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:apple-touch-icon|icon)["']/i);
  return {
    ogImage: ogMatch ? absolutize(ogMatch[1]) : null,
    favicon: iconMatch ? absolutize(iconMatch[1]) : null,
  };
}

/**
 * Walk sources in order, return the first one that yields image bytes.
 * Each source is a function that returns the candidate URL (or null).
 */
async function findFirstImage(
  sources: Array<() => string | Promise<string | null> | null>
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  for (const src of sources) {
    try {
      const url = await src();
      if (!url) continue;
      const result = await tryFetchBytes(url, "image/");
      if (result) return result;
    } catch {
      // ignore and try next
    }
  }
  return null;
}

export interface AutoSeedResult {
  courseId: string;
  logoFilled: boolean;
  coverFilled: boolean;
  skippedReason?: string;
}

/**
 * Best-effort auto-seed for a single course. Idempotent — fields that are
 * already set are never overwritten. Safe to call repeatedly.
 */
export async function autoSeedCourse(courseId: string): Promise<AutoSeedResult> {
  const sb = service();
  const { data: course } = await sb
    .from("Course")
    .select("id, name, city, state, websiteUrl, logoUrl, coverImageUrl")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) return { courseId, logoFilled: false, coverFilled: false, skippedReason: "course-not-found" };

  // Only act when there's missing data — short-circuit to keep the cron
  // sweep cheap on already-seeded courses.
  const needsLogo = !course.logoUrl;
  const needsCover = !course.coverImageUrl;
  if (!needsLogo && !needsCover) {
    return { courseId, logoFilled: false, coverFilled: false, skippedReason: "already-complete" };
  }

  // Scrape the course's own website ONCE (if present) — both logo and
  // cover may resolve from the same scrape.
  let scraped: { ogImage: string | null; favicon: string | null } = { ogImage: null, favicon: null };
  if (course.websiteUrl) {
    try {
      scraped = await scrapeHtmlImages(course.websiteUrl);
    } catch {
      // ignore — fall through to other sources
    }
  }

  const patch: { logoUrl?: string; coverImageUrl?: string; updatedAt?: string } = {};

  // ── Logo ────────────────────────────────────────────────────────────────
  if (needsLogo) {
    const slug = bluegolfSlug(course.name);
    const logoResult = await findFirstImage([
      // 1. BlueGolf logo (well-known URL pattern; ~30% hit rate for
      //    US private/semi-private clubs)
      () => `https://logos.bluegolf.com/${slug}/profile.png`,
      // 2. Course's own apple-touch-icon / favicon (often the club crest)
      () => scraped.favicon,
    ]);
    if (logoResult) {
      const ext = extFromContentType(logoResult.contentType);
      const path = `course-images/${courseId}-logo.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, logoResult.bytes, {
        contentType: logoResult.contentType,
        upsert: true,
      });
      if (!error) {
        patch.logoUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
    }
  }

  // ── Cover image ────────────────────────────────────────────────────────
  if (needsCover) {
    const coverResult = await findFirstImage([
      // 1. Course site's og:image (designed-for-sharing → usually a
      //    wide hero shot of the course)
      () => scraped.ogImage,
    ]);
    if (coverResult) {
      const ext = extFromContentType(coverResult.contentType);
      const path = `course-images/${courseId}-cover.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, coverResult.bytes, {
        contentType: coverResult.contentType,
        upsert: true,
      });
      if (!error) {
        patch.coverImageUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = new Date().toISOString();
    await sb.from("Course").update(patch).eq("id", courseId);
  }

  return {
    courseId,
    logoFilled: !!patch.logoUrl,
    coverFilled: !!patch.coverImageUrl,
  };
}

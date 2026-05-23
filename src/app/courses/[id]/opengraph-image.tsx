import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { CANONICAL_HOST } from "@/lib/seo";

/**
 * Dynamic Open Graph image for course pages.
 *
 * Next.js's app-router file convention: this file at
 *   app/courses/[id]/opengraph-image.tsx
 * automatically generates an image at
 *   /courses/[id]/opengraph-image
 * and injects the matching <meta property="og:image"> +
 * <meta property="twitter:image"> tags into the course page's <head>.
 * No need to set openGraph.images in generateMetadata — file-based
 * wins.
 *
 * Layout:
 *   - Full-bleed course cover image as the background (falls back to
 *     a brand-dark gradient when no cover exists yet)
 *   - Dark vertical gradient overlay so text stays readable on any
 *     cover photo
 *   - Top-left: Tour It icon + wordmark
 *   - Bottom-left: course name in Playfair Display + city/state in
 *     Outfit, with adaptive font-size for long names
 *   - Bottom-right: course logo crest in a white tile (matches the
 *     ClipTopPill badge treatment used on every clip surface)
 *
 * Cached aggressively by Vercel's edge once generated. Social
 * platforms cache OG images for 7–30 days at their end too — if a
 * course cover is updated, use Facebook Sharing Debugger or Twitter
 * Card Validator to force a refresh on those platforms.
 */

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Tour It course preview";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Fetch a bundled static woff2 from this site's /public/fonts dir.
 *
 * We bundle Playfair Display 900 and Outfit 500 as single-weight
 * static woff2 files because Satori (which powers ImageResponse)
 * does NOT support variable fonts. The existing public/fonts/*.ttf
 * files are variable fonts used by the web app via next/font and
 * can't be passed to ImageResponse — they'd error with
 * "Unsupported OpenType". The -900.woff2 / -500.woff2 files are
 * single-instance statics downloaded from Fontsource.
 *
 * Same-origin fetch on the edge is cached at Vercel's CDN so this
 * costs ~1 RTT on first request per region and is free after.
 */
async function loadBundledFont(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${CANONICAL_HOST}${path}`);
    if (!res.ok) {
      console.warn(`[og-image] Font fetch failed: ${path} — status ${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[og-image] loadBundledFont threw for ${path}:`, err);
    return null;
  }
}

/**
 * Pre-fetch an external image and return it as a data: URI so Satori
 * never has to make its own network request at render time. Two
 * problems we're solving:
 *
 *  1. Satori's built-in image fetcher silently fails for images that
 *     take more than a few seconds to download. Rodeo Dunes' 579KB
 *     cover (vs ~250KB for the others) hit this limit and the whole
 *     OG response came back empty with "Can't load image" in logs.
 *  2. Embedding the bytes inline removes one variable on every cold
 *     render — once we've fetched the course row from Supabase, the
 *     image bytes ride along inside the same edge function.
 *
 * Uses AbortSignal.timeout for a 6s ceiling, returns null on failure
 * so the OG card falls back to the brand-gradient background.
 */
async function fetchImageAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn(`[og-image] Cover image fetch failed: status ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Base64-encode in chunks to avoid String.fromCharCode argument
    // overflow on very large images (~64K char arg limit on V8).
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch (err) {
    console.warn(`[og-image] fetchImageAsDataUri threw for ${url}:`, err);
    return null;
  }
}

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: course } = await sb()
    .from("Course")
    .select("name, city, state, coverImageUrl, logoUrl, courseType")
    .eq("id", id)
    .single();

  // Pre-fetch fonts, cover, and logo all in parallel. Done in one
  // Promise.all so they all share the function's wall-clock budget
  // instead of being serialised behind the DB hit above.
  const [playfairBold, outfitMedium, coverDataUri, logoDataUri] = await Promise.all([
    loadBundledFont("/fonts/PlayfairDisplay-900.ttf"),
    loadBundledFont("/fonts/Outfit-500.ttf"),
    fetchImageAsDataUri(course?.coverImageUrl ?? null),
    fetchImageAsDataUri(course?.logoUrl ?? null),
  ]);

  const name = course?.name ?? "Tour It";
  const location = [course?.city, course?.state].filter(Boolean).join(", ");
  // We hand Satori a base64 data: URI instead of the Supabase URL so
  // it never tries to fetch externally — its internal fetcher times
  // out on larger covers (~500KB+) and the whole response comes back
  // empty. If the pre-fetch failed, fall back to the brand gradient.
  const coverUrl = coverDataUri;
  const logoUrl = logoDataUri;

  // Long names need a smaller headline so they don't wrap into the
  // logo zone. Tested visually: 25+ chars at 68px gets tight.
  const nameFontSize = name.length > 32 ? 50 : name.length > 24 ? 58 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "linear-gradient(135deg, #0d2318 0%, #07100a 100%)",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {/* Course cover image (full-bleed). Falls back to the gradient
            we set on the outer container when not present. */}
        {coverUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Dark vertical gradient so the bottom-left text is always
            readable against any cover photo. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(7,16,10,0.35) 0%, rgba(7,16,10,0.55) 45%, rgba(7,16,10,0.93) 100%)",
          }}
        />

        {/* Top-left: Tour It icon + wordmark */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 13,
              background: "#fff",
              border: "1.5px solid rgba(255,255,255,0.25)",
              display: "flex",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${CANONICAL_HOST}/icon.png`}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 38,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            TOUR IT
          </div>
        </div>

        {/* Bottom-left: course name + location */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 56,
            right: logoUrl ? 210 : 56,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: nameFontSize,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.04,
              letterSpacing: "-0.015em",
            }}
          >
            {name}
          </div>
          {location && (
            <div
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 28,
                fontWeight: 500,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: "0.005em",
              }}
            >
              {location}
            </div>
          )}
        </div>

        {/* Bottom-right: course crest (when present) */}
        {logoUrl && (
          <div
            style={{
              position: "absolute",
              bottom: 60,
              right: 56,
              width: 130,
              height: 130,
              borderRadius: 22,
              background: "#fff",
              border: "3px solid rgba(255,255,255,0.30)",
              display: "flex",
              overflow: "hidden",
              boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
      </div>
    ),
    {
      ...size,
      // Only pass `fonts` when at least one loaded. Passing
      // `fonts: []` makes ImageResponse error with "No fonts are
      // loaded" — omitting the key entirely lets it fall back to
      // its built-in Inter font.
      ...buildFontsOption(playfairBold, outfitMedium),
    }
  );
}

function buildFontsOption(playfair: ArrayBuffer | null, outfit: ArrayBuffer | null) {
  const fonts: { name: string; data: ArrayBuffer; weight: 900 | 500; style: "normal" }[] = [];
  if (playfair) fonts.push({ name: "Playfair Display", data: playfair, weight: 900, style: "normal" });
  if (outfit) fonts.push({ name: "Outfit", data: outfit, weight: 500, style: "normal" });
  return fonts.length > 0 ? { fonts } : {};
}

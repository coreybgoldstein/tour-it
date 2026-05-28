import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { CANONICAL_HOST } from "@/lib/seo";
import { cdnImage } from "@/lib/cdnImage";

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
/**
 * Largest cover/logo we'll embed as a data URI. Satori's image
 * parser silently throws RangeError when handed JPEGs above this
 * range — even when the bytes are valid and we hand them inline as
 * a data URI. Below this size the parser is reliable. Above it,
 * the safer move is to skip the image entirely so the card falls
 * back to the brand-gradient design instead of returning an empty
 * 200 (which looks broken in iMessage / Slack previews).
 *
 * Long-term fix: compress course covers to <300KB at upload time so
 * this ceiling is moot. Tracked separately.
 */
const MAX_EMBED_BYTES = 400_000;

// Satori (the engine behind ImageResponse) can only decode JPEG and
// PNG. Handing it a WebP / AVIF / HEIC data URI doesn't error loudly —
// the whole render returns 200 OK with Content-Length: 0 and iMessage
// then falls back to the favicon-only compact preview. Polo Club Boca
// Raton — Club Course was the canary on 2026-05-23: its cover was
// uploaded as WebP via the contribute flow that bypasses optimizeCover.
const SATORI_SUPPORTED = new Set(["image/jpeg", "image/jpg", "image/png"]);

async function fetchImageAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn(`[og-image] Cover image fetch failed: status ${res.status}`);
      return null;
    }
    const declared = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (declared && declared > MAX_EMBED_BYTES) {
      console.warn(`[og-image] Skipping oversize cover (${declared}B > ${MAX_EMBED_BYTES}B): ${url}`);
      return null;
    }
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!SATORI_SUPPORTED.has(contentType)) {
      // Skip with a fallback to the brand-gradient background so the
      // OG card still ships SOMETHING readable instead of a 0-byte
      // response that iMessage interprets as "no preview available."
      console.warn(`[og-image] Skipping unsupported image format ${contentType}: ${url}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    // Double-check the actual body in case Content-Length was missing
    // or wrong — same ceiling applies to the bytes we'd embed.
    if (buf.byteLength > MAX_EMBED_BYTES) {
      console.warn(`[og-image] Skipping oversize cover (${buf.byteLength}B body > ${MAX_EMBED_BYTES}B): ${url}`);
      return null;
    }
    // Buffer is polyfilled in Vercel's edge runtime via Next.js.
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${base64}`;
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

  // Pre-fetch fonts, cover, course logo, and the Tour It wordmark
  // logo all in parallel so they share the function's wall-clock
  // budget instead of being serialised behind the DB hit above.
  const [playfairBold, outfitMedium, coverDataUri, logoDataUri, brandLogoDataUri] = await Promise.all([
    loadBundledFont("/fonts/PlayfairDisplay-900.ttf"),
    loadBundledFont("/fonts/Outfit-500.ttf"),
    fetchImageAsDataUri(course?.coverImageUrl ?? null),
    fetchImageAsDataUri(course?.logoUrl ?? null),
    // The unified pin + TOUR IT wordmark — single PNG used wherever
    // the brand needs to appear as one mark instead of icon+text.
    fetchImageAsDataUri(`${CANONICAL_HOST}/tour-it-logo-full.png`),
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

        {/* Top-left: unified Tour It brand mark (pin + TOUR IT wordmark
            in one PNG). Replaces the earlier white-tile icon + separate
            Playfair "TOUR IT" text which looked like two disconnected
            elements in iMessage previews. Sized to ~94px tall so the
            wordmark reads clearly without competing with the course
            name below. Falls back to a Playfair text wordmark if the
            brand-logo fetch fails so the card never ships unbranded. */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 56,
            display: "flex",
            alignItems: "center",
          }}
        >
          {brandLogoDataUri ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={brandLogoDataUri}
              alt=""
              style={{ height: 94, width: "auto" }}
            />
          ) : (
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 44,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              TOUR IT
            </div>
          )}
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
              src={cdnImage(logoUrl)}
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

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
 * Fetch a Google Font's woff2 bytes for use as an ImageResponse font.
 * Google Fonts varies its CSS response by User-Agent — a modern
 * Chrome UA forces it to serve woff2. A short `Mozilla/5.0` was
 * insufficient on the edge runtime (it returned a different CSS
 * shape my regex didn't catch, so fonts silently failed to load
 * and ImageResponse crashed with "No fonts are loaded").
 */
const FONT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&display=swap`;
    const cssRes = await fetch(url, { headers: { "User-Agent": FONT_UA } });
    if (!cssRes.ok) {
      console.warn(`[og-image] Google Fonts CSS fetch failed for ${family}:${weight} — status ${cssRes.status}`);
      return null;
    }
    const css = await cssRes.text();
    // Match any URL inside src: url(...) — Google's CSS sometimes
    // wraps URLs in quotes, sometimes not. Both shapes valid.
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?woff2['"]?\)/);
    if (!match) {
      console.warn(`[og-image] No woff2 src URL found in Google Fonts CSS for ${family}:${weight}`);
      return null;
    }
    const fontRes = await fetch(match[1].replace(/['"]/g, ""));
    if (!fontRes.ok) {
      console.warn(`[og-image] Font woff2 fetch failed for ${family}:${weight} — status ${fontRes.status}`);
      return null;
    }
    return await fontRes.arrayBuffer();
  } catch (err) {
    console.warn(`[og-image] loadGoogleFont threw for ${family}:${weight}:`, err);
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

  // Load brand fonts in parallel with the DB hit. Each falls back to
  // `null` silently if the Google Fonts fetch fails — ImageResponse
  // then uses its built-in sans-serif (Inter) for that span.
  const [playfairBold, outfitMedium] = await Promise.all([
    loadGoogleFont("Playfair Display", 900),
    loadGoogleFont("Outfit", 500),
  ]);

  const name = course?.name ?? "Tour It";
  const location = [course?.city, course?.state].filter(Boolean).join(", ");
  const coverUrl = course?.coverImageUrl ?? null;
  const logoUrl = course?.logoUrl ?? null;

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

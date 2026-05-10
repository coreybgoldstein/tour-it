#!/usr/bin/env node

/**
 * Image hunter — finds cover photos AND logos for courses with null fields.
 *
 * Searches:
 *   1. Google Custom Search (image search) — primary source
 *   2. Wikipedia REST summary API for the course's lead photo (cover only)
 *
 * Validates each candidate (fetch with browser UA, content-type check,
 * minimum size for covers), uploads the first success to Supabase Storage,
 * and writes the public URL to the DB.
 *
 * Usage:
 *   node src/scripts/hunt-images.mjs --ids "<id1>,<id2>"
 *   node src/scripts/hunt-images.mjs --slugs "<itinerary-slug>"  (every course in that itinerary)
 *   node src/scripts/hunt-images.mjs --missing-itinerary           (all itinerary courses with null images)
 *   node src/scripts/hunt-images.mjs --cover-only / --logo-only    (skip the other)
 *   node src/scripts/hunt-images.mjs --force                       (re-fetch even if a URL is set)
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const GKEY = process.env.GOOGLE_SEARCH_KEY;
const GCX = process.env.GOOGLE_CSE_ID;
if (!GKEY || !GCX) console.warn("⚠ GOOGLE_SEARCH_KEY/GOOGLE_CSE_ID missing — Google CSE searches will be skipped");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { ids: [], slugs: [], missingItinerary: false, force: false, coverOnly: false, logoOnly: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids" && args[i + 1]) out.ids = args[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
    if (args[i] === "--slugs" && args[i + 1]) out.slugs = args[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
    if (args[i] === "--missing-itinerary") out.missingItinerary = true;
    if (args[i] === "--force") out.force = true;
    if (args[i] === "--cover-only") out.coverOnly = true;
    if (args[i] === "--logo-only") out.logoOnly = true;
  }
  return out;
}

function isBlockedHost(u) {
  return /clubessential\.|getimage\.gif|\.aspx/i.test(u);
}

function extFromUrl(u) {
  const m = u.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}
function extFromContentType(ct, fb = "jpg") {
  if (!ct) return fb;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  return "jpg";
}

async function searchGoogle(query, mode /* "cover" | "logo" */) {
  if (!GKEY || !GCX) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GKEY);
  url.searchParams.set("cx", GCX);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "8");
  url.searchParams.set("safe", "active");
  if (mode === "cover") {
    url.searchParams.set("imgSize", "xlarge");
    url.searchParams.set("imgType", "photo");
  } else {
    url.searchParams.set("imgType", "clipart");
  }
  try {
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.items ?? [])
      .flatMap((it) => {
        const out = [];
        if (it.link && !isBlockedHost(it.link)) {
          out.push({ url: it.link, width: it.image?.width, height: it.image?.height, source: it.displayLink });
        }
        // gstatic proxy thumbnail — always fetchable, even when the source
        // CDN blocks hotlinking. Lower res but reliable.
        if (it.image?.thumbnailLink) {
          out.push({ url: it.image.thumbnailLink, width: it.image.thumbnailWidth, height: it.image.thumbnailHeight, source: `gstatic-thumb (${it.displayLink})` });
        }
        return out;
      });
  } catch { return []; }
}

async function searchWikipediaCover(courseName) {
  const slug = encodeURIComponent(courseName.replace(/ /g, "_"));
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
      headers: { "User-Agent": "TourItGolf/1.0 (https://touritgolf.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const src = j?.originalimage?.source ?? j?.thumbnail?.source ?? null;
    if (!src) return [];
    if (/\.(png|svg)(\?|$)/i.test(src)) return []; // Wikipedia leads in png/svg = logos
    return [{ url: src, width: j.originalimage?.width, height: j.originalimage?.height, source: "wikipedia" }];
  } catch { return []; }
}

async function fetchAndUpload(imageUrl, courseId, type) {
  try {
    const r = await fetch(imageUrl, {
      headers: { "User-Agent": UA, Accept: "image/*", Referer: "https://www.google.com/" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const ext = extFromUrl(imageUrl) || extFromContentType(ct);
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 2 * 1024) return null; // < 2KB almost always placeholder
    const path = `course-images/${courseId}-${type}.${ext}`;
    const { error } = await sb.storage.from("tour-it-photos").upload(path, new Uint8Array(buf), {
      contentType: ct,
      upsert: true,
    });
    if (error) return null;
    return sb.storage.from("tour-it-photos").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

async function huntCover(course) {
  const name = course.name;
  const cityState = `${course.city || ""} ${course.state || ""}`.trim();
  const queries = [
    `${name} ${cityState} golf course aerial`,
    `${name} ${cityState} golf course hole`,
    `${name} signature hole`,
  ];
  // Wikipedia first (free)
  const wiki = await searchWikipediaCover(name);
  // Then Google CSE
  const candidates = [...wiki];
  for (const q of queries) {
    const hits = await searchGoogle(q, "cover");
    candidates.push(...hits);
    if (candidates.length >= 6) break;
  }
  // De-dupe
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    const uploaded = await fetchAndUpload(c.url, course.id, "cover");
    if (uploaded) return { url: uploaded, source: c.source };
  }
  return null;
}

async function huntLogo(course) {
  const name = course.name;
  const cityState = `${course.city || ""} ${course.state || ""}`.trim();
  const queries = [
    `${name} ${cityState} golf logo`,
    `${name} golf club crest emblem`,
    `${name} logo`,
  ];
  const candidates = [];
  for (const q of queries) {
    const hits = await searchGoogle(q, "logo");
    candidates.push(...hits);
    if (candidates.length >= 8) break;
  }
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    // Logos are usually small — skip the size guard
    const uploaded = await fetchAndUpload(c.url, course.id, "logo");
    if (uploaded) return { url: uploaded, source: c.source };
  }
  return null;
}

async function main() {
  const args = parseArgs();
  let ids = [...args.ids];

  if (args.slugs.length > 0) {
    const { data: its } = await sb.from("TripItinerary").select("id").in("slug", args.slugs);
    if (its) {
      const itIds = its.map((i) => i.id);
      const { data: stops } = await sb.from("TripItineraryStop").select("courseId").in("itineraryId", itIds);
      ids.push(...(stops ?? []).map((s) => s.courseId));
    }
  }

  if (args.missingItinerary) {
    const { data: stops } = await sb.from("TripItineraryStop").select("courseId");
    ids.push(...(stops ?? []).map((s) => s.courseId));
  }

  ids = [...new Set(ids)];
  if (ids.length === 0) {
    console.log("No course ids supplied. Use --ids, --slugs, or --missing-itinerary.");
    process.exit(0);
  }

  const { data: courses } = await sb
    .from("Course")
    .select("id, name, city, state, coverImageUrl, logoUrl")
    .in("id", ids);
  if (!courses) {
    console.log("Course query failed.");
    process.exit(1);
  }

  console.log(`\n🖼  Image hunter — ${courses.length} courses\n`);
  const results = { coversFilled: 0, logosFilled: 0, coversFailed: 0, logosFailed: 0 };

  for (const c of courses) {
    const needCover = !args.logoOnly && (args.force || !c.coverImageUrl);
    const needLogo = !args.coverOnly && (args.force || !c.logoUrl);
    if (!needCover && !needLogo) {
      console.log(`⏭  ${c.name} — already complete`);
      continue;
    }
    console.log(`\n→ ${c.name} (${c.city}, ${c.state})`);

    if (needCover) {
      const found = await huntCover(c);
      if (found) {
        await sb.from("Course").update({ coverImageUrl: found.url, updatedAt: new Date().toISOString() }).eq("id", c.id);
        console.log(`  ✅ cover via ${found.source}`);
        results.coversFilled++;
      } else {
        console.log(`  ✗ cover — no candidates fetched cleanly`);
        results.coversFailed++;
      }
    }

    if (needLogo) {
      const found = await huntLogo(c);
      if (found) {
        await sb.from("Course").update({ logoUrl: found.url, updatedAt: new Date().toISOString() }).eq("id", c.id);
        console.log(`  ✅ logo via ${found.source}`);
        results.logosFilled++;
      } else {
        console.log(`  ✗ logo — no candidates fetched cleanly`);
        results.logosFailed++;
      }
    }

    // Be polite to APIs
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Covers filled: ${results.coversFilled}, failed: ${results.coversFailed}`);
  console.log(`Logos  filled: ${results.logosFilled}, failed: ${results.logosFailed}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

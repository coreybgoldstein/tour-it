#!/usr/bin/env node

/**
 * Tour It — Seed itinerary hero images from Wikipedia.
 *
 * For each of the 14 itineraries, fetches the Wikipedia REST API summary
 * for the headline destination, extracts the lead image URL, downloads it
 * (Wikipedia hot-links cleanly with a real User-Agent), uploads to Supabase
 * Storage, and writes the public URL to TripItinerary.heroImageUrl.
 *
 * Project rule honored: external URLs are NOT stored in the DB. Image is
 * always copied to the tour-it-photos bucket first.
 *
 * Run: node prisma/seed-itinerary-heros.mjs
 *      node prisma/seed-itinerary-heros.mjs --force   (re-do even if heroImageUrl already set)
 *      node prisma/seed-itinerary-heros.mjs --slug monterey-coast
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Mapping: itinerary slug → ordered list of Wikipedia page titles ────────
// Tries each page in order until one yields a lead image. Fallbacks lean
// toward region/landmark pages when course-specific pages don't have leads.
const HERO_PAGES = {
  "monterey-coast":               ["Pebble Beach Golf Links"],
  "bandon-dunes-marathon":        ["Pacific Dunes", "Bandon Dunes", "Bandon, Oregon"],
  "pinehurst-pilgrimage":         ["Pinehurst Resort"],
  "myrtle-beach-classic":         ["Myrtle Beach, South Carolina", "Pawleys Island, South Carolina"],
  "scottsdale-desert-run":        ["Scottsdale, Arizona", "WM Phoenix Open", "TPC Scottsdale"],
  "wisconsin-sand":               ["Whistling Straits"],
  "streamsong-experience":        ["Streamsong Resort", "Bowling Green, Florida"],
  "nebraska-sandhills":           ["Sand Hills (Nebraska)", "Sandhills", "Nebraska"],
  "northern-michigan-loop":       ["Arcadia, Michigan", "Sleeping Bear Dunes National Lakeshore", "Lake Michigan"],
  "pacific-northwest-underrated": ["Chambers Bay"],
  "long-island-loop":             ["Bethpage State Park", "2019 PGA Championship"],
  "chicago-publics":              ["Cog Hill Golf & Country Club"],
  "coastal-carolina-public":      ["Kiawah Island Golf Resort"],
  "texas-stretch":                ["PGA of America"],
};

const UA = "TourItGolf/1.0 (https://touritgolf.com; coreybgoldstein@gmail.com)";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { force: false, onlySlug: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--force") out.force = true;
    if (args[i] === "--slug" && args[i + 1]) out.onlySlug = args[i + 1];
  }
  return out;
}

function extFromUrl(u) {
  const m = u.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

async function fetchWikipediaImage(pageTitle) {
  // REST summary endpoint returns originalimage + thumbnail
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Wiki summary ${r.status} for "${pageTitle}"`);
  const j = await r.json();
  const src = j?.originalimage?.source ?? j?.thumbnail?.source ?? null;
  if (!src) throw new Error(`No image on Wikipedia page "${pageTitle}"`);
  // Prefer a wider crop if originalimage is huge — Wikipedia originals can be 4k+.
  // Use thumbnail if original is suspiciously narrow (portrait/square logo).
  const original = j.originalimage;
  if (original && original.width && original.height) {
    const ratio = original.width / original.height;
    if (ratio < 1.2 && j.thumbnail?.source) {
      // Prefer a landscape thumbnail variant if Wikipedia provides one
      return { url: j.thumbnail.source, width: j.thumbnail.width, ratio: j.thumbnail.width / j.thumbnail.height, page: j.title };
    }
    return { url: src, width: original.width, ratio, page: j.title };
  }
  return { url: src, page: j.title };
}

async function uploadToSupabase(imageUrl, slug) {
  const r = await fetch(imageUrl, { headers: { "User-Agent": UA, Accept: "image/*" } });
  if (!r.ok) throw new Error(`Image fetch ${r.status}: ${imageUrl.slice(0, 100)}`);
  const ct = r.headers.get("content-type") || "";
  const ext = extFromUrl(imageUrl);
  const buf = await r.arrayBuffer();
  const path = `course-images/itinerary-${slug}.${ext}`;
  const { error } = await sb.storage.from("tour-it-photos").upload(path, new Uint8Array(buf), {
    contentType: ct || `image/${ext}`,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  const { data } = sb.storage.from("tour-it-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function main() {
  const args = parseArgs();
  console.log("\n🖼  Tour It — Itinerary hero images from Wikipedia");
  console.log("===================================================\n");

  const { data: rows, error } = await sb
    .from("TripItinerary")
    .select("id, slug, name, heroImageUrl");
  if (error) throw error;

  const targets = rows.filter((r) => {
    if (args.onlySlug && r.slug !== args.onlySlug) return false;
    if (!HERO_PAGES[r.slug]) return false;
    if (!args.force && r.heroImageUrl) return false;
    return true;
  });

  console.log(`Targeting ${targets.length} of ${rows.length} itineraries\n`);

  const results = [];
  for (const it of targets) {
    const pages = HERO_PAGES[it.slug];
    let success = false;
    for (const page of pages) {
      process.stdout.write(`  ${it.slug.padEnd(30)} ← ${page.padEnd(46)} `);
      try {
        const wiki = await fetchWikipediaImage(page);
        const publicUrl = await uploadToSupabase(wiki.url, it.slug);
        const { error: upErr } = await sb
          .from("TripItinerary")
          .update({ heroImageUrl: publicUrl, updatedAt: new Date().toISOString() })
          .eq("id", it.id);
        if (upErr) throw upErr;
        console.log(`✅  ${publicUrl.slice(publicUrl.lastIndexOf("/") + 1)}`);
        results.push({ slug: it.slug, page, url: publicUrl, status: "ok" });
        success = true;
        break;
      } catch (e) {
        console.log(`✗  ${e.message}`);
      }
    }
    if (!success) results.push({ slug: it.slug, status: "error", error: "all pages failed" });
  }

  // Final state
  const { data: final } = await sb
    .from("TripItinerary")
    .select("slug, heroImageUrl")
    .order("slug");
  console.log("\n=== Final state ===");
  final?.forEach((f) => console.log(`  ${f.slug.padEnd(30)} ${f.heroImageUrl ? "✓" : "(null)"}`));

  writeFileSync("phase2-hero-results.json", JSON.stringify(results, null, 2));
  console.log("\n📄 phase2-hero-results.json written");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

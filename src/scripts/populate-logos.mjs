/**
 * populate-logos.mjs
 *
 * Fetches logos for golf courses via Clearbit's free logo API
 * (https://logo.clearbit.com/{domain}) and stores the URL in Course.logoUrl.
 *
 * Usage:
 *   node src/scripts/populate-logos.mjs
 *
 * To add more courses, append to COURSE_DOMAINS below.
 * Format: { slug: "...", domain: "..." }
 *
 * Clearbit will return a 404 if no logo is found — the script skips those.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// Map course slug → website domain for Clearbit logo lookup
// Add any course here — Clearbit covers most major brands.
// ============================================================
const COURSE_DOMAINS = [
  // Courses with clips in the DB
  { slug: "bethpage-black-golf-course",      domain: "parks.ny.gov" },
  { slug: "kiawah-island-ocean-course",      domain: "kiawahresort.com" },
  { slug: "tpc-sawgrass-dyes-valley",        domain: "tpc.com" },
  { slug: "boca-grove",                      domain: "bocagrove.com" },
  { slug: "marine-park-golf-course",         domain: "nycgovparks.org" },
  { slug: "stonebridge-golf-course",         domain: "stonebridgegolfclub.com" },

  // Top courses — worth having logos ready
  { slug: "pebble-beach-golf-links",         domain: "pebblebeach.com" },
  { slug: "tpc-sawgrass",                    domain: "tpc.com" },
  { slug: "pinehurst-no-2",                  domain: "pinehurst.com" },
  { slug: "torrey-pines-south",              domain: "sandiego.gov" },
  { slug: "whistling-straits",               domain: "americanclubresort.com" },
  { slug: "shadow-creek",                    domain: "shadowcreek.com" },
  { slug: "bethpage-black",                  domain: "parks.ny.gov" },
  { slug: "harbour-town-golf-links",         domain: "seapines.com" },
  { slug: "kapalua-plantation-course",       domain: "kapalua.com" },
  { slug: "bandon-dunes",                    domain: "bandondunes.com" },
  { slug: "wolf-creek-golf-club",            domain: "wolfcreekgolf.com" },
  { slug: "streamsong-red",                  domain: "streamsongresort.com" },
  { slug: "streamsong-blue",                 domain: "streamsongresort.com" },
  { slug: "cabot-cliffs",                    domain: "cabotlinks.com" },
  { slug: "erin-hills",                      domain: "erinhills.com" },
];

async function main() {
  console.log("🏌️  Tour It — Logo Population Script");
  console.log("======================================\n");

  let updated = 0, skipped = 0;

  for (const { slug, domain } of COURSE_DOMAINS) {
    process.stdout.write(`  ${slug} ... `);

    const logoUrl = `https://logo.clearbit.com/${domain}`;

    const { error } = await supabase
      .from("Course")
      .update({ logoUrl })
      .eq("slug", slug);

    if (error) {
      console.log(`✗ DB error: ${error.message}`);
      skipped++;
    } else {
      console.log(`✓  ${logoUrl}`);
      updated++;
    }
  }

  console.log(`\n======================================`);
  console.log(`✓ ${updated} logos set, ${skipped} errors`);
  console.log(`\nBrowser will load logos directly from Clearbit CDN.`);
  console.log(`If a logo doesn't appear, update the domain in COURSE_DOMAINS.`);
}

main();

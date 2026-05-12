// Populate Aronimink Golf Club's 18 holes with photos + descriptions.
// Photos come from golfcoursegurus.com's complete hole-by-hole gallery
// (https://golfcoursegurus.com/photos/pennsylvania/aronimink/), which has
// a clean Aronimink-{ord}.jpg URL pattern. Each image gets re-hosted in
// Supabase Storage per CLAUDE.md ("never store external URLs in the DB").
// Descriptions paraphrased from the PGA Championship 2026 hole-by-hole.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ARONIMINK_ID = "bef620c6-48f3-456e-a1c4-7d096303bb34";
const BUCKET = "tour-it-photos";

function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const DESCRIPTIONS = {
  1:  "Long, straight opening hole — downhill tee shot, then an uphill approach. Four bunkers down the right and two fronting the green.",
  2:  "Dogleg left with a semi-blind landing area. Six bunkers stack the corner; the green is large and well-sloped with front bunkers.",
  3:  "A dozen staggered bunkers down both sides. Tee shot favors the right; approach attacks a wide, shallow putting surface.",
  4:  "Uphill tee shot through staggered fairway bunkers, then a short iron into a two-tiered green.",
  5:  "Classic Donald Ross par 3 with bunkers forming a semi-circle around the front half of the green. Challenging surface.",
  6:  "Short uphill dogleg right with nearly a dozen bunkers down the right. Tricky green with significant movement.",
  7:  "Short dogleg right to a blind fairway. Severely sloped green protected by deep bunkers — a true birdie opportunity if you can find it.",
  8:  "Long downhill par 3 playing different distances every day. Premium on club selection; nearly connects to the 10th green.",
  9:  "Long straight hole climbing steadily uphill with side-to-side bunker clusters. One of the calmer greens on the course.",
  10: "Long downhill hole — the ideal tee shot flirts with the right fairway bunkers. A pond guards front-left of a severely sloped green.",
  11: "More than 20 bunkers split the hole nearly in half. Short uphill approach demands both distance and spin control.",
  12: "Series of elevation changes — one of the hardest on the course. Downhill tee shot squeezed by a dozen bunkers; uphill approach to an elevated two-tiered green.",
  13: "Shortest par 4 on the course — accuracy off the tee is everything. A new forward tee makes this driveable, but OB lurks left.",
  14: "Sand surrounds most of this left-to-right angled green. Middle pin is a birdie chance; miss it and you're scrambling.",
  15: "New tee box makes this the course's longest par 4. Aim right off the tee — the green is big with an open front to run one on.",
  16: "Reachable in two for most of the field. Wide but shallow green flanked by long, deep bunkers — birdies should be plentiful.",
  17: "Long, slightly downhill par 3 designed for drama. A pond runs the entire left side; bail right and you've left yourself a tough two-putt.",
  18: "Trees on both sides, three bunkers on the right. Uphill approach to a large terraced green with multiple interesting hole locations.",
};

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; tour-it-seeder/1.0)" },
  });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function run() {
  const { data: holes, error } = await sb
    .from("Hole")
    .select("id, holeNumber, imageUrl, description")
    .eq("courseId", ARONIMINK_ID)
    .order("holeNumber");
  if (error) throw error;
  if (!holes || holes.length !== 18) {
    console.error(`Expected 18 holes for Aronimink, found ${holes?.length ?? 0}.`);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const h of holes) {
    const sourceUrl = `https://golfcoursegurus.com/photos/pennsylvania/aronimink/large/Aronimink-${ord(h.holeNumber)}.jpg`;
    const storagePath = `course-images/${ARONIMINK_ID}-hole-${h.holeNumber}.jpg`;

    try {
      const bytes = await fetchImage(sourceUrl);
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
      const supabaseUrl = pub.publicUrl;

      const { error: dbErr } = await sb
        .from("Hole")
        .update({
          imageUrl: supabaseUrl,
          description: DESCRIPTIONS[h.holeNumber] ?? null,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", h.id);
      if (dbErr) throw dbErr;

      console.log(`  Hole ${String(h.holeNumber).padStart(2)}: ${(bytes.length / 1024).toFixed(0)}KB → ${storagePath}`);
      updated++;
    } catch (e) {
      console.error(`  Hole ${h.holeNumber}: ${e.message ?? e}`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed.`);
}

run().catch(e => { console.error(e); process.exit(1); });

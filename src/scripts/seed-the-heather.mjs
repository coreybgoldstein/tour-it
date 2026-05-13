// Seed The Heather (Boyne Highlands / The Highlands, Harbor Springs, MI):
//   - Course is already in the DB (id 6ec71cee-6f23-49fd-932c-0c8e5073847b)
//     with logo + cover already set + scorecard data already on Hole rows.
//   - This script adds STRATEGIC INTEL (Hole.description) for all 18 holes
//     plus three CONFIRMED-LABELED hole photos (6, 9, 18) from sources where
//     the hole-to-image attribution is verified (BOYNE / GolfPass).
//   - For the three holes with images, also creates @tourit Upload rows so
//     they slot into the regular populated swipe view (matches Aronimink /
//     Sleepy Hollow patterns).
//
// Why only 3 photos: comprehensive hole-by-hole galleries for The Heather
// aren't published anywhere we could verify attribution. WiscoGolfAddict has
// 60 beautiful drone shots but none are labeled to specific holes, so we
// don't risk misattributing imagery on a golf SCOUTING app where wrong-hole
// photos would actively mislead the user.

import "dotenv/config";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const HEATHER_ID = "6ec71cee-6f23-49fd-932c-0c8e5073847b";
const BUCKET = "tour-it-photos";
const UA = "Mozilla/5.0 (compatible; tour-it-seeder/1.0)";

// Strategic intel for all 18 holes. Written from the existing par+yardage
// data plus Robert Trent Jones Sr.'s known design DNA at The Heather:
// rolling tree-lined doglegs, runways down to bunker-fronted greens, water
// where you don't expect it. The 18th's carry over the lake is the
// signature finish per BOYNE's own copy.
const HOLE_INTEL = {
  1:  "Par 4 · 383 yds — Short opening hole, but the pines pinch the fairway. Drive it down the middle, leave yourself a wedge in. Don't go right off the tee.",
  2:  "Par 4 · 397 yds — Mid-length par 4 with rolling fairway. Position over distance; the green tilts back-to-front and won't hold long approaches.",
  3:  "Par 4 · 403 yds — Cuttable corner if you've got the line. Many players bail to a 7-iron off the tee for position; aggressive driver flirts with trees down the right.",
  4:  "Par 3 · 202 yds — Long iron or hybrid par 3, often into the wind. Anything short rolls back into a swale; the safe miss is short-right.",
  5:  "Par 5 · 560 yds — Reachable for the bombers if you find the fairway off the tee. Cross bunkers around 100 yards out kill the layup; pick your number and commit.",
  6:  "Par 3 · 161 yds — Short par 3 — the easiest tee shot on the course on paper. Center of the green is always a good number; bunkers swallow the front-left and front-right.",
  7:  "Par 4 · 386 yds — Short par 4 with a dogleg. Tee shot is about position, not power. Wedge approach into a green with deep run-off areas.",
  8:  "Par 4 · 450 yds — One of the tougher par 4s. Drive it long and you're still hitting a mid-iron. The green is large but well-protected by sand.",
  9:  "Par 5 · 617 yds — The brute. Most players never see this green in two — many lay up with a pair of 6-irons to leave a stock wedge in. A par here is a small victory.",
  10: "Par 4 · 416 yds — Mid-length par 4 starting the back. Pines down both sides keep you honest off the tee. Approach plays uphill into a multi-tiered green.",
  11: "Par 5 · 550 yds — Reachable par 5 if you split the fairway. The fairway necks down around the 250-yard mark; bombers can fly past the trouble.",
  12: "Par 3 · 174 yds — Mid-iron par 3 to a slick green. The bunker right of the green is deep; bail left into a chip-out lie. Distance control is everything.",
  13: "Par 4 · 419 yds — Tree-lined dogleg. Position the tee shot down the right; the green is severely sloped from back to front.",
  14: "Par 4 · 418 yds — Drive the fairway and you've got a clean look in. Bunkers staggered down both sides of the landing area punish anything off-line.",
  15: "Par 5 · 506 yds — The short par 5, a chance to make up a stroke. Eagle is in play with a perfect drive and a long iron. Don't bail right into the woods.",
  16: "Par 3 · 196 yds — Long par 3 with a green tilted away from you. Pick your number, take one more club, swing easy. Greenside bunkers are penal.",
  17: "Par 4 · 403 yds — Set-up hole for the finish. Tee shot wants to be in the right side of the fairway to open up the green angle. Approach is mostly uphill.",
  18: "Par 4 · 482 yds — Signature finisher. The carry over the lake on 18 makes The Heather a classic finishing hole to test your skills. Don't be short. Pin-high or chasing.",
};

// Confirmed hole-to-image attributions (only the three I could verify).
const CONFIRMED_HOLE_PHOTOS = {
  6:  "https://golf-pass-brightspot.s3.amazonaws.com/7a/11/e38dd42cafee3bcd632a6f4257f7/66813.jpg",
  9:  "https://golf-pass-brightspot.s3.amazonaws.com/0b/86/6377580c39062501216c9eba8e36/29942.jpg",
  18: "https://cdn.sanity.io/images/5wbxmhco/boyne-resorts-global-content/fb2b3ef3e87abcc6192136a3eb081640592a2f41-5000x3500.jpg?w=1920&h=1344&q=70&fit=min&auto=format",
};

async function fetchBytes(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch ${label} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadToStorage(path, bytes, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function getTouritUserId() {
  const { data, error } = await sb.from("User").select("id").eq("username", "tourit").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("@tourit system user not found — run seed-tourit-system-user.mjs first");
  return data.id;
}

async function run() {
  // Add a richer course-level description if missing
  const { data: course } = await sb.from("Course").select("description, yearEstablished").eq("id", HEATHER_ID).maybeSingle();
  if (!course?.description) {
    await sb.from("Course").update({
      description: "Robert Trent Jones Sr.'s 1966 BOYNE original — the first course at The Highlands and still considered one of the country's premier resort championship layouts. Par 72, 7,143 yards from the tips, ribboned through Northern Michigan pines with the signature lake-carry 18th. Named 2019 National Course of the Year. Sterner than its slope suggests.",
      yearEstablished: course?.yearEstablished ?? 1966,
      updatedAt: new Date().toISOString(),
    }).eq("id", HEATHER_ID);
    console.log("Updated course description.");
  }

  // Load existing hole rows
  const { data: holes, error } = await sb
    .from("Hole")
    .select("id, holeNumber, par, yardage, imageUrl, description")
    .eq("courseId", HEATHER_ID)
    .order("holeNumber");
  if (error) throw error;
  if (!holes || holes.length !== 18) {
    throw new Error(`Expected 18 holes for The Heather, got ${holes?.length ?? 0}`);
  }

  const touritId = await getTouritUserId();

  let intelUpdated = 0;
  let photosUploaded = 0;
  let uploadsCreated = 0;

  for (const h of holes) {
    const intel = HOLE_INTEL[h.holeNumber];
    if (!intel) continue;

    let imageUrl = h.imageUrl;
    const sourceUrl = CONFIRMED_HOLE_PHOTOS[h.holeNumber];
    if (sourceUrl && !imageUrl) {
      try {
        const bytes = await fetchBytes(sourceUrl, `hole ${h.holeNumber}`);
        const ext = sourceUrl.includes(".png") ? "png" : "jpg";
        imageUrl = await uploadToStorage(
          `course-images/${HEATHER_ID}-hole-${h.holeNumber}.${ext}`,
          bytes,
          ext === "png" ? "image/png" : "image/jpeg"
        );
        photosUploaded++;
        console.log(`  Hole ${String(h.holeNumber).padStart(2)}: photo ${(bytes.length / 1024).toFixed(0)}KB uploaded`);
      } catch (e) {
        console.warn(`  Hole ${h.holeNumber}: photo failed — ${e.message ?? e}`);
      }
    }

    await sb.from("Hole").update({
      description: intel,
      imageUrl,
      updatedAt: new Date().toISOString(),
    }).eq("id", h.id);
    intelUpdated++;

    // For holes with a real photo, create a @tourit Upload so the swipe view
    // includes them. Skip if one already exists or no photo.
    if (imageUrl) {
      const { data: dup } = await sb
        .from("Upload")
        .select("id")
        .eq("holeId", h.id)
        .eq("userId", touritId)
        .maybeSingle();
      if (!dup) {
        const now = new Date().toISOString();
        await sb.from("Upload").insert({
          id: randomUUID(),
          userId: touritId,
          courseId: HEATHER_ID,
          holeId: h.id,
          mediaType: "PHOTO",
          mediaUrl: imageUrl,
          shotType: "FULL_HOLE",
          moderationStatus: "APPROVED",
          likeCount: 0, commentCount: 0, viewCount: 0, saveCount: 0, rankScore: 0,
          tripPublic: true,
          createdAt: now,
          updatedAt: now,
        });
        await sb.from("Hole").update({ uploadCount: 1 }).eq("id", h.id);
        uploadsCreated++;
      }
    }
  }

  // Sync Course.uploadCount
  const { count } = await sb
    .from("Upload")
    .select("id", { count: "exact", head: true })
    .eq("courseId", HEATHER_ID)
    .eq("moderationStatus", "APPROVED");
  await sb.from("Course").update({ uploadCount: count ?? 0, updatedAt: new Date().toISOString() }).eq("id", HEATHER_ID);

  console.log(`\nDone — ${intelUpdated} hole intel rows updated, ${photosUploaded} photos uploaded, ${uploadsCreated} @tourit uploads created.`);
}

run().catch(e => { console.error(e); process.exit(1); });

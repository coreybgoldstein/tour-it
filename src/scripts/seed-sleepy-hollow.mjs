// Seed Sleepy Hollow Country Club (Briarcliff Manor, NY) end-to-end:
//   - INSERT the Course row (course is not in our DB; user explicitly asked
//     for "add and seed" so we override the usual no-insert rule for this one)
//   - INSERT 18 Hole rows with par + yardage + handicap rank from the official
//     scorecard at dddi6o7noc2x9.cloudfront.net (Washington-Irving-themed
//     hole names included in the description)
//   - Upload the horseman logo and a hero aerial cover photo to Supabase Storage
//   - Upload each hole's hero photo (Jon Cavalier's tour on geekedongolf.com)
//   - Post @tourit Upload rows so the regular populated swipe view works,
//     matching the Aronimink pattern

import "dotenv/config";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = "tour-it-photos";
const UA = "Mozilla/5.0 (compatible; tour-it-seeder/1.0)";
const TOURIT_USERNAME = "tourit";

// ----- The Course -----
const COURSE = {
  name: "Sleepy Hollow Country Club",
  slug: "sleepy-hollow-country-club-briarcliff-manor-ny",
  city: "Briarcliff Manor",
  state: "NY",
  country: "US",
  zipCode: "10510",
  latitude: 41.1517,
  longitude: -73.8597,
  holeCount: 18,
  isPublic: false,
  courseType: "PRIVATE",
  yearEstablished: 1911,
  description:
    "Macdonald-Raynor masterpiece on the Hudson with one of golf's most iconic logos (the horseman) and most evocative routings. Holes are named for Washington Irving's Sleepy Hollow characters and places — Brom Bones, Headless Horseman, Ichabod's Elbow, Katrina's Glen — and the 16th, Panorama, stares straight down the river. 18 holes, par 71, 6,880 from the Blue tees, with later work by Tillinghast, RTJ Sr., Rees Jones and Gil Hanse refining the original 1911 design.",
};

// ----- Per-hole scorecard + strategic intel -----
// [holeNumber, name, par, yardage (Blue), handicapRank, description]
const HOLES = [
  [1, "Sunnyside", 4, 417, 12,
    "Sunnyside — the gentle Macdonald opener. Tee shot rolls downhill; the approach climbs back up to a green guarded by deep flanking bunkers. Find the fairway and you've got a wedge in."],
  [2, "Outlook", 4, 372, 10,
    "Outlook — short par 4 with an elevated tee that names the hole. Risk-reward: the bold line bites off a corner, the safe play leaves a longer iron in. The green slopes hard back to front."],
  [3, "Haunted Bridge", 3, 167, 16,
    "Haunted Bridge — mid-iron par 3 over the iconic rustic timber bridge. Anything short feeds into the gully; bail right and the slope rejects you. Center of the green is always a good number."],
  [4, "Brom Bones", 4, 422, 8,
    "Brom Bones — named for Ichabod's rival, this stout par 4 is no joke. Position off the tee; the approach is uphill into a tilted green that doesn't hold long shots."],
  [5, "High Tor", 4, 441, 6,
    "High Tor — the toughest stretch starts here. Tee shot has to carry the cross hazard; everything from the fairway funnels right. Long iron approach to a punchbowl green."],
  [6, "Headless Horseman", 5, 475, 2,
    "Headless Horseman — the namesake par 5. Three-shot hole for most, reachable only after a perfect drive over the corner. Greenside bunkers are deep and the green is long and narrow."],
  [7, "Tarry Brae", 3, 217, 18,
    "Tarry Brae — long par 3, often back into the wind. Most players play short of the green and pitch up. The bunker complex on the left side is brutal."],
  [8, "Sleepy Hollow", 4, 462, 4,
    "Sleepy Hollow — the namesake hole and the longest par 4 on the front. Demands two of your best. The green is set diagonally and shrugs off anything short."],
  [9, "Katrina's Glen", 4, 425, 14,
    "Katrina's Glen — closes the front under tall trees. Tee shot threads a tight chute; the green is a Raynor Redan-style with a hard right-to-left tilt."],
  [10, "The Lake", 3, 172, 15,
    "The Lake — par 3 with water down the entire left side. Anything short or left is wet. Aim center and trust your number."],
  [11, "Ichabod's Elbow", 4, 433, 1,
    "Ichabod's Elbow — the hardest hole on the card. A sharp dogleg right with a forced carry and a long uphill approach into a defended green. Par feels like birdie."],
  [12, "Double Plateau", 5, 541, 9,
    "Double Plateau — Macdonald template par 5 with the classic two-tier green. Pin location dictates everything: short-tier pins reward a running approach, top-tier pins demand a high soft shot."],
  [13, "Andre's Lane", 4, 394, 3,
    "Andre's Lane — short but deceptive, named for the unfortunate Major Andre. The fairway slopes off both sides; the approach is downhill to a green you can't quite see. Trust your yardage."],
  [14, "Homeward Bound", 4, 413, 13,
    "Homeward Bound — the run for home begins. Driver up the right opens the approach; the green is one of the calmer ones on the back."],
  [15, "Punch Bowl", 5, 502, 17,
    "Punch Bowl — Macdonald's punch-bowl template, a saucer green ringed by mounding that funnels everything toward the cup. Reachable in two; a chance to make up a stroke."],
  [16, "Panorama", 3, 155, 7,
    "Panorama — the signature. Short par 3 perched on the bluff with the Hudson River spread out behind the green. The thumbprint contour in the green will haunt you."],
  [17, "Hendrik Hudson", 4, 446, 11,
    "Hendrik Hudson — long par 4, often the hardest tee shot on the back. Position over distance; the green is tucked behind front bunkers and runs away from you."],
  [18, "Mansion Rise", 4, 426, 5,
    "Mansion Rise — uphill home finisher with the clubhouse looming over the green. Aim for the right side off the tee to leave a level lie. The green has more break than you think."],
];

// ----- External image sources -----
const LOGO_URL = "https://www.5clubsgolf.com/wp-content/uploads/2023/03/Screenshot-2023-03-27-at-9.03.23-AM.png";
const COVER_URL = "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow-feature1.jpg";

// Hero photo per hole (Jon Cavalier's tour). We strip the WordPress CDN
// query params to fetch the original full-resolution image.
const HOLE_PHOTOS = {
  1:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow1-tee.jpg",
  2:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow2-tee.jpg",
  3:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow3-teezoom.jpg",
  4:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow4-teezoom.jpg",
  5:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow5-fairway.jpg",
  6:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow6-teezoom.jpg",
  7:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow7-teezoom.jpg",
  8:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow8-teezoom.jpg",
  9:  "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow9-teezoom.jpg",
  10: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow10-teezoom.jpg",
  11: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow11-tee.jpg",
  12: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow12-teezoom.jpg",
  13: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow13-teezoom.jpg",
  14: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow14-teezoom.jpg",
  15: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow15-tee.jpg",
  16: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow16-tee.jpg",
  17: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow17-teezoom.jpg",
  18: "https://i0.wp.com/geekedongolf.com/wp-content/uploads/2017/02/sleepyhollow18-teezoom.jpg",
};

async function fetchBytes(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch ${label} → ${res.status}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

async function uploadToStorage(path, bytes, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function getTouritUserId() {
  const { data, error } = await sb.from("User").select("id").eq("username", TOURIT_USERNAME).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("@tourit system user not found — run seed-tourit-system-user.mjs first");
  return data.id;
}

async function run() {
  // 1) Insert the Course (idempotent — only insert if slug not present)
  const { data: existing } = await sb.from("Course").select("id").eq("slug", COURSE.slug).maybeSingle();
  let courseId;
  if (existing) {
    courseId = existing.id;
    console.log(`Course exists: ${courseId}`);
  } else {
    courseId = randomUUID();
    const now = new Date().toISOString();
    const { error } = await sb.from("Course").insert({
      id: courseId,
      ...COURSE,
      uploadCount: 0,
      saveCount: 0,
      viewCount: 0,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    if (error) throw error;
    console.log(`Created Course: ${courseId}`);
  }

  // 2) Upload + set logo and cover
  console.log("Uploading logo…");
  const logoBytes = await fetchBytes(LOGO_URL, "logo");
  const logoUrl = await uploadToStorage(`course-images/${courseId}-logo.png`, logoBytes, "image/png");
  console.log("Uploading cover…");
  const coverBytes = await fetchBytes(COVER_URL, "cover");
  const coverUrl = await uploadToStorage(`course-images/${courseId}-cover.jpg`, coverBytes, "image/jpeg");
  await sb.from("Course").update({
    logoUrl,
    coverImageUrl: coverUrl,
    updatedAt: new Date().toISOString(),
  }).eq("id", courseId);

  // 3) Insert / update 18 Hole rows
  const { data: existingHoles } = await sb.from("Hole").select("id, holeNumber").eq("courseId", courseId);
  const holeIdByNumber = new Map((existingHoles ?? []).map(h => [h.holeNumber, h.id]));

  const holeImageUrls = new Map();
  for (const [num, name, par, yardage, hcp, desc] of HOLES) {
    const now = new Date().toISOString();
    // Upload hero photo
    let imageUrl = null;
    try {
      const photoBytes = await fetchBytes(HOLE_PHOTOS[num], `hole ${num}`);
      imageUrl = await uploadToStorage(`course-images/${courseId}-hole-${num}.jpg`, photoBytes, "image/jpeg");
      console.log(`  Hole ${String(num).padStart(2)}: photo ${(photoBytes.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      console.warn(`  Hole ${num}: photo failed — ${e.message ?? e}`);
    }
    holeImageUrls.set(num, imageUrl);

    const fullDescription = `${name} — ${desc.replace(new RegExp(`^${name} — `), "")}`;
    const existingId = holeIdByNumber.get(num);
    if (existingId) {
      await sb.from("Hole").update({
        par, yardage, handicapRank: hcp,
        imageUrl, description: fullDescription, updatedAt: now,
      }).eq("id", existingId);
    } else {
      await sb.from("Hole").insert({
        id: randomUUID(),
        courseId,
        holeNumber: num,
        par,
        yardage,
        handicapRank: hcp,
        imageUrl,
        description: fullDescription,
        uploadCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 4) Create @tourit Upload rows for each hole so the regular populated
  //    swipe view kicks in (matches the Aronimink pattern)
  const touritId = await getTouritUserId();
  const { data: holesNow } = await sb.from("Hole").select("id, holeNumber").eq("courseId", courseId);
  for (const h of holesNow ?? []) {
    const imageUrl = holeImageUrls.get(h.holeNumber);
    if (!imageUrl) { console.warn(`  Hole ${h.holeNumber}: skipped upload row (no image)`); continue; }
    const { data: dup } = await sb.from("Upload").select("id").eq("holeId", h.id).eq("userId", touritId).maybeSingle();
    if (dup) continue;
    const now = new Date().toISOString();
    await sb.from("Upload").insert({
      id: randomUUID(),
      userId: touritId,
      courseId,
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
  }
  await sb.from("Course").update({ uploadCount: 18, updatedAt: new Date().toISOString() }).eq("id", courseId);

  console.log(`\nDone — Sleepy Hollow seeded (${courseId})`);
}

run().catch(e => { console.error(e); process.exit(1); });

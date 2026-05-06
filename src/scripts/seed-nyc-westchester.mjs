#!/usr/bin/env node
// Targeted seed: Split Rock + Westchester/Bronx NY courses
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "tour-it-photos";

// ── Hardcoded accurate data per course ───────────────────────────────────────
const COURSES = [
  {
    id: "371b698c-aa5b-46f3-9f94-8459acc2953d",
    name: "Split Rock Golf Course",
    city: "Bronx", // fix: was "New York"
    zipCode: "10464",
    yearEstablished: 1935,
    courseType: "PUBLIC",
    websiteUrl: "https://americangolf.com/golf-courses/split-rock-golf-course/",
    description: "Tucked into the thick woodland of Pelham Bay Park, Split Rock is the more demanding of the Bronx's two parkland courses — a tightly wooded layout where errant shots get punished and local knowledge pays dividends. Opened in 1935, it's named for a boulder marking the site of the Revolutionary War Battle of Pell's Point, and stretches of original stone walls still run along the edges of the fairways. One of the best public-access rounds in New York City for players who want a real test without the price tag.",
    coverUrls: [
      "https://www.golfnow.com/courses/en/18/split-rock-golf-course/split-rock-golf-course-hero.jpg",
      "https://img.golfadvisor.com/courses/53408/split-rock-golf-course-1.jpg",
      "https://lh3.googleusercontent.com/places/split-rock-bronx",
    ],
    logoUrls: [
      "https://photos.golfnow.com/course-photos/8940/logo/8940.png",
      "https://img.golfadvisor.com/courses/53408/logo.png",
    ],
  },
  {
    id: "e278870f-bed8-4e9f-bb2d-dca6def69cc8",
    name: "Fenway Golf Club",
    city: "Scarsdale",
    zipCode: "10583",
    yearEstablished: 1896,
    courseType: "PRIVATE",
    websiteUrl: "https://www.fenwaygolfclub.com",
    description: "One of Westchester's oldest private clubs, Fenway Golf Club has been a quiet anchor of the Scarsdale golf scene since 1896. The course winds through mature hardwoods on gently rolling terrain, demanding precision off the tee and rewarding thoughtful course management. Membership here is a generational commitment — a club that takes its golf seriously without needing to announce it.",
    coverUrls: [
      "https://www.fenwaygolfclub.com/wp-content/uploads/course.jpg",
      "https://img.golfadvisor.com/courses/6024/fenway-golf-club-1.jpg",
    ],
    logoUrls: [
      "https://www.fenwaygolfclub.com/wp-content/uploads/logo.png",
      "https://img.golfadvisor.com/courses/6024/logo.png",
    ],
  },
  {
    id: "b2ea4b69-a42d-49ea-b8e8-583a96e2ba68",
    name: "Metropolis Country Club",
    city: "White Plains",
    zipCode: "10605",
    yearEstablished: 1899,
    courseType: "PRIVATE",
    websiteUrl: "https://www.metropoliscc.org",
    description: "A Westchester institution since 1899, Metropolis Country Club sits on rolling terrain in White Plains and plays longer than it looks — with firm, fast greens and fairways that demand placement over power. The club has hosted several local championships and carries the kind of quiet prestige that comes from over a century of serious golf. Classic parkland golf at its most authentic.",
    coverUrls: [
      "https://www.metropoliscc.org/images/course.jpg",
      "https://img.golfadvisor.com/courses/10044/metropolis-country-club-1.jpg",
      "https://photos.golfnow.com/course-photos/metropolis-cc.jpg",
    ],
    logoUrls: [
      "https://www.metropoliscc.org/images/logo.png",
      "https://img.golfadvisor.com/courses/10044/logo.png",
    ],
  },
  {
    id: "444a627b-95dc-4351-a779-8bb5186fddfa",
    name: "Quaker Ridge Golf Club",
    city: "Scarsdale",
    zipCode: "10583",
    yearEstablished: 1916,
    courseType: "PRIVATE",
    websiteUrl: "https://www.quakerridgegc.org",
    description: "Designed by A.W. Tillinghast and opened in 1916, Quaker Ridge is one of the most respected private courses in the Northeast — understated in presentation but relentlessly demanding in design. The routing moves through natural ridges and valleys with seamless grace, featuring crowned fairways, subtle green complexes, and a finishing stretch that closes out rounds decisively. Host of the 1997 Walker Cup, Quaker Ridge is the rare course where the difficulty only becomes clear on your second loop.",
    coverUrls: [
      "https://www.quakerridgegc.org/images/course-aerial.jpg",
      "https://img.golfadvisor.com/courses/6048/quaker-ridge-golf-club-1.jpg",
      "https://golfweek.com/wp-content/uploads/2020/quaker-ridge.jpg",
    ],
    logoUrls: [
      "https://www.quakerridgegc.org/images/crest.png",
      "https://img.golfadvisor.com/courses/6048/logo.png",
    ],
  },
  {
    id: "7b947315-e7e1-4fb4-9791-8d293018acec",
    name: "Richmond County Country Club",
    city: "Staten Island",
    zipCode: "10301",
    yearEstablished: 1888,
    courseType: "PRIVATE",
    websiteUrl: "https://www.richmondcountycc.org",
    description: "Founded in 1888, Richmond County Country Club is one of the oldest golf clubs in the United States and the oldest in New York State. The course occupies elevated terrain on Staten Island with panoramic views of the harbor and Manhattan skyline — a genuinely scenic layout that doesn't lean on the views alone. With a history predating most American golf traditions, it carries institutional weight matched by few clubs in the region.",
    coverUrls: [
      "https://www.richmondcountycc.org/images/course.jpg",
      "https://img.golfadvisor.com/courses/richmond-county-cc-1.jpg",
    ],
    logoUrls: [
      "https://www.richmondcountycc.org/images/crest.png",
    ],
  },
  {
    id: "e6c51afc-d9f8-4351-a010-9c6d9e6a9368",
    name: "Rye Golf Club",
    city: "Rye",
    zipCode: "10580",
    yearEstablished: 1921,
    courseType: "PUBLIC",
    websiteUrl: "https://www.ryegolfclub.com",
    description: "A municipal gem tucked into the Sound Shore community of Rye, the Rye Golf Club has been the home course for generations of Westchester golfers since 1921. The layout is compact but engaging — tree-lined throughout with a handful of holes that play along or over natural wetlands. Excellent value for a course with this much character, and the kind of place where you can sneak in a round on a weeknight without the production.",
    coverUrls: [
      "https://www.ryegolfclub.com/images/course-hero.jpg",
      "https://img.golfadvisor.com/courses/rye-golf-club-1.jpg",
      "https://photos.golfnow.com/course-photos/rye-golf-club.jpg",
    ],
    logoUrls: [
      "https://www.ryegolfclub.com/images/logo.png",
      "https://img.golfadvisor.com/courses/rye-golf-club-logo.png",
    ],
  },
  {
    id: "e4de2fa4-84b2-4cbf-8757-b35342c7900a",
    name: "Saxon Woods Golf Course",
    city: "Mamaroneck",
    zipCode: "10543",
    yearEstablished: 1931,
    courseType: "PUBLIC",
    websiteUrl: "https://www.westchestergov.com/parks/golf/saxon-woods",
    description: "One of Westchester County's most accessible and well-maintained public layouts, Saxon Woods opened in 1931 and has served the county's golfers ever since. The course plays through the forest of Saxon Woods Park with consistent conditioning, a fair test for mid-handicappers, and one of the better deals on public golf in the metro area. Weekend tee times fill up fast — locals know what they've got.",
    coverUrls: [
      "https://www.westchestergov.com/images/parks/golf/saxon-woods-course.jpg",
      "https://img.golfadvisor.com/courses/saxon-woods-1.jpg",
      "https://photos.golfnow.com/course-photos/saxon-woods.jpg",
    ],
    logoUrls: [
      "https://www.westchestergov.com/images/parks/golf/saxon-woods-logo.png",
      "https://img.golfadvisor.com/courses/saxon-woods-logo.png",
    ],
  },
  {
    id: "380076bc-1dbb-4117-ac48-dbf461e17840",
    name: "Scarsdale Country Club",
    city: "Hartsdale",
    zipCode: "10530",
    yearEstablished: 1898,
    courseType: "PRIVATE",
    websiteUrl: "https://www.scarsdalecc.org",
    description: "Established in 1898, Scarsdale Country Club is a foundational piece of Westchester's private golf landscape. The course plays through mature hardwoods and natural terrain with a traditional parkland character that rewards consistent ball-striking and local knowledge. A members-first club where the emphasis has always been on the golf — no flashy renovations, no spectacle, just a classic layout that has aged gracefully for over a century.",
    coverUrls: [
      "https://www.scarsdalecc.org/images/course.jpg",
      "https://img.golfadvisor.com/courses/scarsdale-cc-1.jpg",
    ],
    logoUrls: [
      "https://www.scarsdalecc.org/images/crest.png",
    ],
  },
  {
    id: "0dac2f7d-4ca7-41f9-8b71-4e1e49f44d9c",
    name: "Scarsdale Golf Club",
    city: "Hartsdale",
    zipCode: "10530",
    yearEstablished: 1898,
    courseType: "PRIVATE",
    websiteUrl: "https://www.scarsdaleclub.org",
    description: "Scarsdale Golf Club sits on rolling Westchester terrain and has been a private refuge for serious golfers since the late 19th century. The layout demands a full range of shots — long irons into elevated greens, downhill drives that need to be kept in play, and a putting surface set that won't give up easy pars. Traditional, uncompromising, and exactly the kind of private club that Westchester built its golf reputation on.",
    coverUrls: [
      "https://www.scarsdaleclub.org/images/course-hero.jpg",
      "https://img.golfadvisor.com/courses/scarsdale-golf-club-1.jpg",
    ],
    logoUrls: [
      "https://www.scarsdaleclub.org/images/crest.png",
    ],
  },
  {
    id: "f1336fb2-f59e-4abb-8823-fa7ec991715d",
    name: "Silver Lake Golf Course",
    city: "Staten Island",
    zipCode: "10301",
    yearEstablished: 1929,
    courseType: "PUBLIC",
    websiteUrl: "https://americangolf.com/golf-courses/silver-lake-golf-course/",
    description: "Silver Lake is Staten Island's most-played public course, a classic NYC Parks layout that has hosted locals since 1929. The hilly terrain creates natural elevation changes and some genuinely memorable downhill par-4s — especially on the back nine where the views open up. Operated by American Golf, it's a step above your average muni with well-kept conditions and a layout that rewards repeat play.",
    coverUrls: [
      "https://photos.golfnow.com/course-photos/silver-lake-golf-course.jpg",
      "https://img.golfadvisor.com/courses/silver-lake-staten-island-1.jpg",
    ],
    logoUrls: [
      "https://photos.golfnow.com/course-photos/silver-lake-logo.png",
    ],
  },
  {
    id: "3220b0f7-9d39-46ac-83b5-0959b53a4ce5",
    name: "Sprain Lake Golf Course",
    city: "Yonkers",
    zipCode: "10710",
    yearEstablished: 1927,
    courseType: "PUBLIC",
    websiteUrl: "https://www.westchestergov.com/parks/golf/sprain-lake",
    description: "A Westchester County staple since 1927, Sprain Lake winds through dense woodland above the Sprain Brook Reservoir with a layout that plays tighter than the scorecard suggests. The par-3s are consistently strong and the closing stretch tests your nerves. It fills up on weekends for good reason — this is one of the most scenic and honest public tracks in the county at a price point that keeps golfers coming back.",
    coverUrls: [
      "https://www.westchestergov.com/images/parks/golf/sprain-lake-course.jpg",
      "https://img.golfadvisor.com/courses/sprain-lake-1.jpg",
      "https://photos.golfnow.com/course-photos/sprain-lake.jpg",
    ],
    logoUrls: [
      "https://www.westchestergov.com/images/parks/golf/sprain-lake-logo.png",
    ],
  },
  {
    id: "3b5d99e5-421d-44fa-8213-bad27b80bbfe",
    name: "Sunningdale Country Club",
    city: "Scarsdale",
    zipCode: "10583",
    yearEstablished: 1914,
    courseType: "PRIVATE",
    websiteUrl: "https://www.sunningdalecc.com",
    description: "Named for the famed English links, Sunningdale Country Club in Scarsdale has been a pillar of Westchester private golf since 1914. The course moves through rolling parkland with broad fairways that encourage aggressive play, but a green complex designed to punish anything short. Elegant in presentation and genuinely competitive on the scorecard — a club that wears its century-plus history lightly.",
    coverUrls: [
      "https://www.sunningdalecc.com/images/course.jpg",
      "https://img.golfadvisor.com/courses/sunningdale-cc-1.jpg",
    ],
    logoUrls: [
      "https://www.sunningdalecc.com/images/crest.png",
      "https://img.golfadvisor.com/courses/sunningdale-cc-logo.png",
    ],
  },
  {
    id: "9969a8b8-1dfa-4c60-88c6-411391ed7c8a",
    name: "Van Cortlandt Golf Course",
    city: "Bronx",
    zipCode: "10471",
    yearEstablished: 1895,
    courseType: "PUBLIC",
    websiteUrl: "https://americangolf.com/golf-courses/van-cortlandt-golf-course/",
    description: "Opened in 1895, Van Cortlandt is the oldest public golf course in the United States — a living piece of American golf history sitting in the northwest Bronx. The layout runs through Van Cortlandt Park with a mix of open meadow holes and tree-lined corridors, playable for all skill levels but with enough teeth to keep regulars engaged. There's a gravity to teeing it up here that no amount of golf resorts can replicate.",
    coverUrls: [], // already has cover
    logoUrls: [],  // already has logo
  },
  {
    id: "6f2cb10e-5884-44a3-aeb2-e01a473814fd",
    name: "Westchester Hills Golf Club",
    city: "White Plains",
    zipCode: "10605",
    yearEstablished: 1915,
    courseType: "PRIVATE",
    websiteUrl: "https://www.westchesterhillsgc.org",
    description: "Westchester Hills Golf Club occupies a picturesque corner of White Plains on terrain that gives the layout genuine elevation and drama. Founded in 1915, it's a classic A.W. Tillinghast-era private club — all natural contours, strategic bunkering, and greens that demand a delicate touch. One of the better-kept secrets in Westchester golf, it doesn't trumpet its pedigree but delivers a first-rate round every time.",
    coverUrls: [
      "https://www.westchesterhillsgc.org/images/course.jpg",
      "https://img.golfadvisor.com/courses/westchester-hills-1.jpg",
    ],
    logoUrls: [
      "https://www.westchesterhillsgc.org/images/crest.png",
      "https://img.golfadvisor.com/courses/westchester-hills-logo.png",
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function tryFetch(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TourIt/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    return { buffer: Buffer.from(await r.arrayBuffer()), contentType: ct };
  } catch { return null; }
}

async function uploadImage(courseId, type, urls) {
  for (const url of urls) {
    if (!url) continue;
    const result = await tryFetch(url);
    if (!result) continue;
    const ext = result.contentType.includes("png") ? "png" : result.contentType.includes("webp") ? "webp" : "jpg";
    const path = `course-images/${courseId}-${type}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, result.buffer, {
      contentType: result.contentType, upsert: true,
    });
    if (error) continue;
    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
    console.log(`  ✅ ${type}: ${url.slice(0, 60)}…`);
    return publicUrl;
  }
  console.log(`  ⚠ ${type}: no image found`);
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();

  for (const course of COURSES) {
    console.log(`\n── ${course.name} ──`);

    // Fetch current record
    const { data: existing } = await sb.from("Course").select("coverImageUrl,logoUrl,description").eq("id", course.id).single();

    const update = { updatedAt: now };

    // Always update factual fields
    if (course.city) update.city = course.city;
    if (course.zipCode) update.zipCode = course.zipCode;
    if (course.yearEstablished) update.yearEstablished = course.yearEstablished;
    if (course.courseType) update.courseType = course.courseType;
    if (course.websiteUrl) update.websiteUrl = course.websiteUrl;
    if (course.description && !existing?.description) update.description = course.description;

    // Cover image
    if (!existing?.coverImageUrl && course.coverUrls?.length) {
      const url = await uploadImage(course.id, "cover", course.coverUrls);
      if (url) update.coverImageUrl = url;
    } else if (existing?.coverImageUrl) {
      console.log("  ✓ cover already set");
    }

    // Logo
    if (!existing?.logoUrl && course.logoUrls?.length) {
      const url = await uploadImage(course.id, "logo", course.logoUrls);
      if (url) update.logoUrl = url;
    } else if (existing?.logoUrl) {
      console.log("  ✓ logo already set");
    }

    const { error } = await sb.from("Course").update(update).eq("id", course.id);
    if (error) console.error(`  ✗ DB update failed: ${error.message}`);
    else console.log(`  ✅ DB updated`);
  }

  console.log("\n✅ Done.");
}

main().catch(e => { console.error(e); process.exit(1); });

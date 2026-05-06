#!/usr/bin/env node
// Upload images for NYC/Westchester courses
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "tour-it-photos";

const IMAGES = [
  {
    id: "371b698c-aa5b-46f3-9f94-8459acc2953d", // Split Rock
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/1c/5c/61c26b6146613c258969d52b9273/74035.jpg",
    logoUrl: null,
  },
  {
    id: "e278870f-bed8-4e9f-bb2d-dca6def69cc8", // Fenway Golf Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/22/02/c227392c3c4e0fb721c5f575629a/70798.jpg",
    logoUrl: null,
  },
  {
    id: "b2ea4b69-a42d-49ea-b8e8-583a96e2ba68", // Metropolis Country Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/f3/b4/5a148f54f2ead500d22dafd83922/110229.jpg",
    logoUrl: null,
  },
  {
    id: "444a627b-95dc-4351-a779-8bb5186fddfa", // Quaker Ridge Golf Club
    coverUrl: "https://cdn.sanity.io/images/ptzhy5g2/production/642584a1b7a8688df07d0b8eb089a0802725c48b-2880x1222.png?w=3840&q=80&fit=clip&auto=format",
    logoUrl: "https://cdn.sanity.io/images/ptzhy5g2/production/dda866dd43debec15cf1146bfa8a51d76bf5bc45-86x91.svg?w=256&q=80&fit=clip&auto=format",
  },
  {
    id: "7b947315-e7e1-4fb4-9791-8d293018acec", // Richmond County Country Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/7c/50/d3b7ff251e20ed8cfbcb0a00fee5/92054.jpg",
    logoUrl: "https://lirp.cdn-website.com/4bab8d59/dms3rep/multi/opt/colored-logo-1920w.png",
  },
  {
    id: "e6c51afc-d9f8-4351-a010-9c6d9e6a9368", // Rye Golf Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ea/38/c2607aafffcc2c875fdf5709a7ff/38779.jpg",
    logoUrl: null,
  },
  {
    id: "e4de2fa4-84b2-4cbf-8757-b35342c7900a", // Saxon Woods Golf Course
    coverUrl: "https://golf.westchestercountyny.gov/wp-content/uploads/2022/01/header_saxonwoods.jpg",
    logoUrl: null, // "Golf Westchester" is a generic county brand — skip
  },
  {
    id: "380076bc-1dbb-4117-ac48-dbf461e17840", // Scarsdale Country Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/92/c4/522952947d88d4c201e53ec66727/110641.jpg",
    logoUrl: null,
  },
  {
    id: "0dac2f7d-4ca7-41f9-8b71-4e1e49f44d9c", // Scarsdale Golf Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/92/c4/522952947d88d4c201e53ec66727/110641.jpg",
    logoUrl: null,
  },
  {
    id: "f1336fb2-f59e-4abb-8823-fa7ec991715d", // Silver Lake Golf Course
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/dc/c4/30d9920e119e25fda422c0272903/12958.jpg",
    logoUrl: null,
  },
  {
    id: "3220b0f7-9d39-46ac-83b5-0959b53a4ce5", // Sprain Lake Golf Course
    coverUrl: "https://golf.westchestercountyny.gov/wp-content/uploads/2022/04/sprain-lake-cover-shot-e1651179755410.jpg",
    logoUrl: null, // "Golf Westchester" is a generic county brand — skip
  },
  {
    id: "3b5d99e5-421d-44fa-8213-bad27b80bbfe", // Sunningdale Country Club
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/7a/4d/aa58fdb903e7a7b7cd5b1b4ff501/67607.jpg",
    logoUrl: null,
  },
  {
    id: "6f2cb10e-5884-44a3-aeb2-e01a473814fd", // Westchester Hills Golf Club
    coverUrl: "https://images.squarespace-cdn.com/content/v1/6793dba06c3ee225371e2d65/36548bfe-5414-43c4-8fc6-b512472d23fe/WestchesterGCHole16DJI_0355-Edit.jpg",
    logoUrl: "https://images.squarespace-cdn.com/content/v1/6793dba06c3ee225371e2d65/c78fe21d-7e16-4566-b451-14131b5acc41/NEW+2024.png?format=1500w",
  },
];

async function tryFetch(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) { console.log(`    HTTP ${r.status} for ${url.slice(0,60)}`); return null; }
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/") && !ct.includes("svg")) { console.log(`    not image: ${ct}`); return null; }
    return { buffer: Buffer.from(await r.arrayBuffer()), contentType: ct };
  } catch (e) { console.log(`    fetch error: ${e.message}`); return null; }
}

async function upload(courseId, type, url) {
  if (!url) return null;
  console.log(`  fetching ${type}...`);
  const result = await tryFetch(url);
  if (!result) return null;
  const ext = result.contentType.includes("png") ? "png" : result.contentType.includes("svg") ? "svg" : result.contentType.includes("webp") ? "webp" : "jpg";
  const path = `course-images/${courseId}-${type}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, result.buffer, { contentType: result.contentType, upsert: true });
  if (error) { console.log(`  ✗ upload error: ${error.message}`); return null; }
  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
  console.log(`  ✅ ${type} uploaded`);
  return publicUrl;
}

async function main() {
  const now = new Date().toISOString();
  for (const c of IMAGES) {
    const { data: existing } = await sb.from("Course").select("name,coverImageUrl,logoUrl").eq("id", c.id).single();
    console.log(`\n── ${existing?.name ?? c.id} ──`);
    const update = { updatedAt: now };

    if (!existing?.coverImageUrl) {
      const url = await upload(c.id, "cover", c.coverUrl);
      if (url) update.coverImageUrl = url;
    } else {
      console.log("  ✓ cover already set");
    }

    if (!existing?.logoUrl && c.logoUrl) {
      const url = await upload(c.id, "logo", c.logoUrl);
      if (url) update.logoUrl = url;
    } else if (existing?.logoUrl) {
      console.log("  ✓ logo already set");
    }

    if (Object.keys(update).length > 1) {
      const { error } = await sb.from("Course").update(update).eq("id", c.id);
      if (error) console.log(`  ✗ DB: ${error.message}`);
      else console.log("  ✅ DB updated");
    }
  }
  console.log("\n✅ Done.");
}

main().catch(e => { console.error(e); process.exit(1); });

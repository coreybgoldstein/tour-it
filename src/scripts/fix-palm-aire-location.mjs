import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

async function uploadImage(externalUrl, storagePath) {
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) { console.log(`    ⚠ Fetch failed (${res.status}): ${externalUrl}`); return null; }
    const ext = externalUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const buffer = await res.arrayBuffer();
    const { error } = await supabase.storage.from("tour-it-photos").upload(storagePath, buffer, { contentType, upsert: true });
    if (error) { console.log(`    ⚠ Upload failed: ${error.message}`); return null; }
    const { data } = supabase.storage.from("tour-it-photos").getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) { console.log(`    ⚠ Image error: ${err.message}`); return null; }
}

async function seedHoles(courseId) {
  const { count } = await supabase.from("Hole").select("id", { count: "exact", head: true }).eq("courseId", courseId);
  if (count > 0) return;
  const now = new Date().toISOString();
  const holes = Array.from({ length: 18 }, (_, i) => ({
    id: randomUUID(), courseId, holeNumber: i + 1, par: 4, uploadCount: 0, createdAt: now, updatedAt: now,
  }));
  const { error } = await supabase.from("Hole").insert(holes);
  if (error) console.log(`    ⚠ Hole insert: ${error.message}`);
  else console.log(`    Created 18 holes`);
}

async function main() {
  // ── Step 1: Delete wrong Sarasota records ──────────────────────────────────
  const wrongIds = [
    "0cde586a-10e2-4819-af2a-226ef4b35501", // Palm Aire CC Oaks Course - Sarasota (wrong)
    "d85b1fde-75b0-46f4-8695-6dd1c9b68aed", // Palm Aire CC Cypress Course - Sarasota (wrong)
    "ca0d5588-d32a-405d-92a0-5db45e13d77d", // Palm Aire CC Palms Course - Sarasota (wrong)
  ];

  console.log("Deleting wrong Sarasota Palm Aire records...");
  for (const id of wrongIds) {
    await supabase.from("Hole").delete().eq("courseId", id);
    const { error } = await supabase.from("Course").delete().eq("id", id);
    if (error) console.log(`  ✗ Delete failed ${id}: ${error.message}`);
    else console.log(`  ✅ Deleted ${id}`);
  }

  // ── Step 2: Update existing Oaks Course in Pompano Beach ──────────────────
  console.log("\nUpdating Oaks Course (Pompano Beach)...");
  const oaksCoverUrl = await uploadImage(
    "https://golf-pass-brightspot.s3.amazonaws.com/43/5d/5bcb96928bc0f4b5b885a36a6478/89604.jpg",
    "course-images/palm-aire-oaks-pompano-cover.jpg"
  );
  const { error: oaksErr } = await supabase.from("Course").update({
    coverImageUrl: oaksCoverUrl,
    updatedAt: new Date().toISOString(),
  }).eq("id", "79fcf458-0e28-4be8-92eb-93d5b53bf84d");
  if (oaksErr) console.log(`  ✗ ${oaksErr.message}`);
  else console.log(`  ✅ Updated Oaks (cover: ${oaksCoverUrl ?? "null"})`);

  // ── Step 3: Create Cypress Course in Pompano Beach ────────────────────────
  console.log("\nCreating Palm Aire Cypress Course (Pompano Beach)...");
  const cypressSlug = slugify("Palm Aire Country Club Cypress Course Pompano Beach");
  const cypressCoverUrl = await uploadImage(
    "https://golf-pass-brightspot.s3.amazonaws.com/0a/ea/37a4ef14ac74d7f8701a3e2a093c/89322.jpg",
    "course-images/palm-aire-cypress-pompano-cover.jpg"
  );
  const now = new Date().toISOString();
  const { data: cypress, error: cypressErr } = await supabase.from("Course").upsert({
    id: randomUUID(),
    name: "Palm Aire Country Club Cypress Course",
    slug: cypressSlug,
    city: "Pompano Beach",
    state: "FL",
    country: "US",
    zipCode: "33069",
    description: "The Cypress Course at Palm Aire Country Club is a Tom and George Fazio design from 1972, offering 6,810 yards of par-72 golf in Pompano Beach's Palm Aire community. Water hazards and strategic bunkering frame a layout resurfaced with TifEagle bermudagrass, with five sets of tees that welcome public play through Troon-managed booking.",
    coverImageUrl: cypressCoverUrl,
    logoUrl: null,
    yearEstablished: 1972,
    courseType: "PUBLIC",
    isPublic: true,
    isVerified: false,
    holeCount: 18,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  }, { onConflict: "slug", ignoreDuplicates: false }).select("id").single();
  if (cypressErr) console.log(`  ✗ ${cypressErr.message}`);
  else { console.log(`  ✅ Inserted Cypress (id: ${cypress.id})`); await seedHoles(cypress.id); }

  // ── Step 4: Create Palms Course in Pompano Beach ──────────────────────────
  console.log("\nCreating Palm Aire Palms Course (Pompano Beach)...");
  const palmsSlug = slugify("Palm Aire Country Club Palms Course Pompano Beach");
  const palmsCoverUrl = await uploadImage(
    "https://golf-pass-brightspot.s3.amazonaws.com/60/37/44420c08430992ea1a5a1c6199f5/89603.jpg",
    "course-images/palm-aire-palms-pompano-cover.jpg"
  );
  const { data: palms, error: palmsErr } = await supabase.from("Course").upsert({
    id: randomUUID(),
    name: "Palm Aire Country Club Palms Course",
    slug: palmsSlug,
    city: "Pompano Beach",
    state: "FL",
    country: "US",
    zipCode: "33069",
    description: "The original course at Palm Aire Country Club, the Palms was designed by William F. Mitchell in 1962 and later renovated by Karl Litten and Lorrie Viola in 1996. Playing 6,944 yards at par 72 in Pompano Beach, it's the longest of the three Palm Aire layouts — wide, accommodating fairways meet quick Bermuda greens that have hosted tour events and spring training legends since Frank Sinatra's era.",
    coverImageUrl: palmsCoverUrl,
    logoUrl: null,
    yearEstablished: 1962,
    courseType: "PUBLIC",
    isPublic: true,
    isVerified: false,
    holeCount: 18,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  }, { onConflict: "slug", ignoreDuplicates: false }).select("id").single();
  if (palmsErr) console.log(`  ✗ ${palmsErr.message}`);
  else { console.log(`  ✅ Inserted Palms (id: ${palms.id})`); await seedHoles(palms.id); }

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });

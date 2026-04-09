// replace-avatars.mjs
// 1. Uploads 14 new avatar PNGs to Supabase storage (overwrites old ones)
// 2. Deletes the removed avatar (10-water-bottle.png)
// 3. Reassigns a random new default avatar to anyone using an old default OR null
// Run: SUPABASE_SERVICE_ROLE_KEY=your_key node replace-avatars.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://awlbxzpevwidowxxvuef.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET = "tour-it-photos";
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;
const AVATAR_PATH = "default-avatars";

const NEW_AVATARS = [
  "01-coffee","02-burger-messy","03-golf-glove","04-sunscreen","05-rangefinder",
  "06-hotdog","07-protein-bar","08-driver","09-cheeseburger",
  "11-hamburger","12-water-jug","13-bloody-mary","14-cocktail","15-beer-can",
].map(n => `${n}.png`);

const NEW_AVATAR_URLS = NEW_AVATARS.map(f => `${STORAGE_BASE}/${AVATAR_PATH}/${f}`);

const SOURCE_DIR = "C:/Users/corey/Downloads/files_extracted";

// ── Step 1: Upload new images ──────────────────────────────────────────────
console.log("── Step 1: Uploading new avatar images ──");
for (const filename of NEW_AVATARS) {
  const filePath = join(SOURCE_DIR, filename);
  const fileBuffer = readFileSync(filePath);
  const storagePath = `${AVATAR_PATH}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType: "image/png", upsert: true });

  if (error) {
    console.error(`  FAILED ${filename}: ${error.message}`);
  } else {
    console.log(`  ✓ uploaded ${filename}`);
  }
}

// ── Step 2: Delete removed avatar ─────────────────────────────────────────
console.log("\n── Step 2: Removing old avatar (10-water-bottle.png) ──");
const { error: delError } = await supabase.storage
  .from(BUCKET)
  .remove([`${AVATAR_PATH}/10-water-bottle.png`]);
if (delError) {
  console.log(`  (skip — may not exist: ${delError.message})`);
} else {
  console.log("  ✓ deleted 10-water-bottle.png");
}

// ── Step 3: Backfill users with null OR old default avatar ─────────────────
console.log("\n── Step 3: Reassigning avatars ──");

const OLD_DEFAULT_PATTERN = `${STORAGE_BASE}/${AVATAR_PATH}/`;

// Fetch all users
const { data: allUsers, error: fetchError } = await supabase
  .from("User")
  .select("id, avatarUrl");

if (fetchError) {
  console.error("Failed to fetch users:", fetchError.message);
  process.exit(1);
}

const toUpdate = allUsers.filter(u =>
  !u.avatarUrl || u.avatarUrl.includes(OLD_DEFAULT_PATTERN)
);

console.log(`Found ${toUpdate.length} user(s) with null or default avatar.`);

function randomAvatar() {
  return NEW_AVATAR_URLS[Math.floor(Math.random() * NEW_AVATAR_URLS.length)];
}

let updated = 0;
for (const u of toUpdate) {
  const avatarUrl = randomAvatar();
  const { error: updateError } = await supabase
    .from("User")
    .update({ avatarUrl })
    .eq("id", u.id);

  if (updateError) {
    console.error(`  FAILED ${u.id}: ${updateError.message}`);
  } else {
    console.log(`  ✓ ${u.id} → ${avatarUrl.split("/").pop()}`);
    updated++;
  }
}

console.log(`\nDone. Updated ${updated} / ${toUpdate.length} users.`);

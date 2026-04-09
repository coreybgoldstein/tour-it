// backfill-avatars.mjs
// Assigns a random default avatar to every User row with a null avatarUrl
// Run with: node backfill-avatars.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://awlbxzpevwidowxxvuef.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
  console.error("Run with: SUPABASE_SERVICE_ROLE_KEY=your_key node backfill-avatars.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/tour-it-photos`;
const DEFAULT_AVATARS = [
  "01-coffee","02-burger-happy","03-golf-glove","04-sunscreen","05-rangefinder",
  "06-hotdog","07-snack-bag","08-golf-club","09-burger-chill","10-water-bottle",
  "11-burger-orange","12-water-bottle-yellow","13-bloody-mary","14-grape-soda","15-beer-can",
].map(n => `${STORAGE_BASE}/default-avatars/${n}.png`);

function randomAvatar() {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

const { data: users, error } = await supabase
  .from("User")
  .select("id")
  .is("avatarUrl", null);

if (error) {
  console.error("Failed to fetch users:", error.message);
  process.exit(1);
}

if (!users || users.length === 0) {
  console.log("No users with null avatarUrl found. Nothing to do.");
  process.exit(0);
}

console.log(`Found ${users.length} user(s) with no avatar. Assigning random defaults...`);

let updated = 0;
for (const u of users) {
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

console.log(`\nDone. Updated ${updated} / ${users.length} users.`);

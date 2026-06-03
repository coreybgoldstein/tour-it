// One-off: upload the June (Wilson) competition banner/modal assets to
// Supabase Storage. The repo gitignores *.png/*.jpg, so static product
// imagery lives in the tour-it-photos bucket, not in /public.
//
// Run with: node src/scripts/upload-wilson-competition-assets.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const BUCKET = "tour-it-photos";
const LOCAL_DIR = "public/competitions/wilson";
const FILES = ["wilson-logo.png", "staff-balls.png", "rope-hat.png"];

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  for (const name of FILES) {
    const bytes = await readFile(`${LOCAL_DIR}/${name}`);
    const path = `competitions/wilson/${name}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(`upload failed (${name}): ${error.message}`);
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    console.log(`${name} -> ${data.publicUrl}`);
  }
  console.log("DONE");
}

main().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});

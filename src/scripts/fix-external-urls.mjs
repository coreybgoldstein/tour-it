#!/usr/bin/env node
/**
 * For any Top 100 course whose logoUrl / coverImageUrl points at an external host
 * (not our Supabase bucket), download → re-upload to tour-it-photos and rewrite
 * the DB field. If the fetch fails, null the field so a later run picks it up.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SB_HOST = "awlbxzpevwidowxxvuef";

function ext(ct, fallback = "jpg") {
  if (!ct) return fallback;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fallback;
}

async function upload(url, courseId, kind) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const ct = res.headers.get("content-type") || "";
  const e = ext(ct);
  const buf = await res.arrayBuffer();
  const p = `course-images/${courseId}-${kind}.${e}`;
  const { error } = await sb.storage
    .from("tour-it-photos")
    .upload(p, new Uint8Array(buf), { contentType: ct || `image/${e}`, upsert: true });
  if (error) return null;
  const { data: { publicUrl } } = sb.storage.from("tour-it-photos").getPublicUrl(p);
  return `${publicUrl}?v=${Date.now()}`;
}

const ids = readFileSync(path.join(REPO_ROOT, "top100-ids.txt"), "utf8").split(/\s+/).filter(Boolean);
const all = [];
for (let i = 0; i < ids.length; i += 100) {
  const { data } = await sb.from("Course").select("id,name,logoUrl,coverImageUrl").in("id", ids.slice(i, i + 100));
  all.push(...(data || []));
}

let fixed = 0, nulled = 0;
for (const c of all) {
  const updates = {};
  if (c.logoUrl && !c.logoUrl.includes(SB_HOST)) {
    const newUrl = await upload(c.logoUrl, c.id, "logo");
    if (newUrl) { updates.logoUrl = newUrl; fixed++; console.error(`  ✓ logo  ${c.name}`); }
    else { updates.logoUrl = null; nulled++; console.error(`  ✗ logo  ${c.name} (fetch fail — nulled)`); }
  }
  if (c.coverImageUrl && !c.coverImageUrl.includes(SB_HOST)) {
    const newUrl = await upload(c.coverImageUrl, c.id, "cover");
    if (newUrl) { updates.coverImageUrl = newUrl; fixed++; console.error(`  ✓ cover ${c.name}`); }
    else { updates.coverImageUrl = null; nulled++; console.error(`  ✗ cover ${c.name} (fetch fail — nulled)`); }
  }
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    await sb.from("Course").update(updates).eq("id", c.id);
  }
}
console.error(`\nFixed ${fixed} URLs, nulled ${nulled} broken.`);

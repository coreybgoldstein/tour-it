#!/usr/bin/env node

/**
 * Tour It — Commit ONE verified cover image for a top course.
 *
 * Takes a LOCAL file that a human has already eyeballed and confirmed is a
 * genuine high-res on-course photo. Inspects it, uploads to
 * tour-it-photos/course-images/{courseId}-cover.{ext} (upsert), and patches
 * Course.coverImageUrl (only if currently null, unless --force).
 *
 * Usage:
 *   node src/scripts/commit-top-cover.mjs --course <id> --file /tmp/x.jpg
 *   node src/scripts/commit-top-cover.mjs --course <id> --file /tmp/x.jpg --force
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }
const courseId = arg("--course");
const file = arg("--file");
const force = process.argv.includes("--force");
if (!courseId || !file) { console.error("Usage: --course <id> --file <path> [--force]"); process.exit(1); }

function fmt(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  return null;
}
function jpegSize(b) { let i = 2; while (i < b.length) { if (b[i] !== 0xff) return null; const m = b[i + 1]; i += 2; if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5) }; if (i + 2 > b.length) return null; i += b.readUInt16BE(i); } return null; }
function pngSize(b) { return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; }

async function main() {
  const buf = readFileSync(file);
  const format = fmt(buf);
  if (!format) { console.error("Not a jpeg/png/webp."); process.exit(1); }
  const size = format === "jpeg" ? jpegSize(buf) : format === "png" ? pngSize(buf) : null;
  if (size) console.error(`Image: ${format} ${size.width}x${size.height}`);
  if (size && size.width < 1000) console.error("WARNING: width < 1000px — below quality bar.");

  const { data: course } = await supabase.from("Course").select("id, name, coverImageUrl").eq("id", courseId).single();
  if (!course) { console.error("Course not found:", courseId); process.exit(1); }
  if (course.coverImageUrl && !force) { console.error(`Course already has a cover (${course.name}). Use --force to overwrite.`); process.exit(1); }

  const ext = format === "jpeg" ? "jpg" : format;
  const ct = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
  const filePath = `course-images/${courseId}-cover.${ext}`;
  const { error: upErr } = await supabase.storage.from("tour-it-photos").upload(filePath, new Uint8Array(buf), { contentType: ct, upsert: true });
  if (upErr) { console.error("Upload failed:", upErr.message); process.exit(1); }
  const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(filePath);
  const finalUrl = `${publicUrl}?v=${Date.now()}`;
  const { error: dbErr } = await supabase.from("Course").update({ coverImageUrl: finalUrl, updatedAt: new Date().toISOString() }).eq("id", courseId);
  if (dbErr) { console.error("DB update failed:", dbErr.message); process.exit(1); }
  console.error(`✓ ${course.name} cover set -> ${filePath}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

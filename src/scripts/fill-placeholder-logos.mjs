#!/usr/bin/env node

/**
 * Tour It — Placeholder logo fallback
 *
 * Generates a styled SVG initials-logo for every course in a supplied ID list
 * that still has a null logoUrl after the bulk seeder runs. Uploads to
 * tour-it-photos/course-images/{courseId}-logo.svg and updates the Course row.
 *
 * Usage:
 *   node src/scripts/fill-placeholder-logos.mjs --ids-file columbia-radius-ids.txt
 *   node src/scripts/fill-placeholder-logos.mjs --ids-file columbia-radius-ids.txt --dry
 *
 * Style:
 *   200x200 SVG, bg #0d1f14, rounded 24, 4px #2d7a42 border,
 *   centered text in Playfair Display 80px bold #4da862, course initials (max 3).
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { idsFile: null, dry: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids-file") out.idsFile = args[i + 1];
    if (args[i] === "--dry") out.dry = true;
  }
  return out;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "at",
  "and",
  "&",
  "in",
  "on",
  "for",
  "to",
  "by",
  "le",
  "la",
  "de",
  "del",
  "los",
  "las",
]);

function initialsFor(name) {
  if (!name) return "??";
  // Strip parenthetical/suffix bits
  let n = name.replace(/\(.*?\)/g, " ").trim();
  // Split on whitespace and punctuation
  const words = n
    .split(/[\s\-_/,.'"]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return name.slice(0, 2).toUpperCase();

  // Take first letter of each significant word, max 3
  const letters = words.map((w) => w[0].toUpperCase()).filter((c) => /[A-Z0-9]/.test(c));
  if (letters.length === 0) return name.slice(0, 2).toUpperCase();
  if (letters.length === 1) return letters[0] + (words[0][1] ? words[0][1].toUpperCase() : "");
  return letters.slice(0, 3).join("");
}

function buildSvg(initials) {
  // Font size scales down a touch for 3-letter initials so they fit.
  const fontSize = initials.length >= 3 ? 70 : 80;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <clipPath id="clip">
      <rect x="0" y="0" width="200" height="200" rx="24" ry="24"/>
    </clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="200" height="200" fill="#0d1f14"/>
    <rect x="2" y="2" width="196" height="196" rx="22" ry="22" fill="none" stroke="#2d7a42" stroke-width="4"/>
    <text x="100" y="100" text-anchor="middle" dominant-baseline="central"
      font-family="'Playfair Display', 'Times New Roman', Georgia, serif"
      font-size="${fontSize}" font-weight="700" fill="#4da862" letter-spacing="2">${initials}</text>
  </g>
</svg>
`;
}

async function main() {
  const args = parseArgs();
  if (!args.idsFile) {
    console.error("Usage: --ids-file <file> [--dry]");
    process.exit(1);
  }
  const ids = readFileSync(args.idsFile, "utf8").split(/\s+/).filter(Boolean);
  console.error(`Loaded ${ids.length} candidate IDs from ${args.idsFile}`);

  // Pull current state for these courses
  const all = [];
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("Course")
      .select("id, name, city, state, logoUrl")
      .in("id", slice);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    all.push(...(data || []));
  }

  const noLogo = all.filter((c) => !c.logoUrl);
  console.error(
    `Of ${all.length} courses, ${noLogo.length} still have null logoUrl — generating placeholders.`
  );
  if (args.dry) {
    for (const c of noLogo.slice(0, 20)) {
      console.error(`  ${initialsFor(c.name).padEnd(4)}  ${c.name}  (${c.city}, ${c.state})`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const c of noLogo) {
    const initials = initialsFor(c.name);
    const svg = buildSvg(initials);
    const filePath = `course-images/${c.id}-logo.svg`;
    const { error: upErr } = await supabase.storage
      .from("tour-it-photos")
      .upload(filePath, new Uint8Array(Buffer.from(svg, "utf8")), {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (upErr) {
      console.error(`  ✗ Upload failed for ${c.name}: ${upErr.message}`);
      fail++;
      continue;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("tour-it-photos").getPublicUrl(filePath);

    const { error: dbErr } = await supabase
      .from("Course")
      .update({ logoUrl: publicUrl, updatedAt: new Date().toISOString() })
      .eq("id", c.id);
    if (dbErr) {
      console.error(`  ✗ DB update failed for ${c.name}: ${dbErr.message}`);
      fail++;
      continue;
    }
    ok++;
    console.error(`  ✓ ${initials.padEnd(4)} ${c.name}`);
  }

  console.error(`\nDone. Placeholders applied: ${ok}, failed: ${fail}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Snapshot field coverage for the Top 100 course IDs. Writes top100-snapshot.json
 * + prints a summary to stderr.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = readFileSync(path.join(REPO_ROOT, "top100-ids.txt"), "utf8")
  .split(/\s+/)
  .filter(Boolean);

const all = [];
for (let i = 0; i < ids.length; i += 100) {
  const slice = ids.slice(i, i + 100);
  const { data } = await sb
    .from("Course")
    .select("id, name, city, state, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, holeCount, latitude, longitude")
    .in("id", slice);
  all.push(...(data || []));
}

const holesById = new Map();
for (let i = 0; i < ids.length; i += 100) {
  const slice = ids.slice(i, i + 100);
  const { data } = await sb.from("Hole").select("courseId, holeNumber, par, yardage").in("courseId", slice);
  for (const h of data || []) {
    if (!holesById.has(h.courseId)) holesById.set(h.courseId, []);
    holesById.get(h.courseId).push(h);
  }
}

const snap = [];
let wDesc = 0, wCover = 0, wLogo = 0, wRealLogo = 0, wYear = 0, wAccess = 0, wLatLng = 0, wWeb = 0, wScorecard = 0, wPhone = 0;
for (const c of all) {
  const holes = holesById.get(c.id) || [];
  const yardageFilled = holes.filter((h) => h.yardage != null && h.par != null).length;
  const isPlaceholderLogo = c.logoUrl && /-logo\.svg(?:\?.*)?$/.test(c.logoUrl);
  const hasRealLogo = !!c.logoUrl && !isPlaceholderLogo;

  if (c.description) wDesc++;
  if (c.coverImageUrl) wCover++;
  if (c.logoUrl) wLogo++;
  if (hasRealLogo) wRealLogo++;
  if (c.yearEstablished) wYear++;
  if (c.courseType) wAccess++;
  if (c.latitude && c.longitude) wLatLng++;
  if (c.websiteUrl) wWeb++;
  if (c.phone) wPhone++;
  if (yardageFilled >= 18 || (yardageFilled === 9 && holes.length === 9)) wScorecard++;

  snap.push({
    id: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    hasDescription: !!c.description,
    hasCover: !!c.coverImageUrl,
    hasLogo: !!c.logoUrl,
    hasRealLogo,
    hasPlaceholderLogo: isPlaceholderLogo,
    yearEstablished: c.yearEstablished,
    courseType: c.courseType,
    hasLatLng: !!(c.latitude && c.longitude),
    hasWebsite: !!c.websiteUrl,
    hasPhone: !!c.phone,
    holeCount: c.holeCount,
    fullScorecardHoles: yardageFilled,
  });
}

writeFileSync(path.join(REPO_ROOT, "top100-snapshot.json"), JSON.stringify(snap, null, 2));

const N = all.length;
const pct = (n) => `${n}/${N} (${Math.round((100 * n) / N)}%)`;
console.error("──── Top 100 coverage snapshot ────");
console.error(`Courses present in DB:  ${N}/${ids.length}`);
console.error(`Description:            ${pct(wDesc)}`);
console.error(`Cover image:            ${pct(wCover)}`);
console.error(`Logo (any):             ${pct(wLogo)}`);
console.error(`  - real:               ${wRealLogo}`);
console.error(`  - placeholder:        ${wLogo - wRealLogo}`);
console.error(`Year established:       ${pct(wYear)}`);
console.error(`Access type:            ${pct(wAccess)}`);
console.error(`Lat/Lng:                ${pct(wLatLng)}`);
console.error(`Website URL:            ${pct(wWeb)}`);
console.error(`Phone:                  ${pct(wPhone)}`);
console.error(`Full scorecard (≥18):   ${pct(wScorecard)}`);

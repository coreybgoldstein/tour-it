#!/usr/bin/env node

/**
 * Scorecard seeder — fills par + championship yardage + handicap rank for
 * each Hole of a course via Anthropic research.
 *
 * Usage:
 *   node src/scripts/seed-scorecards.mjs --ids "<id1>,<id2>"
 *   node src/scripts/seed-scorecards.mjs --slugs "<itinerary-slug>"
 *   node src/scripts/seed-scorecards.mjs --missing-itinerary  (every course in any itinerary)
 *   node src/scripts/seed-scorecards.mjs --force              (overwrite even if filled)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a golf scorecard researcher.

For each course you are given, return the championship-tee scorecard:
par, yardage, and handicap difficulty rank for every hole.

Yardage = the longest set of tees commonly published (Black/Tips/Tournament).
Handicap rank = stroke index 1 (hardest) to 18 (easiest), or 1–9 for a 9-hole layout.
Each rank must appear exactly once.

Return ONLY a JSON array. One object per course:
{
  "courseId": "<exact id from input>",
  "courseName": "name",
  "holeCount": 9 | 18,
  "holes": [
    { "holeNumber": 1, "par": 4, "yardage": 410, "handicapRank": 9 },
    ...
  ],
  "sourceNotes": "where the data came from in 1 line"
}

If you cannot confidently confirm any specific value, use null for that field.
Never fabricate. Real PGA / USGA / official-site sources only.`;

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { ids: [], slugs: [], missingItinerary: false, force: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--ids" && a[i + 1]) out.ids = a[i + 1].split(",").map((s) => s.trim());
    if (a[i] === "--slugs" && a[i + 1]) out.slugs = a[i + 1].split(",").map((s) => s.trim());
    if (a[i] === "--missing-itinerary") out.missingItinerary = true;
    if (a[i] === "--force") out.force = true;
  }
  return out;
}

async function research(batch) {
  const list = batch.map((c, i) =>
    `${i + 1}. courseId: "${c.id}" | name: "${c.name}" | location: ${c.city || "?"}, ${c.state || "?"} | holes: ${c.holeCount}`
  ).join("\n");
  console.log(`  🔍 ${batch.map((c) => c.name).join(", ")}`);
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{ role: "user", content: `Research scorecards for:\n\n${list}` }],
  });
  const raw = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { return []; }
}

async function applyScorecard(course, sc) {
  if (!sc?.holes || sc.holes.length === 0) return { applied: 0, skipped: 0 };
  const { data: holes } = await sb.from("Hole").select("id, holeNumber, par, yardage, handicapRank").eq("courseId", course.id);
  if (!holes) return { applied: 0, skipped: 0 };
  const byNum = Object.fromEntries(holes.map((h) => [h.holeNumber, h]));

  let applied = 0, skipped = 0;
  for (const h of sc.holes) {
    const existing = byNum[h.holeNumber];
    if (!existing) { skipped++; continue; }
    const updates = {};
    if (h.par != null && (course.force || existing.par == null || existing.par === 4)) updates.par = h.par;
    if (h.yardage != null && (course.force || existing.yardage == null)) updates.yardage = h.yardage;
    if (h.handicapRank != null && (course.force || existing.handicapRank == null)) updates.handicapRank = h.handicapRank;
    if (Object.keys(updates).length === 0) { skipped++; continue; }
    updates.updatedAt = new Date().toISOString();
    const { error } = await sb.from("Hole").update(updates).eq("id", existing.id);
    if (error) console.log(`    ⚠ hole ${h.holeNumber}: ${error.message}`);
    else applied++;
  }
  return { applied, skipped };
}

async function main() {
  const args = parseArgs();
  let ids = [...args.ids];

  if (args.slugs.length > 0) {
    const { data: its } = await sb.from("TripItinerary").select("id").in("slug", args.slugs);
    const { data: stops } = await sb.from("TripItineraryStop").select("courseId").in("itineraryId", (its ?? []).map((i) => i.id));
    ids.push(...(stops ?? []).map((s) => s.courseId));
  }
  if (args.missingItinerary) {
    const { data: stops } = await sb.from("TripItineraryStop").select("courseId");
    ids.push(...(stops ?? []).map((s) => s.courseId));
  }
  ids = [...new Set(ids)];
  if (ids.length === 0) {
    console.log("Pass --ids, --slugs, or --missing-itinerary.");
    process.exit(0);
  }

  const { data: courses } = await sb
    .from("Course")
    .select("id, name, city, state, holeCount")
    .in("id", ids);
  if (!courses?.length) { console.log("No courses found."); process.exit(0); }

  // Filter to those that need updates (any hole missing yardage), unless --force
  let targets = courses;
  if (!args.force) {
    const filtered = [];
    for (const c of courses) {
      const { data: holes } = await sb.from("Hole").select("yardage").eq("courseId", c.id);
      const hasMissing = (holes ?? []).some((h) => h.yardage == null);
      if (hasMissing) filtered.push(c);
    }
    targets = filtered;
  }
  if (targets.length === 0) { console.log("All targets already have yardage filled."); process.exit(0); }

  console.log(`\n🏌️  Scorecard seeder — ${targets.length} courses\n`);

  // Batch in 3 to keep the prompt small + fit max_tokens
  const batches = [];
  for (let i = 0; i < targets.length; i += 3) batches.push(targets.slice(i, i + 3));

  for (let b = 0; b < batches.length; b++) {
    console.log(`Batch ${b + 1}/${batches.length}:`);
    const research_result = await research(batches[b]);
    const byId = {};
    research_result.forEach((r) => { if (r.courseId) byId[r.courseId] = r; });
    for (const c of batches[b]) {
      const sc = byId[c.id] ?? research_result.find((r) => r.courseName?.toLowerCase() === c.name.toLowerCase());
      if (!sc) { console.log(`  ✗ ${c.name}: no data`); continue; }
      const { applied, skipped } = await applyScorecard({ ...c, force: args.force }, sc);
      console.log(`  ✅ ${c.name}: ${applied} holes updated, ${skipped} skipped`);
      if (sc.sourceNotes) console.log(`     ${sc.sourceNotes.slice(0, 140)}`);
    }
    if (b < batches.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

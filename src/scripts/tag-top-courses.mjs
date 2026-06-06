#!/usr/bin/env node

/**
 * Tour It — Tag top public/resort courses with nationalRank + data-gap report
 *
 * Source of truth: top100-matched.json (produced by match-top100-public.mjs),
 * the hand-verified mapping of Golf Digest's "Best Public/Resort Courses You
 * Can Play" to existing Course rows. We do NOT re-match here — we trust those
 * verified courseIds.
 *
 * What it does:
 *   1. Reads top100-matched.json. For each entry, sets Course.nationalRank to
 *      the list rank (lower = higher). UPDATE ONLY — never inserts.
 *   2. Clears nationalRank on any course no longer in the list (so the set
 *      stays in sync if the list shrinks).
 *   3. Produces a DATA-GAP report: of the tagged top courses, which are
 *      under-seeded — missing any of description, coverImageUrl, logoUrl,
 *      yearEstablished, or access (courseType). These are the courses we need
 *      to fill data for. Written to top-courses-data-gaps.json + printed.
 *
 * Writes are gated behind --write. Without it, this is a dry run that only
 * reports what WOULD change and prints the data-gap list.
 *
 * Run:
 *   node src/scripts/tag-top-courses.mjs            (dry run + gap report)
 *   node src/scripts/tag-top-courses.mjs --write    (apply nationalRank)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const WRITE = process.argv.includes("--write");

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

// A course is "well-seeded" when all five are non-null. (access == courseType)
const SEED_FIELDS = ["description", "coverImageUrl", "logoUrl", "yearEstablished", "courseType"];

function missingFields(row) {
  return SEED_FIELDS.filter((f) => row[f] === null || row[f] === undefined || row[f] === "");
}

async function main() {
  console.error(WRITE ? GREEN("\n=== TAG TOP COURSES (WRITE MODE) ===\n")
                      : YELLOW("\n=== TAG TOP COURSES (DRY RUN — no writes) ===\n"));

  // ── Load verified lists ───────────────────────────────────────────────────
  // top100-matched.json = Golf Digest Best Public top 100 (ranks 1-100).
  // top101-200-matched.json = the Golfweek + GOLF Magazine merge extension
  // (ranks 101+), produced by match-extra-public.mjs. Both are tagged together
  // so the stale-clear logic sees the full set.
  const matched = JSON.parse(readFileSync(path.join(REPO_ROOT, "top100-matched.json"), "utf8"));
  try {
    const extra = JSON.parse(readFileSync(path.join(REPO_ROOT, "top101-200-matched.json"), "utf8"));
    matched.push(...extra);
    console.error(`Loaded extension list: ${extra.length} (ranks 101+)\n`);
  } catch {
    console.error("No top101-200-matched.json found — tagging top 100 only.\n");
  }
  // Dedupe to the lowest (best) rank per courseId — a course mapped twice keeps
  // its highest standing.
  const rankById = new Map();
  for (const m of matched) {
    if (!m.courseId) continue;
    const prev = rankById.get(m.courseId);
    if (prev === undefined || m.rank < prev) rankById.set(m.courseId, m.rank);
  }
  const targetIds = [...rankById.keys()];
  console.error(`Verified top courses to tag: ${targetIds.length}\n`);

  // ── Fetch current rows for the target set ──────────────────────────────────
  const rows = [];
  const SELECT = "id, name, city, state, nationalRank, description, coverImageUrl, logoUrl, yearEstablished, courseType, uploadCount";
  for (let i = 0; i < targetIds.length; i += 100) {
    const chunk = targetIds.slice(i, i + 100);
    const { data, error } = await supabase.from("Course").select(SELECT).in("id", chunk);
    if (error) { console.error("Fetch error:", error.message); process.exit(1); }
    rows.push(...(data || []));
  }
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // Any target id that didn't come back no longer exists in DB — report, skip.
  const vanished = targetIds.filter((id) => !rowById.has(id));
  if (vanished.length) {
    console.error(RED(`WARNING: ${vanished.length} verified courseId(s) not found in DB (skipped):`));
    vanished.forEach((id) => console.error(`  ${id}`));
    console.error("");
  }

  // ── Find rows currently tagged that should be cleared (not in target set) ──
  const { data: alreadyTagged } = await supabase
    .from("Course").select("id, name, nationalRank").not("nationalRank", "is", null);
  const toClear = (alreadyTagged || []).filter((r) => !rankById.has(r.id));

  // ── Apply nationalRank ─────────────────────────────────────────────────────
  let setCount = 0, clearCount = 0;
  if (WRITE) {
    for (const id of targetIds) {
      if (!rowById.has(id)) continue;
      const rank = rankById.get(id);
      const { error } = await supabase.from("Course").update({ nationalRank: rank }).eq("id", id);
      if (error) { console.error(`  set ${id} -> ${rank} FAILED: ${error.message}`); continue; }
      setCount++;
    }
    for (const r of toClear) {
      const { error } = await supabase.from("Course").update({ nationalRank: null }).eq("id", r.id);
      if (error) { console.error(`  clear ${r.id} FAILED: ${error.message}`); continue; }
      clearCount++;
    }
    console.error(GREEN(`Set nationalRank on ${setCount} courses. Cleared ${clearCount} stale tags.\n`));
  } else {
    console.error(DIM(`Would set nationalRank on ${rowById.size} courses.`));
    console.error(DIM(`Would clear nationalRank on ${toClear.length} stale courses.\n`));
  }

  // ── DATA-GAP REPORT ─────────────────────────────────────────────────────────
  const gaps = [];
  for (const id of targetIds) {
    const r = rowById.get(id);
    if (!r) continue;
    const missing = missingFields(r);
    if (missing.length === 0) continue;
    gaps.push({
      rank: rankById.get(id),
      courseId: id,
      name: r.name,
      city: r.city,
      state: r.state,
      missing,
      uploadCount: r.uploadCount ?? 0,
    });
  }
  gaps.sort((a, b) => a.rank - b.rank);

  const wellSeeded = rowById.size - gaps.length;
  console.error(`=== DATA-GAP REPORT ===`);
  console.error(`Well-seeded (all ${SEED_FIELDS.length} fields): ${GREEN(`${wellSeeded}/${rowById.size}`)}`);
  console.error(`Need data:                          ${RED(`${gaps.length}/${rowById.size}`)}\n`);

  for (const g of gaps) {
    console.error(
      `  ${RED("#" + String(g.rank).padStart(3))} ${String(g.name).padEnd(38)} ` +
      `${DIM((g.city || "") + ", " + (g.state || ""))}`
    );
    console.error(`        missing: ${YELLOW(g.missing.join(", "))}`);
  }

  writeFileSync(
    path.join(REPO_ROOT, "top-courses-data-gaps.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), wellSeeded, total: rowById.size, gaps }, null, 2)
  );
  console.error(`\nWrote top-courses-data-gaps.json (${gaps.length} courses needing data).`);
  if (!WRITE) console.error(YELLOW("\nDRY RUN — re-run with --write to apply nationalRank."));
  console.error("");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

#!/usr/bin/env node

/**
 * Recompute Upload.likeCount from COUNT(Like) for every upload.
 *
 * Why: the old client-side useLike did a read-modify-write on the
 * denormalized counter, which drifted any time two users liked
 * concurrently. After fixing the hook to mutate via /api/likes/toggle
 * (which writes the count back from the source-of-truth COUNT(*)),
 * existing drift remains in the DB until this script runs.
 *
 * Safe to re-run periodically — re-syncs idempotently.
 *
 * Usage: node src/scripts/resync-like-counts.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const dryRun = process.argv.includes("--dry-run");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fetchAll(table, columns) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(`\n♥  Resyncing Upload.likeCount${dryRun ? " (DRY RUN)" : ""}\n${"=".repeat(50)}\n`);

  console.log("Loading all likes…");
  const likes = await fetchAll("Like", "uploadId");
  const trueCountByUpload = new Map();
  for (const l of likes) {
    if (!l.uploadId) continue;
    trueCountByUpload.set(l.uploadId, (trueCountByUpload.get(l.uploadId) ?? 0) + 1);
  }
  console.log(`  ${likes.length} total like rows across ${trueCountByUpload.size} uploads\n`);

  console.log("Loading all uploads with their stored counters…");
  const uploads = await fetchAll("Upload", "id, likeCount");
  console.log(`  ${uploads.length} uploads to check\n`);

  let driftCount = 0;
  let updates = 0;
  const examples = [];

  for (const u of uploads) {
    const trueCount = trueCountByUpload.get(u.id) ?? 0;
    const stored = u.likeCount ?? 0;
    if (trueCount !== stored) {
      driftCount++;
      if (examples.length < 10) {
        examples.push({ id: u.id, stored, trueCount, delta: trueCount - stored });
      }
      if (!dryRun) {
        const { error } = await sb.from("Upload").update({ likeCount: trueCount }).eq("id", u.id);
        if (error) {
          console.error(`  ✗ ${u.id}: ${error.message}`);
        } else {
          updates++;
        }
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Uploads with drift: ${driftCount} / ${uploads.length}`);
  if (examples.length > 0) {
    console.log(`\nFirst ${examples.length} examples (stored → true, delta):`);
    for (const e of examples) {
      const arrow = e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
      console.log(`  ${e.id}  ${e.stored} → ${e.trueCount}  (${arrow})`);
    }
  }
  if (dryRun) {
    console.log(`\nDry run — no writes performed. Re-run without --dry-run to fix.`);
  } else {
    console.log(`\nUpdates written: ${updates}`);
  }
  console.log("");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

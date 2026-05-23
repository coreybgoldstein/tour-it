// One-off audit: scan Supabase Storage for user-upload files that have
// no corresponding Upload row. These are casualties of the pre-2026-05-23
// upload flow where storage writes happened before the DB insert and any
// post-storage failure (FULL_ROUND holeId constraint, network blip,
// backgrounded tab) orphaned the file.
//
// Strategy:
//   1) Pull every Upload.mediaUrl and storagePath-equivalent into a set
//   2) Walk the user-upload prefixes of `tour-it-photos` (the only bucket
//      that holds user-photo content; videos go to Cloudflare Stream)
//   3) For each leaf file, check if its public URL appears in the set
//   4) Report orphans grouped by user
//
// Excludes well-known system prefixes that aren't user uploads:
//   - default-avatars/   system avatar pool
//   - course-images/     course covers/logos
//   - any folder name that isn't a UUID-shaped userId
//
// Run: node src/scripts/find-orphan-uploads.mjs [--delete]
// Without --delete it's read-only.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DELETE = process.argv.includes("--delete");
const BUCKET = "tour-it-photos";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_PREFIXES = new Set(["default-avatars", "course-images"]);

async function listAll(path) {
  const out = [];
  let offset = 0;
  // Supabase storage list returns max 100 per call
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list(path, { limit: 100, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }
  return out;
}

function isFile(entry) {
  // Folders have null/empty metadata; files have a size
  return !!(entry.metadata && typeof entry.metadata.size === "number");
}

async function main() {
  console.log("Building reference set from Upload.mediaUrl…");
  // Pull all non-empty mediaUrls in batches of 1000
  const knownPaths = new Set();
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("Upload")
      .select("mediaUrl")
      .neq("mediaUrl", "")
      .not("mediaUrl", "is", null)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      // mediaUrl looks like https://{ref}.supabase.co/storage/v1/object/public/tour-it-photos/{path}
      const m = r.mediaUrl?.match(/tour-it-photos\/(.+)$/);
      if (m) knownPaths.add(m[1]);
    }
    if (data.length < PAGE) break;
    page++;
  }
  console.log("Known photo paths in Upload table:", knownPaths.size);

  console.log("\nWalking storage bucket…");
  const top = await listAll("");
  const userFolders = top.filter(e => !isFile(e) && UUID_RE.test(e.name) && !SYSTEM_PREFIXES.has(e.name));
  console.log("User folders to scan:", userFolders.length);

  const orphans = [];
  let scanned = 0;
  for (const userFolder of userFolders) {
    const userId = userFolder.name;
    const courses = await listAll(userId);
    for (const courseFolder of courses) {
      if (isFile(courseFolder)) {
        // top-level file directly under user/ — could be a profile picture
        // e.g. avatar uploads. Skip those.
        continue;
      }
      const courseId = courseFolder.name;
      const holes = await listAll(`${userId}/${courseId}`);
      for (const holeFolder of holes) {
        if (isFile(holeFolder)) continue;
        const holeOrFormat = holeFolder.name;
        const files = await listAll(`${userId}/${courseId}/${holeOrFormat}`);
        for (const f of files) {
          if (!isFile(f)) continue;
          const fullPath = `${userId}/${courseId}/${holeOrFormat}/${f.name}`;
          scanned++;
          if (!knownPaths.has(fullPath)) {
            orphans.push({
              path: fullPath,
              userId,
              courseId,
              holeOrFormat,
              filename: f.name,
              size: f.metadata?.size ?? 0,
              created: f.created_at,
            });
          }
        }
      }
    }
  }
  console.log(`Scanned ${scanned} files. Orphans: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log("\n✓ No orphan files found. Storage is consistent with Upload table.");
    return;
  }

  // Group orphans by user with display info
  const byUser = new Map();
  for (const o of orphans) {
    if (!byUser.has(o.userId)) byUser.set(o.userId, []);
    byUser.get(o.userId).push(o);
  }

  console.log(`\nOrphans grouped by user (${byUser.size} users):\n`);
  for (const [userId, files] of byUser) {
    const { data: u } = await sb.from("User").select("username, email, displayName").eq("id", userId).maybeSingle();
    const label = u ? `@${u.username} (${u.email})` : `[user not found: ${userId}]`;
    console.log(`${label} — ${files.length} orphan(s):`);
    for (const f of files) {
      const sizeKb = Math.round(f.size / 1024);
      console.log(`  ${f.holeOrFormat}/${f.filename}  (${sizeKb}KB, ${f.created})`);
    }
    console.log("");
  }

  if (DELETE) {
    console.log(`\n--delete passed — removing ${orphans.length} orphan files…`);
    // Storage remove can handle up to 1000 paths per call
    const chunk = 100;
    for (let i = 0; i < orphans.length; i += chunk) {
      const paths = orphans.slice(i, i + chunk).map(o => o.path);
      const { error } = await sb.storage.from(BUCKET).remove(paths);
      if (error) console.error("delete error:", error.message);
      else console.log(`  removed ${paths.length} files`);
    }
    console.log("Done.");
  } else {
    console.log("(Read-only mode. Re-run with --delete to remove these files.)");
  }
}

main().catch(err => { console.error(err); process.exit(1); });

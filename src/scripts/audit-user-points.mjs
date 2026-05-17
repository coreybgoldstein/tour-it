// Audit a single user's points: compare ledger sum vs UserProgression.totalPoints
// and produce a full breakdown by action so we can prove every point is
// accounted for. Run with the username argument:
//   node src/scripts/audit-user-points.mjs jlutt

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const username = process.argv[2];
if (!username) {
  console.error("Usage: node src/scripts/audit-user-points.mjs <username>");
  process.exit(1);
}

async function fetchAll(table, columns, filterFn) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const { data: user } = await sb
    .from("User")
    .select("id, username, displayName, createdAt")
    .eq("username", username)
    .maybeSingle();
  if (!user) { console.error(`No user with username "${username}"`); process.exit(1); }

  console.log(`\n=== Audit: ${user.displayName ?? user.username} (${user.id}) ===`);
  console.log(`Joined: ${user.createdAt}\n`);

  // 1. Progression row
  const { data: prog } = await sb
    .from("UserProgression")
    .select("totalPoints, weeklyPoints, monthlyPoints, level, rank, weekReset, monthReset, updatedAt")
    .eq("userId", user.id)
    .maybeSingle();
  if (!prog) { console.error("No UserProgression row!"); process.exit(1); }
  console.log("UserProgression:");
  console.log(`  totalPoints:   ${prog.totalPoints}`);
  console.log(`  weeklyPoints:  ${prog.weeklyPoints}`);
  console.log(`  monthlyPoints: ${prog.monthlyPoints}`);
  console.log(`  level/rank:    L${prog.level} ${prog.rank}`);
  console.log(`  weekReset:     ${prog.weekReset ?? "(null)"}`);
  console.log(`  monthReset:    ${prog.monthReset ?? "(null)"}`);
  console.log(`  updatedAt:     ${prog.updatedAt}\n`);

  // 2. Full ledger for this user
  const ledger = await fetchAll(
    "UserPointsLedger",
    "id, action, points, referenceId, createdAt, metadata",
    (q) => q.eq("userId", user.id)
  );

  const ledgerSum = ledger.reduce((s, r) => s + r.points, 0);
  console.log(`Ledger rows: ${ledger.length}, sum: ${ledgerSum}`);
  console.log(`Match? ${ledgerSum === prog.totalPoints ? "✅ YES" : `❌ NO — drift of ${prog.totalPoints - ledgerSum}`}\n`);

  // 3. Breakdown by action
  const byAction = {};
  for (const r of ledger) {
    const k = r.action;
    byAction[k] = byAction[k] || { count: 0, points: 0 };
    byAction[k].count++;
    byAction[k].points += r.points;
  }
  console.log("Points by action:");
  Object.entries(byAction).sort((a, b) => b[1].points - a[1].points).forEach(([action, v]) => {
    console.log(`  ${action.padEnd(28)} ${String(v.count).padStart(4)}× = ${String(v.points).padStart(6)} pts`);
  });

  // 4. Cross-check source events that SHOULD have awarded points
  console.log("\nSource events the resync script tracks:");

  const uploads = await fetchAll("Upload", "id, courseId, seriesId, clubUsed, windCondition, strategyNote, createdAt", (q) => q.eq("userId", user.id));
  console.log(`  Upload:        ${uploads.length} clips`);

  const likes = await fetchAll("Like", "id, uploadId", (q) => q.in("uploadId", uploads.map(u => u.id).slice(0, 999).length ? uploads.map(u => u.id) : ["00000000-0000-0000-0000-000000000000"]));
  console.log(`  Like received: ${likes.length}`);

  const comments = await fetchAll("Comment", "id, uploadId, userId", (q) => q.in("uploadId", uploads.map(u => u.id).slice(0, 999).length ? uploads.map(u => u.id) : ["00000000-0000-0000-0000-000000000000"]));
  const otherComments = comments.filter(c => c.userId !== user.id);
  console.log(`  Comment received (from others): ${otherComments.length}`);

  const follows = await fetchAll("Follow", "id, status", (q) => q.eq("followingId", user.id));
  const activeFollows = follows.filter(f => !f.status || f.status === "ACTIVE");
  console.log(`  Follow received (active): ${activeFollows.length}`);

  const rounds = await fetchAll("Round", "id", (q) => q.eq("userId", user.id));
  console.log(`  Round:         ${rounds.length}`);

  // 5. Source events the resync script does NOT track (these could be missing)
  console.log("\nSource events NOT covered by the resync (live-only):");
  console.log(`  • Course profile fields (ADD_COVER_PHOTO, ADD_COURSE_LOGO, …)`);
  console.log(`  • Hole metadata (ADD_HOLE_PAR, ADD_HOLE_YARDAGE, ADD_HOLE_PHOTO)`);
  console.log(`  • Scorecard (SCORECARD_COMPLETE, FIRST_SCORECARD_FOR_COURSE)`);
  console.log(`  • Streak bonuses (streak_3_weeks, …, streak_52_weeks)`);
  console.log(`  • Level-up / Rank-up bonuses (awarded inline by awardPoints)`);
  console.log(`  • Negative actions (UNLIKE_RECEIVED, UPLOAD_DELETED)`);
  console.log("  These survive in the ledger if previously awarded but are NOT recomputed.");

  console.log("\nDone.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

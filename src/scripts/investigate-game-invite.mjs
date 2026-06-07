// One-off investigation: did the opponent of the most recent game get a
// trip_invite Notification + GolfTripMember row? Read-only.
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Most recent games
const { data: games } = await sb
  .from("TripGame")
  .select("id, tripId, courseName, format, players, createdBy, createdAt")
  .order("createdAt", { ascending: false })
  .limit(5);

console.log("=== Recent games ===");
for (const g of games ?? []) {
  const playerNames = (g.players ?? []).map((p) => `${p.displayName}(${p.userId?.slice(0, 8)})`).join(", ");
  console.log(`\n  game ${g.id}`);
  console.log(`    trip ${g.tripId}  ${g.courseName}  ${g.format}  ${g.createdAt}`);
  console.log(`    createdBy ${g.createdBy?.slice(0, 8)}`);
  console.log(`    players: ${playerNames}`);
}

const latest = games?.[0];
if (!latest) { console.log("no games"); process.exit(0); }

console.log(`\n\n=== Deep-dive latest game ${latest.id} (trip ${latest.tripId}) ===`);

// Trip + members
const { data: trip } = await sb.from("GolfTrip").select("id, name, createdBy, startDate, endDate").eq("id", latest.tripId).maybeSingle();
console.log(`Trip: ${trip?.name}  createdBy ${trip?.createdBy?.slice(0,8)}  ${trip?.startDate}..${trip?.endDate}`);

const { data: members } = await sb.from("GolfTripMember").select("userId, role, status").eq("tripId", latest.tripId);
console.log("Members:");
for (const m of members ?? []) console.log(`  ${m.userId?.slice(0,8)}  role=${m.role}  status=${m.status}`);

// Resolve user names
const playerIds = [...new Set([...(latest.players ?? []).map(p => p.userId), ...(members ?? []).map(m => m.userId)].filter(Boolean))];
const { data: users } = await sb.from("User").select("id, displayName, username").in("id", playerIds);
const nameOf = (id) => { const u = (users ?? []).find(x => x.id === id); return u ? `${u.displayName || u.username}` : id?.slice(0,8); };
console.log("\nPlayer identities:");
for (const id of playerIds) console.log(`  ${id.slice(0,8)}  ${nameOf(id)}`);

// Notifications referencing this trip
const { data: notifs } = await sb
  .from("Notification")
  .select("id, userId, type, title, body, referenceId, read, createdAt")
  .eq("referenceId", latest.tripId)
  .order("createdAt", { ascending: false });
console.log(`\nNotifications referencing trip ${latest.tripId}: ${notifs?.length ?? 0}`);
for (const n of notifs ?? []) {
  console.log(`  → ${nameOf(n.userId)}  [${n.type}] "${n.title}" ${n.createdAt}`);
}

// Who is the opponent (not creator)?
const opponents = (latest.players ?? []).filter(p => p.userId !== latest.createdBy);
console.log("\nOpponents (non-creator players):");
for (const o of opponents) {
  const isMember = (members ?? []).some(m => m.userId === o.userId);
  const gotNotif = (notifs ?? []).some(n => n.userId === o.userId);
  console.log(`  ${nameOf(o.userId)} (${o.userId?.slice(0,8)})  member=${isMember}  notified=${gotNotif}`);
}

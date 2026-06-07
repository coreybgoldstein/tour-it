// Retroactive: send the opponent of the most-recent game a game_challenge
// notification (the live code now does this automatically going forward;
// this backfills the one game that slipped through). Inserts the in-app
// Notification row and attempts a web-push if the user has a subscription.
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import "dotenv/config";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GAME_ID = "f38a05ba-29f4-4252-b5d0-069382d5eab1"; // Hampshire CC, today

const { data: game } = await sb
  .from("TripGame")
  .select("id, tripId, courseName, format, players, createdBy, createdAt")
  .eq("id", GAME_ID)
  .maybeSingle();
if (!game) { console.log("game not found"); process.exit(1); }

const { data: trip } = await sb.from("GolfTrip").select("name").eq("id", game.tripId).maybeSingle();
const { data: creator } = await sb.from("User").select("displayName, username").eq("id", game.createdBy).maybeSingle();
const creatorName = creator?.displayName || creator?.username || "Someone";
const formatName = { nassau: "Nassau", skins: "Skins", match_play: "Match Play", best_ball: "Best Ball", closest_to_pin: "Closest to the Pin", longest_drive: "Longest Drive" }[game.format] || "game";

const others = (game.players ?? []).filter((p) => p.userId !== game.createdBy);
console.log(`Game: ${game.courseName} ${game.format}  by ${creatorName}`);
console.log(`Opponents: ${others.map((o) => o.displayName).join(", ")}`);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

for (const o of others) {
  // Skip if a game_challenge for this trip already exists after the game's creation.
  const { data: existing } = await sb
    .from("Notification")
    .select("id")
    .eq("userId", o.userId)
    .eq("type", "game_challenge")
    .eq("referenceId", game.tripId)
    .gte("createdAt", game.createdAt);
  if (existing && existing.length > 0) {
    console.log(`  ${o.displayName}: already has a game_challenge — skipping`);
    continue;
  }

  const now = new Date().toISOString();
  const { error } = await sb.from("Notification").insert({
    id: crypto.randomUUID(),
    userId: o.userId,
    type: "game_challenge",
    title: "New game!",
    body: `${creatorName} set up a ${formatName} at ${game.courseName}`,
    linkUrl: `/trips/${game.tripId}?game=${game.id}`,
    referenceId: game.tripId,
    read: false,
    createdAt: now,
    updatedAt: now,
  });
  if (error) { console.log(`  ${o.displayName}: insert failed — ${error.message}`); continue; }
  console.log(`  ${o.displayName}: in-app notification inserted`);

  // Best-effort push.
  const { data: u } = await sb.from("User").select("pushSubscription").eq("id", o.userId).maybeSingle();
  if (!u?.pushSubscription) { console.log(`  ${o.displayName}: no push subscription`); continue; }
  try {
    await webpush.sendNotification(
      JSON.parse(u.pushSubscription),
      JSON.stringify({
        title: "New game!",
        body: `${creatorName} set up a game in "${trip?.name ?? game.courseName}"`,
        url: `/trips/${game.tripId}`,
      })
    );
    console.log(`  ${o.displayName}: push sent`);
  } catch (e) {
    console.log(`  ${o.displayName}: push failed — ${e.statusCode ?? ""} ${e.message}`);
  }
}
console.log("done");
